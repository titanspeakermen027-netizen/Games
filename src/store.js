import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH || './data/games.sqlite';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS player_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    games INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    event_role_id TEXT,
    winner_points INTEGER NOT NULL DEFAULT 10,
    max_players INTEGER NOT NULL DEFAULT 20,
    lobby_seconds INTEGER NOT NULL DEFAULT 30,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const ensurePlayer = db.prepare(`
  INSERT INTO player_stats (guild_id, user_id) VALUES (?, ?)
  ON CONFLICT(guild_id, user_id) DO NOTHING
`);

const addGame = db.prepare(`
  UPDATE player_stats
  SET games = games + 1
  WHERE guild_id = ? AND user_id = ?
`);

const addWin = db.prepare(`
  UPDATE player_stats
  SET wins = wins + 1, points = points + ?
  WHERE guild_id = ? AND user_id = ?
`);

const defaultSettings = {
  eventRoleId: null,
  winnerPoints: 10,
  maxPlayers: 20,
  lobbySeconds: 30,
};

export async function initDatabase() {
  // Keeps the database initialized and future migrations safe.
  db.prepare(`
    INSERT INTO guild_settings (guild_id)
    VALUES ('__system__')
    ON CONFLICT(guild_id) DO NOTHING
  `).run();
}

export function getGuildSettings(guildId) {
  if (!guildId) return { ...defaultSettings };
  const row = db.prepare(`
    SELECT event_role_id AS eventRoleId,
           winner_points AS winnerPoints,
           max_players AS maxPlayers,
           lobby_seconds AS lobbySeconds
    FROM guild_settings
    WHERE guild_id = ?
  `).get(guildId);

  if (!row) {
    db.prepare(`INSERT INTO guild_settings (guild_id) VALUES (?) ON CONFLICT(guild_id) DO NOTHING`).run(guildId);
    return { ...defaultSettings };
  }

  return {
    eventRoleId: row.eventRoleId || null,
    winnerPoints: Number(row.winnerPoints) || 10,
    maxPlayers: Math.min(20, Math.max(2, Number(row.maxPlayers) || 20)),
    lobbySeconds: Math.min(120, Math.max(10, Number(row.lobbySeconds) || 30)),
  };
}

export function setGuildSettings(guildId, patch = {}) {
  if (!guildId) return getGuildSettings(guildId);
  const current = getGuildSettings(guildId);
  const next = {
    eventRoleId: Object.hasOwn(patch, 'eventRoleId') ? (patch.eventRoleId || null) : current.eventRoleId,
    winnerPoints: Object.hasOwn(patch, 'winnerPoints') ? Math.min(50, Math.max(1, Number(patch.winnerPoints) || 10)) : current.winnerPoints,
    maxPlayers: Object.hasOwn(patch, 'maxPlayers') ? Math.min(20, Math.max(2, Number(patch.maxPlayers) || 20)) : current.maxPlayers,
    lobbySeconds: Object.hasOwn(patch, 'lobbySeconds') ? Math.min(120, Math.max(10, Number(patch.lobbySeconds) || 30)) : current.lobbySeconds,
  };

  db.prepare(`
    INSERT INTO guild_settings (guild_id, event_role_id, winner_points, max_players, lobby_seconds, updated_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      event_role_id = excluded.event_role_id,
      winner_points = excluded.winner_points,
      max_players = excluded.max_players,
      lobby_seconds = excluded.lobby_seconds,
      updated_at = unixepoch()
  `).run(guildId, next.eventRoleId, next.winnerPoints, next.maxPlayers, next.lobbySeconds);

  return next;
}

export function recordGame(guildId, userId, win = false, points = 0) {
  if (!guildId || !userId) return;
  ensurePlayer.run(guildId, userId);
  addGame.run(guildId, userId);
  if (win) addWin.run(Math.max(0, Number(points) || 0), guildId, userId);
}

export function getPlayerStats(guildId, userId) {
  if (!guildId || !userId) return { wins: 0, games: 0, points: 0 };
  ensurePlayer.run(guildId, userId);
  return db.prepare(`
    SELECT wins, games, points
    FROM player_stats
    WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId);
}

export function getLeaderboard(guildId, limit = 10) {
  if (!guildId) return [];
  return db.prepare(`
    SELECT user_id AS userId, wins, games, points
    FROM player_stats
    WHERE guild_id = ?
    ORDER BY points DESC, wins DESC, games DESC
    LIMIT ?
  `).all(guildId, Math.min(25, Math.max(1, Number(limit) || 10)));
}
