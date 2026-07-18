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
  avatar: string
  serverIcon: string
}

/** Remplace les variables dans un texte. */
export function applyVars(text: string, v: GreetingVars): string {
  return text
    .replace(/\{user\}/g, v.userMention)
    .replace(/\{username\}/g, v.username)
    .replace(/\{tag\}/g, v.tag)
    .replace(/\{server_icon\}/g, v.serverIcon)
    .replace(/\{server\}/g, v.server)
    .replace(/\{membercount\}/g, String(v.memberCount))
    .replace(/\{avatar\}/g, v.avatar)
}

function subOpt(text: string | undefined, v: GreetingVars): string | undefined {
  return text === undefined ? undefined : applyVars(text, v)
}

/** Applique les variables à TOUS les champs de l'embed (titre, auteur, footer, image, champs…). */
function substituteEmbed(e: StoredEmbed, v: GreetingVars): StoredEmbed {
  return {
    ...e,
    title: subOpt(e.title, v),
    description: subOpt(e.description, v),
    url: subOpt(e.url, v),
    image: subOpt(e.image, v),
    thumbnail: subOpt(e.thumbnail, v),
    author: e.author ? { name: applyVars(e.author.name, v), iconURL: subOpt(e.author.iconURL, v), url: subOpt(e.author.url, v) } : undefined,
    footer: e.footer ? { text: applyVars(e.footer.text, v), iconURL: subOpt(e.footer.iconURL, v) } : undefined,
    fields: e.fields ? e.fields.map(f => ({ name: applyVars(f.name, v), value: applyVars(f.value, v), inline: f.inline })) : undefined,
  }
}

/** Construit le message final (variables remplacées partout). Null si rien à envoyer. */
export function buildGreetingMessage(cfg: GreetingConfig, v: GreetingVars): BaseMessageOptions | null {
  const content = cfg.content ? applyVars(cfg.content, v) : undefined
  if (!cfg.useEmbed) {
    return content ? { content } : null
  }
  const embed = buildEmbed(substituteEmbed(cfg.embed, v))
  if (!embed && !content) return null
  return { content, embeds: embed ? [embed] : [] }
}
