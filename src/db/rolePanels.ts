import { db } from './index'
import type { EntryStyle, GroupBehavior, GroupType, PanelData, RoleGroup, RolePanel } from '../features/roles/types'

interface PanelRow {
  id: number
  guild_id: string
  channel_id: string | null
  message_id: string | null
  mode: string | null
  behavior: string | null
  limit_count: number | null
  embed_data: string | null
  data: string | null
}

interface LegacyEntryRow {
  role_id: string
  label: string | null
  description: string | null
  emoji: string | null
  style: string | null
  position: number
}

const insertPanel = db.prepare('INSERT INTO role_panels (guild_id, data, created_at, updated_at) VALUES (?, ?, ?, ?)')
const updatePanel = db.prepare('UPDATE role_panels SET channel_id=?, message_id=?, data=?, updated_at=? WHERE id=?')
const selectPanel = db.prepare('SELECT * FROM role_panels WHERE id = ?')
const selectByMessage = db.prepare('SELECT * FROM role_panels WHERE guild_id = ? AND message_id = ?')
const selectByGuild = db.prepare('SELECT * FROM role_panels WHERE guild_id = ? ORDER BY id DESC')
const deletePanelStmt = db.prepare('DELETE FROM role_panels WHERE id = ?')
const setPublishedStmt = db.prepare('UPDATE role_panels SET channel_id=?, message_id=?, updated_at=? WHERE id=?')
const legacyEntries = db.prepare('SELECT * FROM role_panel_entries WHERE panel_id = ? ORDER BY position ASC')

function emptyData(): PanelData {
  return { embed: {}, groups: [], linkButtons: [] }
}

/** Reconstruit un panneau multi-groupes depuis l'ancien format (1 liste de rôles → 1 groupe). */
function legacyToData(row: PanelRow): PanelData {
  const entries = (legacyEntries.all(row.id) as unknown as LegacyEntryRow[]).map(e => ({
    roleId: e.role_id,
    label: e.label ?? 'Rôle',
    description: e.description ?? undefined,
    emoji: e.emoji ?? undefined,
    style: (e.style as EntryStyle | null) ?? undefined,
  }))
  const group: RoleGroup = {
    type: (row.mode as GroupType) ?? 'buttons',
    behavior: (row.behavior as GroupBehavior) ?? 'normal',
    limitCount: row.limit_count ?? undefined,
    entries,
  }
  return {
    embed: row.embed_data ? JSON.parse(row.embed_data) : {},
    groups: entries.length ? [group] : [],
    linkButtons: [],
  }
}

function rowToPanel(row: PanelRow): RolePanel {
  let data: PanelData
  if (row.data) {
    data = JSON.parse(row.data) as PanelData
  } else {
    data = legacyToData(row)
    updatePanel.run(row.channel_id, row.message_id, JSON.stringify(data), Date.now(), row.id) // persiste la migration
  }
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    embed: data.embed ?? {},
    groups: data.groups ?? [],
    linkButtons: data.linkButtons ?? [],
  }
}

export const rolePanelStore = {
  create(guildId: string): number {
    const now = Date.now()
    const info = insertPanel.run(guildId, JSON.stringify(emptyData()), now, now)
    return Number(info.lastInsertRowid)
  },

  get(id: number): RolePanel | null {
    const row = selectPanel.get(id) as PanelRow | undefined
    return row ? rowToPanel(row) : null
  },

  getByMessage(guildId: string, messageId: string): RolePanel | null {
    const row = selectByMessage.get(guildId, messageId) as PanelRow | undefined
    return row ? rowToPanel(row) : null
  },

  list(guildId: string): RolePanel[] {
    return (selectByGuild.all(guildId) as unknown as PanelRow[]).map(rowToPanel)
  },

  save(panel: RolePanel): void {
    const data: PanelData = { embed: panel.embed, groups: panel.groups, linkButtons: panel.linkButtons }
    updatePanel.run(panel.channelId ?? null, panel.messageId ?? null, JSON.stringify(data), Date.now(), panel.id)
  },

  setPublished(id: number, channelId: string, messageId: string): void {
    setPublishedStmt.run(channelId, messageId, Date.now(), id)
  },

  delete(id: number): boolean {
    return deletePanelStmt.run(id).changes > 0
  },
}
