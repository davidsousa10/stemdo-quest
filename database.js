const { neon } = require('@neondatabase/serverless');

let sql;

function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

async function initDb() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      best_score INTEGER DEFAULT 0,
      attempts_used INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id),
      score INTEGER NOT NULL,
      played_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

module.exports = { getDb, initDb };
