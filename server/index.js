import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Check for OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn('\n⚠️  WARNING: OPENAI_API_KEY is not set!');
  console.warn('   Create a .env file with your API key:');
  console.warn('   OPENAI_API_KEY=sk-your-key-here\n');
}

// Gemini API key (Google AI Studio / Generative Language API)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn('\nℹ️  GEMINI_API_KEY is not set.');
  console.warn('   To use Gemini, add to your .env file:');
  console.warn('   GEMINI_API_KEY=AIzaSy-your-key-here\n');
}

// Initialize OpenAI client (will be null if no API key)
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHeaderValue(headers, key) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(key);
  return headers[key] ?? headers[key.toLowerCase()];
}

function mapOpenAIError(err) {
  const status = err?.status;
  const code = err?.code;

  // OpenAI sends 429 for both rate limits and "insufficient_quota".
  if (status === 401) {
    return {
      httpStatus: 401,
      body: {
        error: 'OpenAI authentication failed. Please verify your OPENAI_API_KEY.',
      },
    };
  }

  if (status === 429 && code === 'insufficient_quota') {
    return {
      httpStatus: 429,
      body: {
        error:
          'OpenAI quota exhausted for this API key. Please check OpenAI billing/usage and add credit, then retry.',
      },
    };
  }

  if (status === 429) {
    const retryAfter = getHeaderValue(err?.headers, 'retry-after');
    return {
      httpStatus: 429,
      body: {
        error: 'OpenAI rate limit reached. Please wait a moment and try again.',
        ...(retryAfter ? { retryAfterSeconds: Number(retryAfter) || retryAfter } : {}),
      },
    };
  }

  if (status === 400) {
    return {
      httpStatus: 400,
      body: {
        error: 'OpenAI request was rejected. Please verify the input and try again.',
      },
    };
  }

  return {
    httpStatus: status && Number.isInteger(status) ? status : 500,
    body: {
      error: 'Failed to generate report',
    },
  };
}

async function createChatCompletionWithRetry(params) {
  const maxRetriesRaw = process.env.OPENAI_MAX_RETRIES;
  const maxRetries =
    maxRetriesRaw === undefined ? 2 : Math.max(0, Number.parseInt(maxRetriesRaw, 10) || 0);

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      const status = err?.status;
      const code = err?.code;

      // Don't retry quota exhaustion, auth issues, or malformed requests.
      const retryable =
        status === 429
          ? code !== 'insufficient_quota'
          : status === 500 || status === 502 || status === 503 || status === 504;

      if (!retryable || attempt >= maxRetries) throw err;

      const retryAfter = getHeaderValue(err?.headers, 'retry-after');
      const retryAfterMs = retryAfter ? (Number(retryAfter) || 0) * 1000 : 0;
      const backoffMs = Math.min(8000, 500 * 2 ** attempt);
      await sleep(Math.max(retryAfterMs, backoffMs));
      attempt += 1;
    }
  }
}

function mapGeminiError(err) {
  // We throw our own errors with shape: { status, message, details }
  const status = err?.status;

  if (status === 401) {
    return {
      httpStatus: 401,
      body: {
        error: 'Gemini authentication failed. Please verify your GEMINI_API_KEY.',
      },
    };
  }

  if (status === 429) {
    return {
      httpStatus: 429,
      body: {
        error: 'Gemini rate limit/quota reached. Please wait and try again, or check Google AI Studio quota/billing.',
      },
    };
  }

  if (status === 403) {
    return {
      httpStatus: 403,
      body: {
        error:
          'Gemini request forbidden. Ensure the Generative Language API is enabled for this key and that it has access.',
      },
    };
  }

  if (status === 400) {
    return {
      httpStatus: 400,
      body: {
        error: 'Gemini request was rejected. Please verify the input and try again.',
      },
    };
  }

  if (status === 404) {
    return {
      httpStatus: 404,
      body: {
        error:
          'Gemini model not found. Use supported models (e.g. gemini-2.5-flash, gemini-2.5-flash-lite) and set GEMINI_REPORT_MODEL / GEMINI_ANALYSIS_MODEL if overridden.',
      },
    };
  }

  return {
    httpStatus: status && Number.isInteger(status) ? status : 500,
    body: {
      error: 'Failed to generate report',
    },
  };
}

