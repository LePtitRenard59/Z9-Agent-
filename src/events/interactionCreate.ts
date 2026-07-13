import type { Interaction } from 'discord.js'
import { commandMap } from '../commands'
import { handleEmbedModal } from '../commands/embed'
import { handleRoleButton } from '../features/roles'

/**
 * Routeur central des interactions : slash-commands, modals, boutons, menus.
 * Les nouvelles fonctionnalités (tickets, rôles, report…) brancheront leurs
 * boutons/modals ici via leur préfixe de customId.
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

    // Soumissions de modals (customId au format "prefixe:action:…")
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('embed:publish:')) {
        await handleEmbedModal(interaction)
      }
      return
    }

    // Boutons
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('role:toggle:')) {
        await handleRoleButton(interaction)
      }
      return
    }

    // À venir : menus déroulants (faq), boutons tickets…
    // if (interaction.isStringSelectMenu()) { … }
  } catch (error) {
    console.error('Erreur lors du traitement d’une interaction :', error)
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: '❌ Une erreur est survenue.', ephemeral: true })
        .catch(() => undefined)
    }
  }
}
