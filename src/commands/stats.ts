import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'
import { statsStore } from '../db/stats'
import { createStats, removeStats, updateGuildStats } from '../features/stats/service'

export const stats: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Salons statistiques (membres, boosts, invitation)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(s => s.setName('setup').setDescription('Créer les salons de statistiques'))
    .addSubcommand(s => s.setName('refresh').setDescription('Forcer la mise à jour maintenant'))
    .addSubcommand(s => s.setName('remove').setDescription('Supprimer les salons de statistiques')),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
      return
    }
    const sub = interaction.options.getSubcommand()

    if (sub === 'setup') {
      if (statsStore.get(interaction.guild.id)) {
        await interaction.reply({ content: '⚠️ Déjà configuré. Fais `/stats remove` d’abord si tu veux recréer.', ephemeral: true })
        return
      }
      await interaction.deferReply({ ephemeral: true })
      try {
        await createStats(interaction.guild)
        await interaction.editReply('✅ Salons de statistiques créés (catégorie **📊 Statistiques**). Ils se mettent à jour automatiquement (~10 min).')
      } catch (error) {
        console.error('Erreur setup stats :', error)
        await interaction.editReply('❌ Création impossible — le bot a-t-il la permission **Gérer les salons** ?')
      }
      return
    }

    if (sub === 'refresh') {
      if (!statsStore.get(interaction.guild.id)) {
        await interaction.reply({ content: '❌ Non configuré. Fais `/stats setup`.', ephemeral: true })
        return
      }
      await interaction.deferReply({ ephemeral: true })
      await updateGuildStats(interaction.guild)
      await interaction.editReply('🔄 Statistiques mises à jour.')
      return
    }

    if (sub === 'remove') {
      if (!statsStore.get(interaction.guild.id)) {
        await interaction.reply({ content: '❌ Non configuré.', ephemeral: true })
        return
      }
      await interaction.deferReply({ ephemeral: true })
      await removeStats(interaction.guild)
      await interaction.editReply('🗑️ Salons de statistiques supprimés.')
    }
  },
}
