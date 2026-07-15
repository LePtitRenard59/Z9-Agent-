import type { StoredEmbed } from '../embeds/types'

export type PanelMode = 'buttons' | 'select' | 'reactions'
export type PanelBehavior = 'normal' | 'unique' | 'add_only' | 'limit'

export type EntryStyle = 'primary' | 'secondary' | 'success' | 'danger'

export interface RolePanelEntry {
  roleId: string
  label: string
  description?: string
  emoji?: string
  style?: EntryStyle
  position: number
}

export interface RolePanel {
  id: number
  guildId: string
  channelId?: string
  messageId?: string
  mode: PanelMode
  behavior: PanelBehavior
  limitCount?: number
  embed: StoredEmbed
  entries: RolePanelEntry[]
}

export const MODE_LABELS: Record<PanelMode, string> = {
  buttons: 'Boutons',
  select: 'Menu déroulant',
  reactions: 'Réactions',
}

export const BEHAVIOR_LABELS: Record<PanelBehavior, string> = {
  normal: 'Normal (ajout/retrait libre)',
  unique: 'Unique (un seul rôle du panneau)',
  add_only: 'Ajout seul (pas de retrait)',
  limit: 'Limité (max N rôles)',
}
