import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getHeaderValue(headers, key) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(key);
  return headers[key] ?? headers[key?.toLowerCase()];
}

function mapOpenAIError(err) {
  const status = err?.status;
  const code = err?.code;
  if (status === 401) return { httpStatus: 401, body: { error: 'OpenAI authentication failed. Please verify your OPENAI_API_KEY.' } };
  if (status === 429 && code === 'insufficient_quota') return { httpStatus: 429, body: { error: 'OpenAI quota exhausted. Check billing and add credit, then retry.' } };
  if (status === 429) return { httpStatus: 429, body: { error: 'OpenAI rate limit reached. Please wait and try again.' } };
  if (status === 400) return { httpStatus: 400, body: { error: 'OpenAI request rejected. Verify input and try again.' } };
  return { httpStatus: status && Number.isInteger(status) ? status : 500, body: { error: 'Failed to generate report' } };
}

function mapGeminiError(err) {
  const status = err?.status;
  if (status === 401) return { httpStatus: 401, body: { error: 'Gemini authentication failed. Please verify your GEMINI_API_KEY.' } };
  if (status === 429) return { httpStatus: 429, body: { error: 'Gemini rate limit/quota reached. Wait and retry or check Google AI Studio.' } };
  if (status === 403) return { httpStatus: 403, body: { error: 'Gemini forbidden. Ensure the API is enabled and the key has access.' } };
  if (status === 400) return { httpStatus: 400, body: { error: 'Gemini request rejected. Verify input and try again.' } };
  if (status === 404) return { httpStatus: 404, body: { error: 'Gemini model not found. Use supported models (e.g. gemini-2.5-flash, gemini-2.5-flash-lite).' } };
  return { httpStatus: status && Number.isInteger(status) ? status : 500, body: { error: 'Failed to generate report' } };
}

export function mapApiError(err, provider) {
  return provider === 'gemini' ? mapGeminiError(err) : mapOpenAIError(err);
}

async function createChatCompletionWithRetry(params) {
  const maxRetries = Math.max(0, parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10) || 0);
  let attempt = 0;
  while (true) {
    try {
      return await openai.chat.completions.create(params);
    } catch (e) {
      const status = e?.status;
      const code = e?.code;
      const retryable = status === 429 ? code !== 'insufficient_quota' : [500, 502, 503, 504].includes(status);
      if (!retryable || attempt >= maxRetries) throw e;
      const retryAfter = getHeaderValue(e?.headers, 'retry-after');
      const ms = Math.max((Number(retryAfter) || 0) * 1000, Math.min(8000, 500 * 2 ** attempt));
      await sleep(ms);
      attempt++;
    }
  }
}

async function geminiGenerateText({ apiKey, model, systemPrompt, userPrompt, temperature, maxOutputTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(typeof maxOutputTokens === 'number' ? { maxOutputTokens } : {}),
    },
  };
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) {
    let details = null;
    try { details = await resp.json(); } catch { details = await resp.text(); }
    const msg = (details?.error?.message ?? details?.message) || `Gemini failed: ${resp.status}`;
    throw { status: resp.status, message: msg, details };
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join('') || '';
  return text;
}

const platformFormats = {
  getyourguide: { name: 'GetYourGuide', guidelines: '- Use formal but warm tone\n- Start with "Dear GetYourGuide Partner Team"\n- Include booking reference prominently\n- End with "Best regards" followed by signature block\n- Keep paragraphs concise but complete' },
  viator: { name: 'Viator', guidelines: '- Use professional yet approachable tone\n- Start with "Dear Viator Partner Support"\n- Reference the activity/tour name early\n- End with "Kind regards" followed by signature block\n- Include clear next steps if applicable' },
  generic: { name: 'Generic Partner', guidelines: '- Use universally professional tone\n- Start with "Dear Partner Team"\n- Provide full context\n- End with "Warm regards" followed by signature block\n- Be thorough but not verbose' },
};

