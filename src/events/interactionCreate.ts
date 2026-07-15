import type { Interaction } from 'discord.js'
import { commandMap } from '../commands'
import {
  onAddRole,
  onBuilderClose,
  onBuilderModal,
  onBuilderPublish,
  onOpt,
  onPanelButton,
  onPanelSelect,
  onPickChannel,
} from '../features/roles'
import {
  onEditorClose,
  onEditorModal,
  onEditorPublishHere,
  onEditorSave,
  onPartSelect,
} from '../features/embeds/editor'

/**
 * Routeur central des interactions : slash-commands, modals, boutons, menus.
 * Chaque fonctionnalité branche ses composants via leur préfixe de customId.
 */
export async function onInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName)
      if (command) await command.execute(interaction)
      return
    }

    // Menus déroulants (string select)
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId
      if (id === 'emb:part') await onPartSelect(interaction)
      else if (id === 'rrb:opt') await onOpt(interaction)
      else if (id.startsWith('rr:sel:')) await onPanelSelect(interaction)
      return
    }

    // Menus de rôles (éditeur de panneau)
    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId === 'rrb:addrole') await onAddRole(interaction)
      return
    }

    // Menus de salons (éditeur de panneau)
    if (interaction.isChannelSelectMenu()) {
      if (interaction.customId === 'rrb:channel') await onPickChannel(interaction)
      return
    }

    // Boutons
    if (interaction.isButton()) {
      const id = interaction.customId
      if (id.startsWith('rr:tgl:')) await onPanelButton(interaction)
      else if (id === 'rrb:publish') await onBuilderPublish(interaction)
      else if (id === 'rrb:close') await onBuilderClose(interaction)
      else if (id === 'emb:save') await onEditorSave(interaction)
      else if (id === 'emb:publishhere') await onEditorPublishHere(interaction)
      else if (id === 'emb:close') await onEditorClose(interaction)
      return
    }

    // Soumissions de modals
    if (interaction.isModalSubmit()) {
      const id = interaction.customId
      if (id.startsWith('rrb:m:')) await onBuilderModal(interaction)
      else if (id.startsWith('emb:m:')) await onEditorModal(interaction)
      return
    }
  } catch (error) {
    console.error('Erreur lors du traitement d’une interaction :', error)
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => undefined)
    }
  }
}
