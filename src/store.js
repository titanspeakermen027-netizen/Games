import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH || './data/games.sqlite';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS player_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    games INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
`);

const ensure = db.prepare(`
  INSERT INTO player_stats (guild_id, user_id) VALUES (?, ?)
  ON CONFLICT(guild_id, user_id) DO NOTHING
`);
const addGame = db.prepare(`UPDATE player_stats SET games = games + 1 WHERE guild_id = ? AND user_id = ?`);
const addWin = db.prepare(`UPDATE player_stats SET wins = wins + 1, points = points + ? WHERE guild_id = ? AND user_id = ?`);

export async function initDatabase() {
  ensure.run('__system__', '__system__');
}

export function recordGame(guildId, userId, win = false, points = 0) {
  if (!guildId || !userId) return;
  ensure.run(guildId, userId);
  addGame.run(guildId, userId);
  if (win) addWin.run(points, guildId, userId);
}
