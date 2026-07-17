import type { StoredEmbed } from '../embeds/types'

export interface TicketCategory {
  key: string
  label: string
  emoji?: string
  description?: string
  intro?: string
}

export interface TicketPanelConfig {
  embed: StoredEmbed
  categories: TicketCategory[]
  staffRoleId?: string
  parentCategoryId?: string
  logsChannelId?: string
}

export interface TicketPanel {
  id: number
  guildId: string
  channelId?: string
  messageId?: string
  config: TicketPanelConfig
}

export type TicketStatus = 'open' | 'closed'

export interface Ticket {
  id: number
  guildId: string
  channelId: string
  userId: string
  categoryKey: string
  claimedBy?: string
  status: TicketStatus
  createdAt: number
  closedAt?: number
}

export function emptyPanelConfig(): TicketPanelConfig {
  return {
    embed: { title: '🎫 Ouvrir un ticket', description: 'Choisis une catégorie ci-dessous pour contacter le staff.' },
    categories: [],
  }
}
