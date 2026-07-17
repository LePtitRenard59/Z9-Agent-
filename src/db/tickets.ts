import { db } from './index'
import type { Ticket, TicketStatus } from '../features/tickets/types'

interface TicketRow {
  id: number
  guild_id: string
  channel_id: string
  user_id: string
  category_key: string
  claimed_by: string | null
  status: string
  created_at: number
  closed_at: number | null
}

const insertStmt = db.prepare('INSERT INTO tickets (guild_id, channel_id, user_id, category_key, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
const byChannelStmt = db.prepare('SELECT * FROM tickets WHERE channel_id = ?')
const openByUserStmt = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND category_key = ? AND status = 'open'")
const openByUserAnyStmt = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'")
const setClaimedStmt = db.prepare('UPDATE tickets SET claimed_by = ? WHERE id = ?')
const setClosedStmt = db.prepare("UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?")

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    userId: row.user_id,
    categoryKey: row.category_key,
    claimedBy: row.claimed_by ?? undefined,
    status: row.status as TicketStatus,
    createdAt: row.created_at,
    closedAt: row.closed_at ?? undefined,
  }
}

export const ticketStore = {
  create(guildId: string, channelId: string, userId: string, categoryKey: string): number {
    return Number(insertStmt.run(guildId, channelId, userId, categoryKey, 'open', Date.now()).lastInsertRowid)
  },
  getByChannel(channelId: string): Ticket | null {
    const row = byChannelStmt.get(channelId) as TicketRow | undefined
    return row ? toTicket(row) : null
  },
  getOpenByUser(guildId: string, userId: string, categoryKey: string): Ticket | null {
    const row = openByUserStmt.get(guildId, userId, categoryKey) as TicketRow | undefined
    return row ? toTicket(row) : null
  },
  countOpenByUser(guildId: string, userId: string): number {
    return (openByUserAnyStmt.all(guildId, userId) as unknown as TicketRow[]).length
  },
  setClaimed(id: number, staffId: string): void {
    setClaimedStmt.run(staffId, id)
  },
  setClosed(id: number): void {
    setClosedStmt.run(Date.now(), id)
  },
}
