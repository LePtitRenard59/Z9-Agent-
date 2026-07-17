import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type BaseMessageOptions,
  type MessageActionRowComponentBuilder,
} from 'discord.js'
import { Z9_COLOR } from '../../config'
import { buildEmbed, isHttpUrl } from '../embeds/render'
import type { EntryStyle, RoleGroup, RolePanel } from './types'

const STYLE_MAP: Record<EntryStyle, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
}

/** Retourne l'emoji s'il est valide (unicode / <:name:id> / id), sinon undefined. */
export function safeEmoji(e?: string): string | undefined {
  if (!e) return undefined
  const s = e.trim()
  if (/^<a?:\w+:\d+>$/.test(s)) return s
  if (/^\d{17,20}$/.test(s)) return s
  if (/[^\x00-\x7F]/.test(s)) return s
  return undefined
}

type Row = ActionRowBuilder<MessageActionRowComponentBuilder>

/** Rangées de composants pour un groupe (menu ou boutons ; réactions → aucune). */
function groupRows(panelId: number, group: RoleGroup, idx: number): Row[] {
  const entries = group.entries
  if (entries.length === 0) return []

  if (group.type === 'select') {
    const max =
      group.behavior === 'unique'
        ? 1
        : group.behavior === 'limit' && group.limitCount
          ? Math.min(group.limitCount, entries.length)
          : entries.length
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`rr:s:${panelId}:${idx}`)
      .setPlaceholder(group.placeholder || 'Choisis tes rôles…')
      .setMinValues(0)
      .setMaxValues(Math.max(1, max))
      .addOptions(
        entries.slice(0, 25).map(e => {
          const emoji = safeEmoji(e.emoji)
          return {
            label: e.label,
            value: e.roleId,
            ...(e.description ? { description: e.description } : {}),
            ...(emoji ? { emoji } : {}),
          }
        }),
      )
    return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu)]
  }

  if (group.type === 'buttons') {
    const rows: Row[] = []
    for (let i = 0; i < entries.length; i += 5) {
      const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
      for (const e of entries.slice(i, i + 5)) {
        const btn = new ButtonBuilder()
          .setCustomId(`rr:b:${panelId}:${idx}:${e.roleId}`)
          .setLabel(e.label)
          .setStyle(STYLE_MAP[e.style ?? 'secondary'])
        const emoji = safeEmoji(e.emoji)
        if (emoji) btn.setEmoji(emoji)
        row.addComponents(btn)
      }
      rows.push(row)
    }
    return rows
  }

  return [] // réactions : ajoutées au message après l'envoi
}

/** Message publié d'un panneau : embed + rangées des groupes + boutons-liens (max 5 rangées). */
export function buildPanelMessage(panel: RolePanel): BaseMessageOptions {
  const embed =
    buildEmbed(panel.embed) ??
    new EmbedBuilder().setColor(Z9_COLOR).setTitle('Choisis tes rôles').setDescription('Utilise les menus ci-dessous.')

  const components: Row[] = []
  panel.groups.forEach((group, idx) => components.push(...groupRows(panel.id, group, idx)))

  const validLinks = panel.linkButtons.filter(b => isHttpUrl(b.url))
  for (let i = 0; i < validLinks.length; i += 5) {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    for (const b of validLinks.slice(i, i + 5)) {
      const btn = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(b.url)
      const emoji = safeEmoji(b.emoji)
      if (emoji) btn.setEmoji(emoji)
      row.addComponents(btn)
    }
    components.push(row)
  }

  return { content: panel.embed.content || undefined, embeds: [embed], components: components.slice(0, 5) }
}

/** Nombre de rangées qu'occuperait le panneau (pour respecter la limite de 5). */
export function countRows(panel: RolePanel): number {
  let n = 0
  panel.groups.forEach((group, idx) => (n += groupRows(panel.id, group, idx).length))
  const validLinks = panel.linkButtons.filter(b => isHttpUrl(b.url))
  n += Math.ceil(validLinks.length / 5)
  return n
}
