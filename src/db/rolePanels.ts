import { db } from './index'
import type { StoredEmbed } from '../features/embeds/types'
import type { PanelBehavior, PanelMode, RolePanel, RolePanelEntry } from '../features/roles/types'

interface PanelRow {
  id: number
  guild_id: string
  channel_id: string | null
  message_id: string | null
  mode: string
  behavior: string
  limit_count: number | null
  embed_data: string | null
}

interface EntryRow {
  role_id: string
  label: string | null
  description: string | null
  emoji: string | null
  style: string | null
  position: number
}

const insertPanel = db.prepare(
  `INSERT INTO role_panels (guild_id, mode, behavior, limit_count, embed_data, created_at, updated_at)
   VALUES (?, 'buttons', 'normal', NULL, '{}', ?, ?)`,
)
const updatePanel = db.prepare(
  `UPDATE role_panels SET channel_id=?, message_id=?, mode=?, behavior=?, limit_count=?, embed_data=?, updated_at=? WHERE id=?`,
)
const selectPanel = db.prepare('SELECT * FROM role_panels WHERE id = ?')
const selectPanelByMessage = db.prepare('SELECT * FROM role_panels WHERE guild_id = ? AND message_id = ?')
const selectPanelsByGuild = db.prepare('SELECT * FROM role_panels WHERE guild_id = ? ORDER BY id DESC')
const deletePanelStmt = db.prepare('DELETE FROM role_panels WHERE id = ?')
const setPublishedStmt = db.prepare('UPDATE role_panels SET channel_id=?, message_id=?, updated_at=? WHERE id=?')

const selectEntries = db.prepare('SELECT * FROM role_panel_entries WHERE panel_id = ? ORDER BY position ASC')
const deleteEntries = db.prepare('DELETE FROM role_panel_entries WHERE panel_id = ?')
const insertEntry = db.prepare(
  'INSERT INTO role_panel_entries (panel_id, role_id, label, description, emoji, style, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
)

function rowToPanel(row: PanelRow): RolePanel {
  const entries = (selectEntries.all(row.id) as unknown as EntryRow[]).map((e, i) => ({
    roleId: e.role_id,
    label: e.label ?? 'Rôle',
    description: e.description ?? undefined,
    emoji: e.emoji ?? undefined,
    style: (e.style as RolePanelEntry['style']) ?? undefined,
    position: e.position ?? i,
  }))
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    mode: row.mode as PanelMode,
    behavior: row.behavior as PanelBehavior,
    limitCount: row.limit_count ?? undefined,
    embed: (row.embed_data ? JSON.parse(row.embed_data) : {}) as StoredEmbed,
    entries,
  }
}

export const rolePanelStore = {
  /** Crée un panneau vierge et renvoie son ID. */
  create(guildId: string): number {
    const now = Date.now()
    const info = insertPanel.run(guildId, now, now)
    return Number(info.lastInsertRowid)
  },

  get(id: number): RolePanel | null {
    const row = selectPanel.get(id) as PanelRow | undefined
    return row ? rowToPanel(row) : null
  },

  getByMessage(guildId: string, messageId: string): RolePanel | null {
    const row = selectPanelByMessage.get(guildId, messageId) as PanelRow | undefined
    return row ? rowToPanel(row) : null
  },

  list(guildId: string): RolePanel[] {
    return (selectPanelsByGuild.all(guildId) as unknown as PanelRow[]).map(rowToPanel)
  },

  /** Sauvegarde config + entrées d'un panneau. */
  save(panel: RolePanel): void {
    updatePanel.run(
      panel.channelId ?? null,
      panel.messageId ?? null,
      panel.mode,
      panel.behavior,
      panel.limitCount ?? null,
      JSON.stringify(panel.embed),
      Date.now(),
      panel.id,
    )
    deleteEntries.run(panel.id)
    panel.entries.forEach((e, i) => {
      insertEntry.run(panel.id, e.roleId, e.label, e.description ?? null, e.emoji ?? null, e.style ?? null, e.position ?? i)
    })
  },

  setPublished(id: number, channelId: string, messageId: string): void {
    setPublishedStmt.run(channelId, messageId, Date.now(), id)
  },

  delete(id: number): boolean {
    return deletePanelStmt.run(id).changes > 0
  },
}
