import type { StoredEmbed } from '../embeds/types'

export type FaqButtonStyle = 'primary' | 'secondary' | 'success' | 'danger'

export interface FaqButton {
  label: string
  emoji?: string
  style: FaqButtonStyle
  /** Réponse affichée en éphémère au clic. */
  answer: StoredEmbed
}

export interface FaqData {
  embed: StoredEmbed
  buttons: FaqButton[]
}

export interface FaqPanel {
  id: number
  guildId: string
  channelId?: string
  messageId?: string
  embed: StoredEmbed
  buttons: FaqButton[]
}

export const FAQ_STYLE_LABELS: Record<FaqButtonStyle, string> = {
  primary: 'Bleu',
  secondary: 'Gris',
  success: 'Vert',
  danger: 'Rouge',
}

export function emptyFaq(): FaqData {
  return {
    embed: { title: '📖 FAQ', description: 'Clique sur un bouton ci-dessous pour afficher la réponse.' },
    buttons: [],
  }
}

export function emptyButton(): FaqButton {
  return { label: 'Nouveau bouton', style: 'secondary', answer: { title: 'Réponse', description: 'À compléter…' } }
}
