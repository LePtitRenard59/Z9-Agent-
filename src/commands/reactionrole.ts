import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'
import { startRoleBuilder } from '../features/roles/builder'

/**
 * /reactionrole — ouvre un éditeur interactif (menus + boutons) pour créer et
 * publier un panneau de rôles, entièrement depuis Discord. Réservé au staff.
 */
export const reactionRole: Command = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Créer un panneau de rôles (éditeur interactif)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    await startRoleBuilder(interaction)
  },
}
