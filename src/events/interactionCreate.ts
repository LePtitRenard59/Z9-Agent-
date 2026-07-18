import type { Interaction } from 'discord.js'
import { commandMap } from '../commands'
import {
  onAddRoleToGroup,
  onBack,
  onBuilderClose,
  onBuilderModal,
  onBuilderPublish,
  onChannel,
  onDeleteGroup,
  onGopt,
  onMain,
  onPanelButton,
  onPanelSelect,
  onPickEmbed,
} from '../features/roles'
import {
  onEditorClose,
  onEditorModal,
  onEditorPublishHere,
  onEditorSave,
  onPartSelect,
} from '../features/embeds/editor'
import {
  onOpenTicket,
  onClaimTicket,
  onCloseTicket,
  onCloseConfirm,
  onStaff,
  onParent,
  onLogs,
  onMain as onTicketMain,
  onTicketModal,
  onTicketPublish,
  onTicketClose,
} from '../features/tickets'
import { onReportAction, onReportMessage, onReportModal, onReportUser } from '../features/report/report'
import { onGrtChannel, onGrtClose, onGrtModal, onGrtOpt, onGrtToggle } from '../features/greetings'

/**
 * Routeur central des interactions : slash-commands, modals, boutons, menus.
 * Préfixes : emb:* (embed builder) · rrg:* (éditeur de panneau) · rr:* (panneau publié).
 */
export async function onInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName)
      if (command) await command.execute(interaction)
      return
    }

    // Menus contextuels (clic droit)
    if (interaction.isMessageContextMenuCommand()) {
      if (interaction.commandName === 'Signaler le message') await onReportMessage(interaction)
      return
    }
    if (interaction.isUserContextMenuCommand()) {
      if (interaction.commandName === 'Signaler le membre') await onReportUser(interaction)
      return
    }

    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId
      if (id === 'emb:part') await onPartSelect(interaction)
      else if (id === 'rrg:main') await onMain(interaction)
      else if (id === 'rrg:gopt') await onGopt(interaction)
      else if (id === 'rrg:embed') await onPickEmbed(interaction)
      else if (id.startsWith('rr:s:')) await onPanelSelect(interaction)
      else if (id === 'tkt:open') await onOpenTicket(interaction)
      else if (id === 'tk:main') await onTicketMain(interaction)
      else if (id === 'grt:opt') await onGrtOpt(interaction)
      return
    }

    if (interaction.isRoleSelectMenu()) {
      const id = interaction.customId
      if (id === 'rrg:addrole') await onAddRoleToGroup(interaction)
      else if (id === 'tk:staff') await onStaff(interaction)
      return
    }

    if (interaction.isChannelSelectMenu()) {
      const id = interaction.customId
      if (id === 'rrg:channel') await onChannel(interaction)
      else if (id === 'tk:parent') await onParent(interaction)
      else if (id === 'tk:logs') await onLogs(interaction)
      else if (id === 'grt:channel') await onGrtChannel(interaction)
      return
    }

    if (interaction.isButton()) {
      const id = interaction.customId
      if (id.startsWith('rr:b:')) await onPanelButton(interaction)
      else if (id === 'rrg:back') await onBack(interaction)
      else if (id === 'rrg:delgroup') await onDeleteGroup(interaction)
      else if (id === 'rrg:publish') await onBuilderPublish(interaction)
      else if (id === 'rrg:close') await onBuilderClose(interaction)
      else if (id === 'emb:save') await onEditorSave(interaction)
      else if (id === 'emb:publishhere') await onEditorPublishHere(interaction)
      else if (id === 'emb:close') await onEditorClose(interaction)
      else if (id.startsWith('tkt:claim:')) await onClaimTicket(interaction)
      else if (id.startsWith('tkt:closeconfirm:')) await onCloseConfirm(interaction)
      else if (id.startsWith('tkt:close:')) await onCloseTicket(interaction)
      else if (id === 'tk:publish') await onTicketPublish(interaction)
      else if (id === 'tk:close') await onTicketClose(interaction)
      else if (id === 'report:handled' || id === 'report:ignore') await onReportAction(interaction)
      else if (id === 'grt:toggle') await onGrtToggle(interaction)
      else if (id === 'grt:close') await onGrtClose(interaction)
      return
    }

    if (interaction.isModalSubmit()) {
      const id = interaction.customId
      if (id.startsWith('rrg:m:')) await onBuilderModal(interaction)
      else if (id.startsWith('emb:m:')) await onEditorModal(interaction)
      else if (id.startsWith('tk:m:')) await onTicketModal(interaction)
      else if (id.startsWith('report:')) await onReportModal(interaction)
      else if (id.startsWith('grt:m:')) await onGrtModal(interaction)
      return
    }
  } catch (error) {
    console.error('Erreur lors du traitement d’une interaction :', error)
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => undefined)
    }
  }
}
