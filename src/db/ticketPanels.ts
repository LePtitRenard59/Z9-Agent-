import { db } from './index'
import type { TicketPanel, TicketPanelConfig } from '../features/tickets/types'

interface PanelRow {
  id: number
  guild_id: string
  channel_id: string | null
  message_id: string | null
  data: string
}

const insertStmt = db.prepare('INSERT INTO ticket_panels (guild_id, data, created_at, updated_at) VALUES (?, ?, ?, ?)')
const updateStmt = db.prepare('UPDATE ticket_panels SET channel_id=?, message_id=?, data=?, updated_at=? WHERE id=?')
const selectStmt = db.prepare('SELECT * FROM ticket_panels WHERE id = ?')
const byMessageStmt = db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ? AND message_id = ?')
const byGuildStmt = db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ? ORDER BY id DESC')
const setPublishedStmt = db.prepare('UPDATE ticket_panels SET channel_id=?, message_id=?, updated_at=? WHERE id=?')
const deleteStmt = db.prepare('DELETE FROM ticket_panels WHERE id = ?')

function toPanel(row: PanelRow): TicketPanel {
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    config: JSON.parse(row.data) as TicketPanelConfig,
  }
}

export const ticketPanelStore = {
  create(guildId: string, config: TicketPanelConfig): number {
    const now = Date.now()
    return Number(insertStmt.run(guildId, JSON.stringify(config), now, now).lastInsertRowid)
  },
  get(id: number): TicketPanel | null {
    const row = selectStmt.get(id) as PanelRow | undefined
    return row ? toPanel(row) : null
  },
  getByMessage(guildId: string, messageId: string): TicketPanel | null {
    const row = byMessageStmt.get(guildId, messageId) as PanelRow | undefined
    return row ? toPanel(row) : null
  },
  list(guildId: string): TicketPanel[] {
    return (byGuildStmt.all(guildId) as unknown as PanelRow[]).map(toPanel)
  },
  /** Panneau le plus récent d'une guilde (source de la config staff/logs/catégorie). */
  getByGuild(guildId: string): TicketPanel | null {
    const row = byGuildStmt.get(guildId) as PanelRow | undefined
    return row ? toPanel(row) : null
  },
  save(panel: TicketPanel): void {
    updateStmt.run(panel.channelId ?? null, panel.messageId ?? null, JSON.stringify(panel.config), Date.now(), panel.id)
  },
  setPublished(id: number, channelId: string, messageId: string): void {
    setPublishedStmt.run(channelId, messageId, Date.now(), id)
  },
  delete(id: number): boolean {
    return deleteStmt.run(id).changes > 0
  },
}
