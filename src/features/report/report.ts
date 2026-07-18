import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type UserContextMenuCommandInteraction,
} from 'discord.js'
import { config } from '../../config'

const REPORT_COLOR = 0xed4245
const COOLDOWN_MS = 30_000
const cooldowns = new Map<string, number>()

/** Commandes contextuelles (clic droit). */
export const reportMessageCommand = new ContextMenuCommandBuilder().setName('Signaler le message').setType(ApplicationCommandType.Message)
export const reportUserCommand = new ContextMenuCommandBuilder().setName('Signaler le membre').setType(ApplicationCommandType.User)

function reasonModal(customId: string, title: string): ModalBuilder {
  return new ModalBuilder().setCustomId(customId).setTitle(title).addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Raison (optionnel)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000),
    ),
  )
}

export async function onReportMessage(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const msg = interaction.targetMessage
  await interaction.showModal(reasonModal(`report:msg:${msg.channelId}:${msg.id}`, 'Signaler le message'))
}

export async function onReportUser(interaction: UserContextMenuCommandInteraction): Promise<void> {
  await interaction.showModal(reasonModal(`report:user:${interaction.targetUser.id}`, 'Signaler le membre'))
}

export async function onReportModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) return

  const last = cooldowns.get(interaction.user.id) ?? 0
  const remaining = COOLDOWN_MS - (Date.now() - last)
  if (remaining > 0) {
    await interaction.reply({ content: `⏳ Patiente ${Math.ceil(remaining / 1000)}s avant un nouveau signalement.`, ephemeral: true })
    return
  }

  const reportsId = config.channels.reports
  const channel = reportsId ? interaction.guild.channels.cache.get(reportsId) : undefined
  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    await interaction.reply({ content: '❌ Le salon de signalements n’est pas configuré (`CHANNEL_REPORTS` dans `.env`).', ephemeral: true })
    return
  }

  const reason = interaction.fields.getTextInputValue('reason').trim() || '_non précisée_'
  const parts = interaction.customId.split(':')
  const embed = new EmbedBuilder().setColor(REPORT_COLOR).setTimestamp().setFooter({ text: `Signalé par ${interaction.user.tag}` })

  if (parts[1] === 'msg') {
    const channelId = parts[2]
    const messageId = parts[3]
    const src = interaction.guild.channels.cache.get(channelId)
    let authorMention = 'inconnu'
    let content = ''
    if (src?.isTextBased()) {
      const m = await src.messages.fetch(messageId).catch(() => null)
      if (m) {
        authorMention = `<@${m.author.id}>`
        content = m.content
      }
    }
    const link = `https://discord.com/channels/${interaction.guildId}/${channelId}/${messageId}`
    embed
      .setTitle('🚨 Signalement — message')
      .addFields(
        { name: 'Signalé par', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Auteur du message', value: authorMention, inline: true },
        { name: 'Salon', value: `<#${channelId}>`, inline: true },
        { name: 'Raison', value: reason },
        { name: 'Message', value: `${content ? content.slice(0, 500) : '_pas de texte_'}\n[Aller au message](${link})` },
      )
  } else {
    embed
      .setTitle('🚨 Signalement — membre')
      .addFields(
        { name: 'Signalé par', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Membre signalé', value: `<@${parts[2]}>`, inline: true },
        { name: 'Raison', value: reason },
      )
  }

  const actions = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('report:handled').setLabel('Marquer traité').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('report:ignore').setLabel('Ignorer').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
  )

  await channel.send({ embeds: [embed], components: [actions] })
  cooldowns.set(interaction.user.id, Date.now())
  await interaction.reply({ content: '✅ Ton signalement a été transmis au staff. Merci.', ephemeral: true })
}

/** Boutons staff sur un signalement : marquer traité / ignorer. */
export async function onReportAction(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true })
    return
  }
  const handled = interaction.customId === 'report:handled'
  const source = interaction.message.embeds[0]
  const embed = source ? EmbedBuilder.from(source) : new EmbedBuilder()
  embed.setColor(handled ? 0x57f287 : 0x95a5a6)
  embed.addFields({ name: handled ? '✅ Traité par' : '🚫 Ignoré par', value: `<@${interaction.user.id}>` })
  await interaction.update({ embeds: [embed], components: [] })
}
