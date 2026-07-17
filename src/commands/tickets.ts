import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'
import { ticketPanelStore } from '../db/ticketPanels'
import { startTicketBuilder, startTicketBuilderEdit } from '../features/tickets/builder'

/**
 * /tickets — panneaux de tickets (config 100 % Discord). Réservé au staff.
 */
export const tickets: Command = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Panneaux de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(s => s.setName('panel').setDescription('Créer un panneau de tickets (éditeur interactif)'))
    .addSubcommand(s =>
      s.setName('edit').setDescription('Modifier un panneau')
        .addIntegerOption(o => o.setName('id').setDescription('ID (voir /tickets list)').setRequired(true)),
    )
    .addSubcommand(s => s.setName('list').setDescription('Lister les panneaux'))
    .addSubcommand(s =>
      s.setName('delete').setDescription('Supprimer un panneau')
        .addIntegerOption(o => o.setName('id').setDescription('ID (voir /tickets list)').setRequired(true)),
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
      return
    }
    const sub = interaction.options.getSubcommand()

    if (sub === 'panel') {
      await startTicketBuilder(interaction)
      return
    }
    if (sub === 'edit') {
      const id = interaction.options.getInteger('id', true)
      const panel = ticketPanelStore.get(id)
      if (!panel || panel.guildId !== interaction.guildId) {
        await interaction.reply({ content: `❌ Aucun panneau \`#${id}\`.`, ephemeral: true })
        return
      }
      await startTicketBuilderEdit(interaction, panel)
      return
    }
    if (sub === 'list') {
      const panels = ticketPanelStore.list(interaction.guildId)
      if (!panels.length) {
        await interaction.reply({ content: 'Aucun panneau. Crée-en un avec `/tickets panel`.', ephemeral: true })
        return
      }
      const lines = panels.map(p => `\`#${p.id}\` · ${p.config.categories.length} catégorie(s)${p.channelId ? ` · <#${p.channelId}>` : ''}`)
      await interaction.reply({ content: `🎫 Panneaux :\n${lines.join('\n')}`, ephemeral: true })
      return
    }
    if (sub === 'delete') {
      const id = interaction.options.getInteger('id', true)
      const panel = ticketPanelStore.get(id)
      if (!panel || panel.guildId !== interaction.guildId) {
        await interaction.reply({ content: `❌ Aucun panneau \`#${id}\`.`, ephemeral: true })
        return
      }
      if (panel.channelId && panel.messageId) {
        const channel = await interaction.guild?.channels.fetch(panel.channelId).catch(() => null)
        if (channel?.isTextBased() && 'messages' in channel) await channel.messages.delete(panel.messageId).catch(() => undefined)
      }
      ticketPanelStore.delete(id)
      await interaction.reply({ content: `🗑️ Panneau \`#${id}\` supprimé.`, ephemeral: true })
    }
  },
}
