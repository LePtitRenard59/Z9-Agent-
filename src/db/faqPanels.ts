import { db } from './index'
import type { FaqData, FaqPanel } from '../features/faq/types'

interface PanelRow {
  id: number
  guild_id: string
  channel_id: string | null
  message_id: string | null
  data: string
}

const insertStmt = db.prepare('INSERT INTO faq_panels (guild_id, data, created_at, updated_at) VALUES (?, ?, ?, ?)')
const updateStmt = db.prepare('UPDATE faq_panels SET channel_id=?, message_id=?, data=?, updated_at=? WHERE id=?')
const selectStmt = db.prepare('SELECT * FROM faq_panels WHERE id = ?')
const byMessageStmt = db.prepare('SELECT * FROM faq_panels WHERE guild_id = ? AND message_id = ?')
const byGuildStmt = db.prepare('SELECT * FROM faq_panels WHERE guild_id = ? ORDER BY id DESC')
const setPublishedStmt = db.prepare('UPDATE faq_panels SET channel_id=?, message_id=?, updated_at=? WHERE id=?')
const deleteStmt = db.prepare('DELETE FROM faq_panels WHERE id = ?')

function toPanel(row: PanelRow): FaqPanel {
  const data = JSON.parse(row.data) as FaqData
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    embed: data.embed ?? {},
    buttons: data.buttons ?? [],
  }
}

export const faqPanelStore = {
  create(guildId: string, data: FaqData): number {
    const now = Date.now()
    return Number(insertStmt.run(guildId, JSON.stringify(data), now, now).lastInsertRowid)
  },
  get(id: number): FaqPanel | null {
    const row = selectStmt.get(id) as PanelRow | undefined
    return row ? toPanel(row) : null
  },
  getByMessage(guildId: string, messageId: string): FaqPanel | null {
    const row = byMessageStmt.get(guildId, messageId) as PanelRow | undefined
    return row ? toPanel(row) : null
  },
  list(guildId: string): FaqPanel[] {
    return (byGuildStmt.all(guildId) as unknown as PanelRow[]).map(toPanel)
  },
  save(panel: FaqPanel): void {
    const data: FaqData = { embed: panel.embed, buttons: panel.buttons }
    updateStmt.run(panel.channelId ?? null, panel.messageId ?? null, JSON.stringify(data), Date.now(), panel.id)
  },
  setPublished(id: number, channelId: string, messageId: string): void {
    setPublishedStmt.run(channelId, messageId, Date.now(), id)
  },
  delete(id: number): boolean {
    return deleteStmt.run(id).changes > 0
  },
}
