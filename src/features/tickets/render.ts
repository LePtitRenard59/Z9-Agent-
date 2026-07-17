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
import { safeEmoji } from '../roles/render'
import type { TicketCategory, TicketPanel } from './types'

/** Message du panneau de tickets : embed + menu des catégories. */
export function buildTicketPanelMessage(panel: TicketPanel): BaseMessageOptions {
  const embed =
    buildEmbed(panel.config.embed) ??
    new EmbedBuilder().setColor(Z9_COLOR).setTitle('🎫 Ouvrir un ticket').setDescription('Choisis une catégorie ci-dessous.')

  const menu = new StringSelectMenuBuilder()
    .setCustomId('tkt:open')
    .setPlaceholder('🎫 Ouvrir un ticket…')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      panel.config.categories.slice(0, 25).map(c => {
        const emoji = safeEmoji(c.emoji)
        return { label: c.label, value: c.key, ...(c.description ? { description: c.description } : {}), ...(emoji ? { emoji } : {}) }
      }),
    )

  return {
    content: panel.config.embed.content || undefined,
    embeds: [embed],
    components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu)],
  }
}

/** Message d'accueil posté dans le salon du ticket. */
export function buildWelcomeMessage(
  ticketId: number,
  category: TicketCategory,
  openerId: string,
  staffRoleId?: string,
  claimedBy?: string,
): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setColor(Z9_COLOR)
    .setTitle(`🎫 Ticket — ${category.label}`)
    .setDescription(category.intro || 'Décris ta demande, un membre du staff va te répondre.')
    .setFooter({ text: `Ticket #${ticketId}` })
    .setTimestamp()
  if (claimedBy) embed.addFields({ name: 'Pris en charge par', value: `<@${claimedBy}>` })

  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`tkt:claim:${ticketId}`)
      .setLabel(claimedBy ? 'Pris en charge' : 'Prendre en charge')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(Boolean(claimedBy)),
    new ButtonBuilder().setCustomId(`tkt:close:${ticketId}`).setLabel('Fermer').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  )

  return {
    content: `<@${openerId}>${staffRoleId ? ` · <@&${staffRoleId}>` : ''}`,
    embeds: [embed],
    components: [row],
  }
}
