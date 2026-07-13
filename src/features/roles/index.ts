import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
  type ButtonInteraction,
} from 'discord.js'
import { Z9_COLOR } from '../../config'
import { rolePanels, type RolePanel } from './panels'

export function getPanel(key: string): RolePanel | undefined {
  return rolePanels.find(panel => panel.key === key)
}

/** Construit l'embed + les boutons d'un panneau de rôles (5 boutons max par ligne). */
export function buildPanelMessage(panel: RolePanel): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setColor(Z9_COLOR)
    .setTitle(panel.title)
    .setDescription(panel.description)

  const usable = panel.roles.filter(role => role.roleId)
  const rows: ActionRowBuilder<ButtonBuilder>[] = []

  for (let i = 0; i < usable.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>()
    for (const role of usable.slice(i, i + 5)) {
      const button = new ButtonBuilder()
        .setCustomId(`role:toggle:${role.roleId}`)
        .setLabel(role.label)
        .setStyle(role.style ?? ButtonStyle.Secondary)
      if (role.emoji) button.setEmoji(role.emoji)
      row.addComponents(button)
    }
    rows.push(row)
  }

  return { embeds: [embed], components: rows }
}

/** Ajoute ou retire le rôle quand un membre clique un bouton du panneau. */
export async function handleRoleButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Action possible uniquement sur le serveur.', ephemeral: true })
    return
  }

  const roleId = interaction.customId.split(':')[2]
  const role = interaction.guild.roles.cache.get(roleId) ?? (await interaction.guild.roles.fetch(roleId).catch(() => null))
  if (!role) {
    await interaction.reply({ content: '❌ Rôle introuvable — vérifie la config (panels.ts).', ephemeral: true })
    return
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
  if (!member) {
    await interaction.reply({ content: '❌ Impossible de récupérer ton profil membre.', ephemeral: true })
    return
  }

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId)
      await interaction.reply({ content: `➖ Rôle **${role.name}** retiré.`, ephemeral: true })
    } else {
      await member.roles.add(roleId)
      await interaction.reply({ content: `➕ Rôle **${role.name}** ajouté.`, ephemeral: true })
    }
  } catch (error) {
    console.error('Erreur lors du changement de rôle :', error)
    await interaction.reply({
      content: "❌ Je n'ai pas pu modifier ce rôle. Vérifie que **mon rôle est au-dessus** de ce rôle dans la hiérarchie du serveur.",
      ephemeral: true,
    })
  }
}