const toneConfigs = {
  neutral: { name: 'Neutral', instruction: 'Maintain a balanced, factual, professional tone. Present information objectively. Focus on clarity and completeness.' },
  soft: { name: 'Soft & Apologetic', instruction: 'Use an empathetic, understanding tone. Acknowledge the customer experience. Express regret where appropriate without admitting fault.' },
  firm: { name: 'Firm but Polite', instruction: 'Be clear and assertive. State facts confidently. Politely clarify misunderstandings. Stand by quality while remaining respectful.' },
};

export async function generateReport(params) {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase().trim() || (GEMINI_API_KEY ? 'gemini' : openai ? 'openai' : '');
  if (!provider) throw Object.assign(new Error('No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.'), { status: 500 });

  const { rawFeedback, bookingReference, platform, tourName, guideRemarks, mealType, tone, customerName } = params;
  if (!rawFeedback) throw Object.assign(new Error('Raw feedback is required'), { status: 400 });

  const platformConfig = platformFormats[platform] || platformFormats.generic;
  const toneConfig = toneConfigs[tone] || toneConfigs.neutral;

  const systemPrompt = `You are a senior operations executive at Ocean Air Travels. You write professional partner reports from informal guide feedback.

RULES: Write as a human executive. Never use: complaint, fault, problem, issue, incident. Use: "kindly note", "as a proactive update", "for your reference". No emojis, markdown, or bullet points. No mention of AI or generation. Empathetic to the customer, professional for the company.

TONE: ${toneConfig.instruction}

PLATFORM: ${platformConfig.guidelines}

STRUCTURE: Greeting → brief context → factual explanation → what was included vs expected → how guide handled it → commitment to quality → closing and signature.`;

  const userPrompt = `Transform this guide feedback into a professional partner report.

RAW FEEDBACK:
${rawFeedback}

${customerName ? `CUSTOMER: ${customerName}` : ''}${bookingReference ? `\nBOOKING: ${bookingReference}` : ''}${tourName ? `\nTOUR: ${tourName}` : ''}${mealType ? `\nMEAL: ${mealType}` : ''}${guideRemarks ? `\nREMARKS: ${guideRemarks}` : ''}

PLATFORM: ${platformConfig.name}\nTONE: ${toneConfig.name}

Output plain text only, ready to paste into an email. No markdown.`;

  const reportModel = provider === 'gemini' ? (process.env.GEMINI_REPORT_MODEL || 'gemini-2.5-flash') : (process.env.OPENAI_REPORT_MODEL || 'gpt-4o');
  const analysisModel = provider === 'gemini' ? (process.env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-flash-lite') : (process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini');

  const generatedReport = provider === 'gemini'
    ? await geminiGenerateText({ apiKey: GEMINI_API_KEY, model: reportModel, systemPrompt, userPrompt, temperature: 0.7, maxOutputTokens: 1500 })
    : (await createChatCompletionWithRetry({ model: reportModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.7, max_tokens: 1500 })).choices[0]?.message?.content;

  if (!generatedReport) throw Object.assign(new Error('Failed to generate report'), { status: 500 });

  const analysisPrompt = `Analyze this feedback. Return ONLY valid JSON with: foodIssues (boolean), customerBehavior (string), expectationMismatch (string), guideResponse (string). Use "None identified" or "Not mentioned" where applicable.\n\nFeedback: ${rawFeedback}`;

  let analysis = { foodIssues: false, customerBehavior: 'Unable to analyze', expectationMismatch: 'Unable to analyze', guideResponse: 'Unable to analyze' };
  try {
    const analysisText = provider === 'gemini'
      ? await geminiGenerateText({ apiKey: GEMINI_API_KEY, model: analysisModel, systemPrompt: '', userPrompt: analysisPrompt, temperature: 0.3, maxOutputTokens: 300 })
      : (await createChatCompletionWithRetry({ model: analysisModel, messages: [{ role: 'user', content: analysisPrompt }], temperature: 0.3, max_tokens: 300 })).choices[0]?.message?.content || '{}';
    analysis = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, ''));
  } catch (_) {}

  return {
    report: generatedReport,
    analysis,
    metadata: { platform: platformConfig.name, tone: toneConfig.name, provider, model: reportModel, generatedAt: new Date().toISOString() },
  };
}
