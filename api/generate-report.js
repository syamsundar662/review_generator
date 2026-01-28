import { generateReport, mapApiError } from '../lib/generate-report.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body ?? {};
  try {
    const result = await generateReport(body);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error generating report:', err);
    const provider = (process.env.AI_PROVIDER || '').toLowerCase().trim() ||
      (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'openai');
    const { httpStatus, body: out } = mapApiError(err, provider);
    res.status(httpStatus).json(out);
  }
}
