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
    individual_game_channel_id TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS game_channels (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, channel_id)
  );

  CREATE TABLE IF NOT EXISTS draw_settings (
    guild_id TEXT PRIMARY KEY,
    max_players INTEGER NOT NULL DEFAULT 20,
    start_seconds INTEGER NOT NULL DEFAULT 30,
    difficulty TEXT NOT NULL DEFAULT 'hard',
    animated INTEGER NOT NULL DEFAULT 1,
    start_mention_role_id TEXT,
    start_message TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const settingsColumns = db.prepare('PRAGMA table_info(guild_settings)').all();
if (!settingsColumns.some(column => column.name === 'individual_game_channel_id')) {
  db.exec('ALTER TABLE guild_settings ADD COLUMN individual_game_channel_id TEXT');
}
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
  SET wins = wins + ?, points = points + ?
  WHERE guild_id = ? AND user_id = ?
`);

const defaultSettings = {
  eventRoleId: null,
  winnerPoints: 10,
  maxPlayers: 20,
  lobbySeconds: 30,
  individualGameChannelId: null,
};

const defaultDrawSettings = {
  maxPlayers: 20,
  startSeconds: 30,
  difficulty: 'hard',
  animated: true,
  startMentionRoleId: null,
  startMessage: null,
};

export async function initDatabase() {
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
           lobby_seconds AS lobbySeconds,
           individual_game_channel_id AS individualGameChannelId
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
    individualGameChannelId: row.individualGameChannelId || null,
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
    INSERT INTO guild_settings (guild_id, event_role_id, winner_points, max_players, lobby_seconds, individual_game_channel_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      event_role_id = excluded.event_role_id,
      winner_points = excluded.winner_points,
      max_players = excluded.max_players,
      lobby_seconds = excluded.lobby_seconds,
      individual_game_channel_id = excluded.individual_game_channel_id,
      updated_at = unixepoch()
  `).run(guildId, next.eventRoleId, next.winnerPoints, next.maxPlayers, next.lobbySeconds, next.individualGameChannelId);

  return next;
}

export function getDrawSettings(guildId) {
  if (!guildId) return { ...defaultDrawSettings };
  const row = db.prepare(`
    SELECT max_players AS maxPlayers,
           start_seconds AS startSeconds,
           difficulty,
           animated,
           start_mention_role_id AS startMentionRoleId,
           start_message AS startMessage
    FROM draw_settings
    WHERE guild_id = ?
  `).get(guildId);

  if (!row) {
    db.prepare(`INSERT INTO draw_settings (guild_id) VALUES (?) ON CONFLICT(guild_id) DO NOTHING`).run(guildId);
    return { ...defaultDrawSettings };
  }

  return {
    maxPlayers: Math.min(20, Math.max(3, Number(row.maxPlayers) || 20)),
    startSeconds: Math.min(90, Math.max(10, Number(row.startSeconds) || 30)),
    difficulty: ['easy', 'medium', 'hard'].includes(row.difficulty) ? row.difficulty : 'hard',
    animated: Boolean(row.animated),
    startMentionRoleId: row.startMentionRoleId || null,
    startMessage: row.startMessage || null,
  };
}

export function setDrawSettings(guildId, patch = {}) {
  if (!guildId) return getDrawSettings(guildId);
  const current = getDrawSettings(guildId);
  const requestedDifficulty = Object.hasOwn(patch, 'difficulty') ? patch.difficulty : current.difficulty;
  const next = {
    maxPlayers: Object.hasOwn(patch, 'maxPlayers') ? Math.min(20, Math.max(3, Number(patch.maxPlayers) || 20)) : current.maxPlayers,
    startSeconds: Object.hasOwn(patch, 'startSeconds') ? Math.min(90, Math.max(10, Number(patch.startSeconds) || 30)) : current.startSeconds,
    difficulty: ['easy', 'medium', 'hard'].includes(requestedDifficulty) ? requestedDifficulty : 'hard',
    animated: Object.hasOwn(patch, 'animated') ? Boolean(patch.animated) : current.animated,
    startMentionRoleId: Object.hasOwn(patch, 'startMentionRoleId') ? (patch.startMentionRoleId || null) : current.startMentionRoleId,
    startMessage: Object.hasOwn(patch, 'startMessage') ? (patch.startMessage?.trim() || null) : current.startMessage,
  };

  db.prepare(`
    INSERT INTO draw_settings (guild_id, max_players, start_seconds, difficulty, animated, start_mention_role_id, start_message, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(guild_id) DO UPDATE SET
      max_players = excluded.max_players,
      start_seconds = excluded.start_seconds,
      difficulty = excluded.difficulty,
      animated = excluded.animated,
      start_mention_role_id = excluded.start_mention_role_id,
      start_message = excluded.start_message,
      updated_at = unixepoch()
  `).run(
    guildId,
    next.maxPlayers,
    next.startSeconds,
    next.difficulty,
    next.animated ? 1 : 0,
    next.startMentionRoleId,
    next.startMessage,
  );

  return next;
}

export function recordGame(guildId, userId, win = false, points = 0) {
  if (!guildId || !userId) return;
  ensurePlayer.run(guildId, userId);
  addGame.run(guildId, userId);
  if (win) addWin.run(1, Math.max(0, Number(points) || 0), guildId, userId);
}

export function recordResult(guildId, userId, wins = 0, points = 0) {
  if (!guildId || !userId) return;
  ensurePlayer.run(guildId, userId);
  addGame.run(guildId, userId);
  const safeWins = Math.max(0, Number(wins) || 0);
  const safePoints = Math.max(0, Number(points) || 0);
  if (safeWins || safePoints) addWin.run(safeWins, safePoints, guildId, userId);
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

export function getGameChannels(guildId) {
  return db.prepare(
    'SELECT channel_id AS channelId FROM game_channels WHERE guild_id = ? ORDER BY channel_id'
  ).all(guildId).map(row => row.channelId);
}

export function addGameChannel(guildId, channelId, max = 10) {
  const channels = getGameChannels(guildId);
  if (channels.includes(String(channelId))) return { ok: false, reason: 'already' };
  if (channels.length >= max) return { ok: false, reason: 'limit' };
  db.prepare('INSERT INTO game_channels (guild_id, channel_id) VALUES (?, ?)').run(guildId, String(channelId));
  return { ok: true, reason: null };
}

export function removeGameChannel(guildId, channelId) {
  const result = db.prepare('DELETE FROM game_channels WHERE guild_id = ? AND channel_id = ?').run(guildId, String(channelId));
  return result.changes > 0;
}

export function isGroupGameChannelAllowed(guildId, channelId) {
  const channels = getGameChannels(guildId);
  return channels.length === 0 || channels.includes(String(channelId));
}