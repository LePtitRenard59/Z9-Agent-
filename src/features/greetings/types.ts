import type { StoredEmbed } from '../embeds/types'

export type GreetingKind = 'welcome' | 'goodbye'

export interface GreetingConfig {
  enabled: boolean
  channelId?: string
  useEmbed: boolean
  content: string
  embed: StoredEmbed
}

export const KIND_LABELS: Record<GreetingKind, string> = {
  welcome: 'Bienvenue',
  goodbye: 'Au revoir',
}

export function defaultGreeting(kind: GreetingKind): GreetingConfig {
  return kind === 'welcome'
    ? { enabled: false, useEmbed: false, content: 'Bienvenue {user} sur **{server}** ! 🎉 Tu es le/la **{membercount}ᵉ** membre.', embed: { title: 'Bienvenue !', description: 'Content de t’accueillir {user} sur **{server}** 🎉' } }
    : { enabled: false, useEmbed: false, content: '**{username}** a quitté le serveur. À bientôt 👋', embed: { title: 'Au revoir', description: '**{username}** nous a quittés. On était **{membercount}** membres.' } }
}
