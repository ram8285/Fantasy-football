import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNews } from './lib/news.js';
import { getRankings, getTrending } from './lib/sleeper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/news', async (req, res) => {
  try {
    const { items, live, stale } = await getNews();
    const q = (req.query.q || '').toLowerCase().trim();
    const filtered = q
      ? items.filter((i) => `${i.title} ${i.summary}`.toLowerCase().includes(q))
      : items;
    res.json({ live, stale, items: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rankings', async (req, res) => {
  try {
    const position = (req.query.position || 'ALL').toUpperCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const { rankings, live, stale } = await getRankings({ position, limit });
    res.json({ live, stale, rankings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trending/:type', async (req, res) => {
  try {
    const { items, live } = await getTrending(req.params.type);
    res.json({ live, items });
  } catch (err) {
    res.status(err.message.includes('must be') ? 400 : 500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Fantasy Football Hub running at http://localhost:${PORT}`);
});