async function geminiGenerateText({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  temperature,
  maxOutputTokens,
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    ...(systemPrompt
      ? {
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
        }
      : {}),
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(typeof maxOutputTokens === 'number' ? { maxOutputTokens } : {}),
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let details = null;
    try {
      details = await resp.json();
    } catch {
      details = await resp.text();
    }
    const message =
      (details && (details.error?.message || details.message)) ||
      `Gemini request failed with status ${resp.status}`;
    throw { status: resp.status, message, details };
  }

  const data = await resp.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text)
      .filter(Boolean)
      .join('') || '';

  return text;
}

// Platform-specific formatting guidelines
const platformFormats = {
  getyourguide: {
    name: 'GetYourGuide',
    guidelines: `
      - Use formal but warm tone
      - Start with "Dear GetYourGuide Partner Team"
      - Include booking reference prominently
      - End with "Best regards" followed by signature block
      - Keep paragraphs concise but complete
    `
  },
  viator: {
    name: 'Viator',
    guidelines: `
      - Use professional yet approachable tone
      - Start with "Dear Viator Partner Support"
      - Reference the activity/tour name early
      - End with "Kind regards" followed by signature block
      - Include clear next steps if applicable
    `
  },
  generic: {
    name: 'Generic Partner',
    guidelines: `
      - Use universally professional tone
      - Start with "Dear Partner Team"
      - Provide full context as the recipient may not have background
      - End with "Warm regards" followed by signature block
      - Be thorough but not verbose
    `
  }
};

// Tone configurations
const toneConfigs = {
  neutral: {
    name: 'Neutral',
    instruction: 'Maintain a balanced, factual, and professional tone. Present information objectively without being cold or distant. Focus on clarity and completeness.'
  },
  soft: {
    name: 'Soft & Apologetic',
    instruction: 'Use an empathetic and understanding tone. Acknowledge the customer experience with genuine care. Express regret where appropriate without admitting fault. Emphasize our commitment to guest satisfaction.'
  },
  firm: {
    name: 'Firm but Polite',
    instruction: 'Maintain professionalism while being clear and assertive. State facts confidently. Politely clarify any misunderstandings about inclusions or expectations. Stand by the quality of service while remaining respectful.'
  }
};

