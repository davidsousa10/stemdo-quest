const express = require('express');
const cors = require('cors');
const path = require('path');
const { Parser } = require('json2csv');
const { db, initDb } = require('./database');
const sheets = require('./sheets');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

sheets.init(app);

// Register player
app.post('/api/register', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'El email es obligatorio' });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  const existing = await db.execute({ sql: 'SELECT * FROM players WHERE name = ?', args: [cleanName] });

  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Ese nombre ya esta en uso' });
  }

  const result = await db.execute({ sql: 'INSERT INTO players (name, email) VALUES (?, ?)', args: [cleanName, cleanEmail] });

  res.json({
    player_id: Number(result.lastInsertRowid),
    name: cleanName,
    best_score: 0,
    attempts_used: 0,
    attempts_left: 3,
    returning: false
  });
});

// Submit score
app.post('/api/score', async (req, res) => {
  const { player_id, score } = req.body;

  if (!player_id || score === undefined) {
    return res.status(400).json({ error: 'player_id y score son obligatorios' });
  }

  const result = await db.execute({ sql: 'SELECT * FROM players WHERE id = ?', args: [player_id] });
  const player = result.rows[0];

  if (!player) {
    return res.status(404).json({ error: 'Jugador no encontrado' });
  }

  if (player.attempts_used >= 3) {
    return res.status(400).json({ error: 'No quedan intentos' });
  }

  await db.execute({ sql: 'INSERT INTO scores (player_id, score) VALUES (?, ?)', args: [player_id, score] });

  const newBest = Math.max(player.best_score, score);
  const newAttempts = player.attempts_used + 1;

  await db.execute({ sql: 'UPDATE players SET best_score = ?, attempts_used = ? WHERE id = ?', args: [newBest, newAttempts, player_id] });

  sheets.addScore(player.name, player.email, score);

  res.json({
    score,
    best_score: newBest,
    attempts_used: newAttempts,
    attempts_left: 3 - newAttempts
  });
});

// Get ranking
app.get('/api/ranking', async (req, res) => {
  const result = await db.execute('SELECT name, best_score FROM players WHERE best_score > 0 ORDER BY best_score DESC LIMIT 10');
  res.json(result.rows);
});

// Export CSV
app.get('/api/export', async (req, res) => {
  const result = await db.execute(`
    SELECT p.name, p.email, p.best_score, p.attempts_used, p.created_at,
           GROUP_CONCAT(s.score, '; ') as all_scores
    FROM players p
    LEFT JOIN scores s ON p.id = s.player_id
    GROUP BY p.id
    ORDER BY p.best_score DESC
  `);

  const fields = ['name', 'email', 'best_score', 'attempts_used', 'all_scores', 'created_at'];
  const parser = new Parser({ fields });
  const csv = parser.parse(result.rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=ranking-stemdo.csv');
  res.send(csv);
});

initDb();

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
