import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateReport, mapApiError } from '../lib/generate-report.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

app.post('/api/generate-report', async (req, res) => {
  try {
    const result = await generateReport(req.body);
    res.json(result);
  } catch (err) {
    console.error('Error generating report:', err);
    const provider = (process.env.AI_PROVIDER || '').toLowerCase().trim() ||
      (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'openai');
    const { httpStatus, body } = mapApiError(err, provider);
    res.status(httpStatus).json(body);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API at http://localhost:${PORT}/api`);
});
