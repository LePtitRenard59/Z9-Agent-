import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js'
import { rolePanelStore } from '../../db/rolePanels'
import { applySelect, logRoleChange, summarize, toggleButton } from './apply'

/** Clic sur un bouton de rôle (customId rr:b:<panelId>:<groupIdx>:<roleId>). */
export async function onPanelButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return
  const parts = interaction.customId.split(':')
  const panel = rolePanelStore.get(Number(parts[2]))
  const group = panel?.groups[Number(parts[3])]
  const roleId = parts[4]
  if (!panel || !group) {
    await interaction.reply({ content: '❌ Ce panneau n’existe plus.', ephemeral: true })
    return
  }
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
  if (!member) {
    await interaction.reply({ content: '❌ Profil membre introuvable.', ephemeral: true })
    return
  }
  try {
    const res = await toggleButton(member, group, roleId)
    await interaction.reply({ content: summarize(res, id => interaction.guild!.roles.cache.get(id)?.name ?? 'rôle'), ephemeral: true })
    await logRoleChange(member, res)
  } catch (error) {
    console.error('Erreur bouton rôle :', error)
    await interaction.reply({ content: '❌ Modification impossible — mon rôle est-il **au-dessus** de ces rôles ?', ephemeral: true })
  }
}

/** Sélection dans un menu de rôles (customId rr:s:<panelId>:<groupIdx>). */
export async function onPanelSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild) return
  const parts = interaction.customId.split(':')
  const panel = rolePanelStore.get(Number(parts[2]))
  const group = panel?.groups[Number(parts[3])]
  if (!panel || !group) {
    await interaction.reply({ content: '❌ Ce panneau n’existe plus.', ephemeral: true })
    return
  }
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
  if (!member) {
    await interaction.reply({ content: '❌ Profil membre introuvable.', ephemeral: true })
    return
  }
  try {
    const res = await applySelect(member, group, interaction.values)
    await interaction.reply({ content: summarize(res, id => interaction.guild!.roles.cache.get(id)?.name ?? 'rôle'), ephemeral: true })
    await logRoleChange(member, res)
  } catch (error) {
    console.error('Erreur menu rôle :', error)
    await interaction.reply({ content: '❌ Modification impossible — mon rôle est-il **au-dessus** de ces rôles ?', ephemeral: true })
  }
}
