import { db } from './index'
import type { StoredEmbed } from '../features/embeds/types'

interface EmbedRow {
  id: number
  guild_id: string
  name: string
  data: string
  created_by: string | null
  created_at: number
  updated_at: number
}

export interface EmbedRecord {
  id: number
  name: string
  data: StoredEmbed
}

const selectStmt = db.prepare('SELECT * FROM embeds WHERE guild_id = ? AND name = ?')
const listStmt = db.prepare('SELECT name FROM embeds WHERE guild_id = ? ORDER BY name COLLATE NOCASE')
const insertStmt = db.prepare(
  'INSERT INTO embeds (guild_id, name, data, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
)
const updateStmt = db.prepare('UPDATE embeds SET data = ?, updated_at = ? WHERE guild_id = ? AND name = ?')
const deleteStmt = db.prepare('DELETE FROM embeds WHERE guild_id = ? AND name = ?')

function toRecord(row: EmbedRow): EmbedRecord {
  return { id: row.id, name: row.name, data: JSON.parse(row.data) as StoredEmbed }
}

export const embedStore = {
  get(guildId: string, name: string): EmbedRecord | null {
    const row = selectStmt.get(guildId, name) as EmbedRow | undefined
    return row ? toRecord(row) : null
  },

  exists(guildId: string, name: string): boolean {
    return selectStmt.get(guildId, name) !== undefined
  },

  list(guildId: string): string[] {
    return (listStmt.all(guildId) as { name: string }[]).map(r => r.name)
  },

  /** Crée ou remplace un embed nommé (upsert). */
  save(guildId: string, name: string, data: StoredEmbed, userId?: string): void {
    const now = Date.now()
    if (this.exists(guildId, name)) {
      updateStmt.run(JSON.stringify(data), now, guildId, name)
    } else {
      insertStmt.run(guildId, name, JSON.stringify(data), userId ?? null, now, now)
    }
  },

  delete(guildId: string, name: string): boolean {
    return deleteStmt.run(guildId, name).changes > 0
  },

  clone(guildId: string, source: string, target: string, userId?: string): boolean {
    const src = this.get(guildId, source)
    if (!src || this.exists(guildId, target)) return false
    this.save(guildId, target, src.data, userId)
    return true
  },
}
