import type { Interaction } from 'discord.js'
import { commandMap } from '../commands'
import { handleEmbedModal } from '../commands/embed'
import { handleRoleButton } from '../features/roles'
import {
  onAddRole,
  onEditTextButton,
  onEditTextModal,
  onPickChannel,
  onPublish,
  onResetRoles,
} from '../features/roles/builder'

/**
 * Routeur central des interactions : slash-commands, modals, boutons, menus.
 * Chaque fonctionnalité branche ses composants ici via leur préfixe de customId.
 */
export async function onInteraction(interaction: Interaction): Promise<void> {
  try {
    // Slash-commands
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName)
      if (!command) return
      await command.execute(interaction)
      return
    }

    // Menus déroulants de rôles (éditeur reaction-roles)
    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId === 'rrb:addrole') await onAddRole(interaction)
      return
    }

    // Menus déroulants de salons (éditeur reaction-roles)
    if (interaction.isChannelSelectMenu()) {
      if (interaction.customId === 'rrb:channel') await onPickChannel(interaction)
      return
    }

    // Boutons
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('role:toggle:')) {
        await handleRoleButton(interaction)
      } else if (interaction.customId === 'rrb:edittext') {
        await onEditTextButton(interaction)
      } else if (interaction.customId === 'rrb:reset') {
        await onResetRoles(interaction)
      } else if (interaction.customId === 'rrb:publish') {
        await onPublish(interaction)
      }
      return
    }

    // Soumissions de modals
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'rrb:textmodal') {
        await onEditTextModal(interaction)
      } else if (interaction.customId.startsWith('embed:publish:')) {
        await handleEmbedModal(interaction)
      }
      return
    }
  } catch (error) {
    console.error('Erreur lors du traitement d’une interaction :', error)
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: '❌ Une erreur est survenue.', ephemeral: true })
        .catch(() => undefined)
    }
  }
}
