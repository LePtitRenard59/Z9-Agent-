import type { StoredEmbed } from '../embeds/types'

export type GroupType = 'select' | 'buttons' | 'reactions'
export type GroupBehavior = 'normal' | 'unique' | 'add_only' | 'limit'
export type EntryStyle = 'primary' | 'secondary' | 'success' | 'danger'

export interface RoleGroupEntry {
  roleId: string
  label: string
  description?: string
  emoji?: string
  style?: EntryStyle
}

/** Un groupe de rôles = une rangée du panneau (menu, boutons) ou des réactions. */
export interface RoleGroup {
  type: GroupType
  behavior: GroupBehavior
  limitCount?: number
  placeholder?: string
  entries: RoleGroupEntry[]
}

export interface LinkButton {
  label: string
  url: string
  emoji?: string
}

/** Un panneau = un embed riche + plusieurs groupes + des boutons-liens. */
export interface RolePanel {
  id: number
  guildId: string
  channelId?: string
  messageId?: string
  embed: StoredEmbed
  groups: RoleGroup[]
  linkButtons: LinkButton[]
}

/** Données sérialisées d'un panneau (colonne SQLite `data`). */
export interface PanelData {
  embed: StoredEmbed
  groups: RoleGroup[]
  linkButtons: LinkButton[]
}

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  select: 'Menu déroulant',
  buttons: 'Boutons',
  reactions: 'Réactions',
}

export const BEHAVIOR_LABELS: Record<GroupBehavior, string> = {
  normal: 'Normal',
  unique: 'Unique',
  add_only: 'Ajout seul',
  limit: 'Limité (N)',
}

export function emptyGroup(type: GroupType = 'select'): RoleGroup {
  return { type, behavior: 'normal', entries: [] }
}
