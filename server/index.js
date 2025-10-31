import express from 'express';
import bodyParser from 'body-parser';
import { runDownload } from '../main.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/download', async (req, res) => {
  const { idol, start, end } = req.body || {};
  if (!idol || !start || !end) {
    return res.status(400).json({ error: 'idol, start, end are required' });
  }
  try {
    await runDownload(String(idol), parseInt(start), parseInt(end));
    res.json({ status: 'completed', idol, start: Number(start), end: Number(end) });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://0.0.0.0:${port}`);
});


