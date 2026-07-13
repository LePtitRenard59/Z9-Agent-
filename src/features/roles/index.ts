import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
} from 'discord.js'
import { Z9_COLOR } from '../../config'

export interface RoleEntry {
  roleId: string
  label: string
  style: ButtonStyle
}

/** Brouillon d'un panneau de rôles, en cours d'édition dans /reactionrole. */
export interface RoleDraft {
  title: string
  description: string
  channelId?: string
  roles: RoleEntry[]
}

/** Construit le message final (embed + boutons de rôles) à publier. */
export function buildRolePanel(draft: RoleDraft): BaseMessageOptions {
  const embed = new EmbedBuilder().setColor(Z9_COLOR).setTitle(draft.title || 'Rôles')
  if (draft.description) embed.setDescription(draft.description)

  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = []
  for (let i = 0; i < draft.roles.length; i += 5) {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    for (const role of draft.roles.slice(i, i + 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role:toggle:${role.roleId}`)
          .setLabel(role.label)
          .setStyle(role.style),
      )
    }
    rows.push(row)
  }
  return { embeds: [embed], components: rows }
}

/** Ajoute ou retire le rôle quand un membre clique un bouton d'un panneau publié. */
export async function handleRoleButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Action possible uniquement sur le serveur.', ephemeral: true })
    return
  }

  const roleId = interaction.customId.split(':')[2]
  const role = interaction.guild.roles.cache.get(roleId) ?? (await interaction.guild.roles.fetch(roleId).catch(() => null))
  if (!role) {
    await interaction.reply({ content: '❌ Ce rôle n’existe plus.', ephemeral: true })
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
