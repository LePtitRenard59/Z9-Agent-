import type { BaseMessageOptions } from 'discord.js'
import { buildEmbed } from '../embeds/render'
import type { StoredEmbed } from '../embeds/types'
import type { GreetingConfig } from './types'

export interface GreetingVars {
  userMention: string
  username: string
  tag: string
  server: string
  memberCount: number
}

export function applyVars(text: string, v: GreetingVars): string {
  return text
    .replace(/\{user\}/g, v.userMention)
    .replace(/\{username\}/g, v.username)
    .replace(/\{tag\}/g, v.tag)
    .replace(/\{server\}/g, v.server)
    .replace(/\{membercount\}/g, String(v.memberCount))
}

/** Construit le message final (variables remplacées). Vide si rien à envoyer. */
export function buildGreetingMessage(cfg: GreetingConfig, v: GreetingVars): BaseMessageOptions | null {
  const content = cfg.content ? applyVars(cfg.content, v) : undefined
  if (!cfg.useEmbed) {
    return content ? { content } : null
  }
  const e: StoredEmbed = {
    ...cfg.embed,
    title: cfg.embed.title ? applyVars(cfg.embed.title, v) : undefined,
    description: cfg.embed.description ? applyVars(cfg.embed.description, v) : undefined,
  }
  const embed = buildEmbed(e)
  if (!embed && !content) return null
  return { content, embeds: embed ? [embed] : [] }
}
