import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'
import { rolePanelStore } from '../db/rolePanels'
import { MODE_LABELS } from '../features/roles/types'
import { startRoleBuilder } from '../features/roles/builder'

/**
 * /reactionrole — panneaux de rôles (boutons / menu / réactions), configurés
 * entièrement depuis Discord. Réservé au staff (Gérer les rôles).
 */
export const reactionRole: Command = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Panneaux de rôles (boutons, menu ou réactions)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('create').setDescription('Créer un panneau de rôles (éditeur interactif)'))
    .addSubcommand(s => s.setName('list').setDescription('Lister les panneaux du serveur'))
    .addSubcommand(s =>
      s.setName('delete').setDescription('Supprimer un panneau')
        .addIntegerOption(o => o.setName('id').setDescription('ID du panneau (voir /reactionrole list)').setRequired(true)),
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
      return
    }
    const sub = interaction.options.getSubcommand()

    if (sub === 'create') {
      await startRoleBuilder(interaction)
      return
    }

    if (sub === 'list') {
      const panels = rolePanelStore.list(interaction.guildId)
      if (!panels.length) {
        await interaction.reply({ content: 'Aucun panneau. Crée-en un avec `/reactionrole create`.', ephemeral: true })
        return
      }
      const lines = panels.map(p => `\`#${p.id}\` · ${MODE_LABELS[p.mode]} · ${p.entries.length} rôle(s)${p.channelId ? ` · <#${p.channelId}>` : ''}`)
      await interaction.reply({ content: `📋 Panneaux :\n${lines.join('\n')}`, ephemeral: true })
      return
    }

    if (sub === 'delete') {
      const id = interaction.options.getInteger('id', true)
      const panel = rolePanelStore.get(id)
      if (!panel || panel.guildId !== interaction.guildId) {
        await interaction.reply({ content: `❌ Aucun panneau \`#${id}\`.`, ephemeral: true })
        return
      }
      // Tente de supprimer le message publié
      if (panel.channelId && panel.messageId) {
        const channel = await interaction.guild?.channels.fetch(panel.channelId).catch(() => null)
        if (channel?.isTextBased() && 'messages' in channel) {
          await channel.messages.delete(panel.messageId).catch(() => undefined)
        }
      }
      rolePanelStore.delete(id)
      await interaction.reply({ content: `🗑️ Panneau \`#${id}\` supprimé.`, ephemeral: true })
    }
  },
}
