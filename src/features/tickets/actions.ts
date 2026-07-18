import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
  type StringSelectMenuInteraction,
  type TextChannel,
} from 'discord.js'
import { Z9_COLOR, config } from '../../config'
import { ticketPanelStore } from '../../db/ticketPanels'
import { ticketStore } from '../../db/tickets'
import { buildWelcomeMessage } from './render'
import { generateTranscript } from './transcript'
import type { TicketCategory } from './types'

/** Ouverture d'un ticket depuis le menu du panneau. */
export async function onOpenTicket(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) return
  const panel = ticketPanelStore.getByMessage(interaction.guildId, interaction.message.id)
  if (!panel) {
    await interaction.reply({ content: '❌ Panneau de tickets introuvable.', ephemeral: true })
    return
  }
  const category = panel.config.categories.find(c => c.key === interaction.values[0])
  if (!category) {
    await interaction.reply({ content: '❌ Catégorie inconnue.', ephemeral: true })
    return
  }

  const existing = ticketStore.getOpenByUser(interaction.guildId, interaction.user.id, category.key)
  if (existing) {
    await interaction.reply({ content: `⚠️ Tu as déjà un ticket ouvert : <#${existing.channelId}>`, ephemeral: true })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  const guild = interaction.guild
  const staffRoleIds = panel.config.staffRoleIds
  const staffAllow = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles]
  try {
    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) || `ticket-${Date.now()}`,
      type: ChannelType.GuildText,
      parent: panel.config.parentCategoryId || undefined,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
        },
        ...staffRoleIds.map(roleId => ({ id: roleId, allow: staffAllow })),
        {
          id: interaction.client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
        },
      ],
    })

    const ticketId = ticketStore.create(guild.id, channel.id, interaction.user.id, category.key)
    await channel.send(buildWelcomeMessage(ticketId, category, interaction.user.id, staffRoleIds))
    await interaction.editReply({ content: `✅ Ton ticket a été créé : <#${channel.id}>` })
  } catch (error) {
    console.error('Erreur création ticket :', error)
    await interaction.editReply({ content: '❌ Impossible de créer le ticket (permissions du bot ? catégorie parent valide ?).' })
  }
}

/** Prise en charge d'un ticket (staff). */
export async function onClaimTicket(interaction: ButtonInteraction): Promise<void> {
  const ticket = ticketStore.getByChannel(interaction.channelId)
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true })
    return
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true })
    return
  }
  ticketStore.setClaimed(ticket.id, interaction.user.id)

  const panel = ticketPanelStore.getByGuild(interaction.guildId as string)
  const category = panel?.config.categories.find(c => c.key === ticket.categoryKey) ?? ({ key: ticket.categoryKey, label: 'Ticket' } as TicketCategory)
  await interaction.update(buildWelcomeMessage(ticket.id, category, ticket.userId, panel?.config.staffRoleIds ?? [], interaction.user.id))
  await interaction.followUp({ content: `🙋 Ticket pris en charge par <@${interaction.user.id}>.`, ephemeral: false }).catch(() => undefined)
}

/** Demande de fermeture (confirmation). */
export async function onCloseTicket(interaction: ButtonInteraction): Promise<void> {
  const ticket = ticketStore.getByChannel(interaction.channelId)
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true })
    return
  }
  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
  if (!isStaff && ticket.userId !== interaction.user.id) {
    await interaction.reply({ content: '❌ Tu n’es pas autorisé à fermer ce ticket.', ephemeral: true })
    return
  }
  const confirm = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`tkt:closeconfirm:${ticket.id}`).setLabel('Confirmer la fermeture').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  )
  await interaction.reply({ content: 'Fermer ce ticket ? Le salon sera archivé (transcript) puis supprimé.', components: [confirm], ephemeral: true })
}

/** Fermeture confirmée : transcript + suppression du salon. */
export async function onCloseConfirm(interaction: ButtonInteraction): Promise<void> {
  const ticket = ticketStore.getByChannel(interaction.channelId)
  if (!ticket || ticket.status === 'closed') {
    await interaction.update({ content: '⚠️ Ticket déjà fermé.', components: [] }).catch(() => undefined)
    return
  }
  await interaction.update({ content: '🔒 Fermeture en cours…', components: [] })

  const channel = interaction.channel as TextChannel
  ticketStore.setClosed(ticket.id)

  try {
    const attachment = await generateTranscript(channel, ticket.id)
    const panel = ticketPanelStore.getByGuild(interaction.guildId as string)
    const logsId = panel?.config.logsChannelId || config.channels.logs
    if (logsId && interaction.guild) {
      const logs = interaction.guild.channels.cache.get(logsId)
      if (logs?.isTextBased() && 'send' in logs) {
        const embed = new EmbedBuilder()
          .setColor(Z9_COLOR)
          .setTitle(`🎫 Ticket #${ticket.id} fermé`)
          .setDescription(`Ouvert par <@${ticket.userId}>${ticket.claimedBy ? ` · pris par <@${ticket.claimedBy}>` : ''}\nFermé par <@${interaction.user.id}>`)
          .setTimestamp()
        await logs.send({ embeds: [embed], files: [attachment] }).catch(() => undefined)
      }
    }
  } catch (error) {
    console.error('Erreur transcript :', error)
  }

  setTimeout(() => {
    channel.delete().catch(() => undefined)
  }, 3000)
}
