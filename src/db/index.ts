import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DB_PATH = process.env.DB_PATH ?? 'data/z9bot.db'
mkdirSync(dirname(DB_PATH), { recursive: true })

/** Connexion SQLite (module intégré à Node, aucune dépendance native). */
export const db = new DatabaseSync(DB_PATH)

db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

// Schéma — créé au premier démarrage, idempotent.
db.exec(`
  CREATE TABLE IF NOT EXISTS embeds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    data        TEXT NOT NULL,
    created_by  TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    UNIQUE(guild_id, name)
  );

  CREATE TABLE IF NOT EXISTS role_panels (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    channel_id   TEXT,
    message_id   TEXT,
    mode         TEXT NOT NULL DEFAULT 'buttons',
    behavior     TEXT NOT NULL DEFAULT 'normal',
    limit_count  INTEGER,
    embed_data   TEXT,
    data         TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS role_panel_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    panel_id    INTEGER NOT NULL,
    role_id     TEXT NOT NULL,
    label       TEXT,
    description TEXT,
    emoji       TEXT,
    style       TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(panel_id) REFERENCES role_panels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS temp_roles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    role_id    TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ticket_panels (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT,
    message_id  TEXT,
    data        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    channel_id   TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    category_key TEXT NOT NULL,
    claimed_by   TEXT,
    status       TEXT NOT NULL DEFAULT 'open',
    created_at   INTEGER NOT NULL,
    closed_at    INTEGER
  );

  CREATE TABLE IF NOT EXISTS greetings (
    guild_id TEXT NOT NULL,
    kind     TEXT NOT NULL,
    data     TEXT NOT NULL,
    PRIMARY KEY (guild_id, kind)
  );
`)

// Migration douce : ajoute la colonne `data` aux bases créées avant le modèle multi-groupes.
try {
  db.exec('ALTER TABLE role_panels ADD COLUMN data TEXT')
} catch {
  // La colonne existe déjà : rien à faire.
}
