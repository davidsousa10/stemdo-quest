const express = require('express');
const cors = require('cors');
const path = require('path');
const { Parser } = require('json2csv');
const { getDb, initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Register player
app.post('/api/register', async (req, res) => {
  try {
    const { name, email } = req.body;
    const sql = getDb();

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'El email es obligatorio' });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existing = await sql`SELECT * FROM players WHERE name = ${cleanName}`;
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ese nombre ya esta en uso' });
    }

    const result = await sql`INSERT INTO players (name, email) VALUES (${cleanName}, ${cleanEmail}) RETURNING id`;

    res.json({
      player_id: result[0].id,
      name: cleanName,
      best_score: 0,
      attempts_used: 0,
      attempts_left: 3
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Submit score
app.post('/api/score', async (req, res) => {
  try {
    const { player_id, score } = req.body;
    const sql = getDb();

    if (!player_id || score === undefined) {
      return res.status(400).json({ error: 'player_id y score son obligatorios' });
    }

    const players = await sql`SELECT * FROM players WHERE id = ${player_id}`;
    const player = players[0];

    if (!player) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }
    if (player.attempts_used >= 3) {
      return res.status(400).json({ error: 'No quedan intentos' });
    }

    await sql`INSERT INTO scores (player_id, score) VALUES (${player_id}, ${score})`;

    const newBest = Math.max(player.best_score, score);
    const newAttempts = player.attempts_used + 1;

    await sql`UPDATE players SET best_score = ${newBest}, attempts_used = ${newAttempts} WHERE id = ${player_id}`;

    res.json({
      score,
      best_score: newBest,
      attempts_used: newAttempts,
      attempts_left: 3 - newAttempts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Get ranking
app.get('/api/ranking', async (req, res) => {
  try {
    const sql = getDb();
    const ranking = await sql`SELECT name, best_score FROM players WHERE best_score > 0 ORDER BY best_score DESC LIMIT 10`;
    res.json(ranking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Export CSV
app.get('/api/export', async (req, res) => {
  try {
    const sql = getDb();
    const data = await sql`
      SELECT p.name, p.email, p.best_score, p.attempts_used, p.created_at,
             STRING_AGG(s.score::text, '; ') as all_scores
      FROM players p
      LEFT JOIN scores s ON p.id = s.player_id
      GROUP BY p.id, p.name, p.email, p.best_score, p.attempts_used, p.created_at
      ORDER BY p.best_score DESC
    `;

    const fields = ['name', 'email', 'best_score', 'attempts_used', 'all_scores', 'created_at'];
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ranking-stemdo.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

initDb().catch(console.error);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
