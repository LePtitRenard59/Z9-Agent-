import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'
import { buildPanelMessage, getPanel } from '../features/roles'
import { rolePanels } from '../features/roles/panels'

/**
 * /setup-roles — publie un panneau de rôles à boutons dans le salon courant.
 * Réservé au staff (permission « Gérer les rôles »).
 */
export const setupRoles: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-roles')
    .setDescription('Publier un panneau de rôles à boutons dans ce salon')
    .addStringOption(option =>
      option
        .setName('panneau')
        .setDescription('Quel panneau publier')
        .setRequired(true)
        .addChoices(...rolePanels.map(panel => ({ name: panel.key, value: panel.key }))),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const key = interaction.options.getString('panneau', true)
    const panel = getPanel(key)
    if (!panel) {
      await interaction.reply({ content: '❌ Panneau inconnu.', ephemeral: true })
      return
    }

    const message = buildPanelMessage(panel)
    if (!message.components || message.components.length === 0) {
      await interaction.reply({
        content: '❌ Aucun rôle configuré pour ce panneau (les `roleId` sont vides dans `panels.ts`).',
        ephemeral: true,
      })
      return
    }

    const channel = interaction.channel
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      await interaction.reply({ content: '❌ Ce salon ne permet pas de publier de message.', ephemeral: true })
      return
    }

    await channel.send(message)
    await interaction.reply({ content: '✅ Panneau de rôles publié.', ephemeral: true })
  },
}
