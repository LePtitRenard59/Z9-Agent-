import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
  type MessageActionRowComponentBuilder,
} from 'discord.js'
import { Z9_COLOR } from '../../config'
import { buildEmbed } from '../embeds/render'
import { safeEmoji } from '../roles/render'
import type { FaqButtonStyle, FaqPanel } from './types'

const STYLE_MAP: Record<FaqButtonStyle, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
}

/** Message publié du panneau FAQ : embed + boutons (max 25). */
export function buildFaqPanelMessage(panel: FaqPanel): BaseMessageOptions {
  const embed =
    buildEmbed(panel.embed) ??
    new EmbedBuilder().setColor(Z9_COLOR).setTitle('📖 FAQ').setDescription('Clique sur un bouton pour afficher la réponse.')

  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = []
  const buttons = panel.buttons.slice(0, 25)
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    for (let j = i; j < Math.min(i + 5, buttons.length); j++) {
      const b = buttons[j]
      const btn = new ButtonBuilder().setCustomId(`faq:b:${panel.id}:${j}`).setLabel(b.label).setStyle(STYLE_MAP[b.style])
      const emoji = safeEmoji(b.emoji)
      if (emoji) btn.setEmoji(emoji)
      row.addComponents(btn)
    }
    rows.push(row)
  }

  return { content: panel.embed.content || undefined, embeds: [embed], components: rows }
}