// Generate report endpoint
app.post('/api/generate-report', async (req, res) => {
  try {
    const providerFromEnv = (process.env.AI_PROVIDER || '').toLowerCase().trim();
    const provider =
      providerFromEnv ||
      (GEMINI_API_KEY ? 'gemini' : openai ? 'openai' : '');

    if (!provider) {
      return res.status(500).json({
        error:
          'No AI provider configured. Set GEMINI_API_KEY (recommended) or OPENAI_API_KEY in your .env file.',
      });
    }

    const {
      rawFeedback,
      bookingReference,
      platform,
      tourName,
      guideRemarks,
      mealType,
      tone,
      customerName
    } = req.body;

    if (!rawFeedback) {
      return res.status(400).json({ error: 'Raw feedback is required' });
    }

    const platformConfig = platformFormats[platform] || platformFormats.generic;
    const toneConfig = toneConfigs[tone] || toneConfigs.neutral;

    const systemPrompt = `You are a senior operations executive at Ocean Air Travels, a premium travel company. You write professional partner reports that transform informal guide feedback into polished, human-written communications.

CRITICAL WRITING RULES:
1. Write as if a senior operations executive wrote it personally - not AI
2. Never use words like: complaint, fault, problem, issue, incident
3. Use phrases like: "kindly note", "as a proactive update", "to keep all partners aligned", "for your reference"
4. Never sound angry, defensive, sarcastic, or robotic
5. No emojis, no markdown formatting, no bullet points in the output
6. No mention of "AI", "model", "generated", or any technical terms
7. Vary sentence length for natural flow
8. Use complete paragraphs with smooth transitions
9. Be empathetic to the customer while protecting the company professionally
10. Frame everything as proactive communication, not reactive damage control

TONE INSTRUCTION:
${toneConfig.instruction}

PLATFORM FORMATTING:
${platformConfig.guidelines}

STRUCTURE YOUR RESPONSE AS:
1. Professional greeting appropriate for the platform
2. Brief context of the booking (if details provided)
3. Factual explanation of the situation from the guide's perspective
4. Clarification of what was included vs. what may have been expected
5. Description of how our guide handled the situation professionally
6. Proactive communication intent and commitment to quality
7. Courteous closing with signature

Remember: This report will be sent to travel platform partners. It should reflect well on Ocean Air Travels while being honest and transparent.`;

    const userPrompt = `Please transform the following guide feedback into a professional partner report.

RAW FEEDBACK FROM GUIDE:
${rawFeedback}

${customerName ? `CUSTOMER NAME: ${customerName}` : ''}
${bookingReference ? `BOOKING REFERENCE: ${bookingReference}` : ''}
${tourName ? `TOUR NAME: ${tourName}` : ''}
${mealType ? `MEAL INCLUSION: ${mealType}` : ''}
${guideRemarks ? `ADDITIONAL GUIDE REMARKS: ${guideRemarks}` : ''}

PLATFORM: ${platformConfig.name}
TONE: ${toneConfig.name}

Generate the professional report now. Write it as plain text without any markdown formatting, headers, or bullet points. The output should be ready to copy and paste into an email.`;

    const reportModel =
      provider === 'gemini'
        ? process.env.GEMINI_REPORT_MODEL || 'gemini-2.5-flash'
        : process.env.OPENAI_REPORT_MODEL || 'gpt-4o';

    const analysisModel =
      provider === 'gemini'
        ? process.env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-flash-lite'
        : process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini';

    const generatedReport =
      provider === 'gemini'
        ? await geminiGenerateText({
            apiKey: GEMINI_API_KEY,
            model: reportModel,
            systemPrompt,
            userPrompt,
            temperature: 0.7,
            maxOutputTokens: 1500,
          })
        : (
            await createChatCompletionWithRetry({
              model: reportModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.7,
              max_tokens: 1500,
            })
          ).choices[0]?.message?.content;

    if (!generatedReport) {
      return res.status(500).json({ error: 'Failed to generate report' });
    }

    // Analyze the feedback to identify key elements
    const analysisPrompt = `Analyze this feedback and identify key elements. Return a JSON object with these fields:
- foodIssues: boolean
- customerBehavior: string (brief description or "None identified")
- expectationMismatch: string (brief description or "None identified")
- guideResponse: string (brief description or "Not mentioned")

Feedback: ${rawFeedback}

Return ONLY valid JSON, no other text.`;

    let analysis = {};
    try {
      const analysisText =
        provider === 'gemini'
          ? await geminiGenerateText({
              apiKey: GEMINI_API_KEY,
              model: analysisModel,
              systemPrompt: '',
              userPrompt: analysisPrompt,
              temperature: 0.3,
              maxOutputTokens: 300,
            })
          : (
              await createChatCompletionWithRetry({
                model: analysisModel,
                messages: [{ role: 'user', content: analysisPrompt }],
                temperature: 0.3,
                max_tokens: 300,
              })
            ).choices[0]?.message?.content || '{}';

      analysis = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, ''));
    } catch (e) {
      analysis = {
        foodIssues: false,
        customerBehavior: 'Unable to analyze',
        expectationMismatch: 'Unable to analyze',
        guideResponse: 'Unable to analyze'
      };
    }

    res.json({
      report: generatedReport,
      analysis,
      metadata: {
        platform: platformConfig.name,
        tone: toneConfig.name,
        provider,
        model: reportModel,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    const providerFromEnv = (process.env.AI_PROVIDER || '').toLowerCase().trim();
    const provider =
      providerFromEnv ||
      (GEMINI_API_KEY ? 'gemini' : openai ? 'openai' : 'openai');

    const mapped = provider === 'gemini' ? mapGeminiError(error) : mapOpenAIError(error);
    res.status(mapped.httpStatus).json(mapped.body);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
