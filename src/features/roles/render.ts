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
import { buildEmbed } from '../embeds/render'
import type { EntryStyle, RolePanel } from './types'

const STYLE_MAP: Record<EntryStyle, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
}

/** Message publié d'un panneau (embed + composants selon le mode). */
export function buildPanelMessage(panel: RolePanel): BaseMessageOptions {
  const embed =
    buildEmbed(panel.embed) ??
    new EmbedBuilder().setColor(Z9_COLOR).setTitle('Choisis tes rôles').setDescription('Utilise les contrôles ci-dessous.')

  const entries = [...panel.entries].sort((a, b) => a.position - b.position)
  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = []

  if (panel.mode === 'buttons') {
    for (let i = 0; i < entries.length; i += 5) {
      const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
      for (const e of entries.slice(i, i + 5)) {
        const btn = new ButtonBuilder()
          .setCustomId(`rr:tgl:${panel.id}:${e.roleId}`)
          .setLabel(e.label)
          .setStyle(STYLE_MAP[e.style ?? 'secondary'])
        if (e.emoji) btn.setEmoji(e.emoji)
        row.addComponents(btn)
      }
      components.push(row)
    }
  } else if (panel.mode === 'select' && entries.length > 0) {
    const max =
      panel.behavior === 'unique'
        ? 1
        : panel.behavior === 'limit' && panel.limitCount
          ? Math.min(panel.limitCount, entries.length)
          : entries.length
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`rr:sel:${panel.id}`)
      .setPlaceholder('Choisis tes rôles…')
      .setMinValues(0)
      .setMaxValues(Math.max(1, max))
      .addOptions(
        entries.map(e => ({
          label: e.label,
          value: e.roleId,
          ...(e.description ? { description: e.description } : {}),
          ...(e.emoji ? { emoji: e.emoji } : {}),
        })),
      )
    components.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu))
  }
  // mode 'reactions' : aucun composant, les emojis sont ajoutés en réactions après l'envoi.

  return { content: panel.embed.content || undefined, embeds: [embed], components }
}
