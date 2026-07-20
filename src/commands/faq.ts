import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'
import { faqPanelStore } from '../db/faqPanels'
import { startFaqBuilder, startFaqBuilderEdit } from '../features/faq/builder'

export const faq: Command = {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Panneaux FAQ (embed + boutons à réponse éphémère)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('create').setDescription('Créer une FAQ (éditeur interactif)'))
    .addSubcommand(s =>
      s.setName('edit').setDescription('Modifier une FAQ')
        .addIntegerOption(o => o.setName('id').setDescription('ID (voir /faq list)').setRequired(true)),
    )
    .addSubcommand(s => s.setName('list').setDescription('Lister les FAQ'))
    .addSubcommand(s =>
      s.setName('delete').setDescription('Supprimer une FAQ')
        .addIntegerOption(o => o.setName('id').setDescription('ID (voir /faq list)').setRequired(true)),
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
      return
    }
    const sub = interaction.options.getSubcommand()

    if (sub === 'create') {
      await startFaqBuilder(interaction)
      return
    }
    if (sub === 'edit') {
      const id = interaction.options.getInteger('id', true)
      const panel = faqPanelStore.get(id)
      if (!panel || panel.guildId !== interaction.guildId) {
        await interaction.reply({ content: `❌ Aucune FAQ \`#${id}\`.`, ephemeral: true })
        return
      }
      await startFaqBuilderEdit(interaction, panel)
      return
    }
    if (sub === 'list') {
      const panels = faqPanelStore.list(interaction.guildId)
      if (!panels.length) {
        await interaction.reply({ content: 'Aucune FAQ. Crée-en une avec `/faq create`.', ephemeral: true })
        return
      }
      const lines = panels.map(p => `\`#${p.id}\` · ${p.buttons.length} bouton(s)${p.channelId ? ` · <#${p.channelId}>` : ''}`)
      await interaction.reply({ content: `📖 FAQ :\n${lines.join('\n')}`, ephemeral: true })
      return
    }
    if (sub === 'delete') {
      const id = interaction.options.getInteger('id', true)
      const panel = faqPanelStore.get(id)
      if (!panel || panel.guildId !== interaction.guildId) {
        await interaction.reply({ content: `❌ Aucune FAQ \`#${id}\`.`, ephemeral: true })
        return
      }
      if (panel.channelId && panel.messageId) {
        const channel = await interaction.guild?.channels.fetch(panel.channelId).catch(() => null)
        if (channel?.isTextBased() && 'messages' in channel) await channel.messages.delete(panel.messageId).catch(() => undefined)
      }
      faqPanelStore.delete(id)
      await interaction.reply({ content: `🗑️ FAQ \`#${id}\` supprimée.`, ephemeral: true })
    }
  },
}
