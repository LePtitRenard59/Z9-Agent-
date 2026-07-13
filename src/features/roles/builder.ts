import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type RoleSelectMenuInteraction,
} from 'discord.js'
import { Z9_COLOR } from '../../config'
import { buildRolePanel, type RoleDraft } from './index'

const MAX_ROLES = 25

/** Brouillons en cours, un par utilisateur (transitoire, en mémoire). */
const drafts = new Map<string, RoleDraft>()

/** Rendu du panneau d'édition (message éphémère avec menus + boutons). */
function renderBuilder(draft: RoleDraft): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setColor(Z9_COLOR)
    .setTitle('🎭 Éditeur de panneau de rôles')
    .setDescription('Configure ton panneau ci-dessous, puis clique **Publier**.')
    .addFields(
      { name: 'Titre', value: draft.title || '_(par défaut)_' },
      { name: 'Description', value: draft.description || '_(vide)_' },
      {
        name: `Rôles (${draft.roles.length})`,
        value: draft.roles.length ? draft.roles.map(r => `• ${r.label}`).join('\n') : '_aucun — choisis-en dans le menu ci-dessous_',
      },
      { name: 'Salon de publication', value: draft.channelId ? `<#${draft.channelId}>` : '_non défini_' },
    )

  const roleRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('rrb:addrole')
      .setPlaceholder('➕ Ajouter des rôles au panneau…')
      .setMinValues(0)
      .setMaxValues(10),
  )

  const channelRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('rrb:channel')
      .setPlaceholder('📢 Salon où publier le panneau…')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  )

  const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rrb:edittext').setLabel('Titre & description').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rrb:reset').setLabel('Vider les rôles').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rrb:publish').setLabel('Publier').setEmoji('✅').setStyle(ButtonStyle.Success),
  )

  return { embeds: [embed], components: [roleRow, channelRow, buttonRow] }
}

async function draftExpired(interaction: ButtonInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
  await interaction.reply({ content: '⌛ Session d’édition expirée. Relance `/reactionrole`.', ephemeral: true }).catch(() => undefined)
}

/** /reactionrole — démarre un nouvel éditeur. */
export async function startRoleBuilder(interaction: ChatInputCommandInteraction): Promise<void> {
  const draft: RoleDraft = {
    title: 'Choisis tes rôles',
    description: 'Clique sur un bouton pour recevoir ou retirer un rôle.',
    roles: [],
  }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...renderBuilder(draft), ephemeral: true })
}

export async function onAddRole(interaction: RoleSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return draftExpired(interaction)

  for (const [roleId, role] of interaction.roles) {
    if (draft.roles.length >= MAX_ROLES) break
    if (draft.roles.some(r => r.roleId === roleId)) continue
    draft.roles.push({ roleId, label: role.name.slice(0, 80), style: ButtonStyle.Secondary })
  }
  await interaction.update(renderBuilder(draft))
}

export async function onPickChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return draftExpired(interaction)

  draft.channelId = interaction.values[0]
  await interaction.update(renderBuilder(draft))
}

export async function onEditTextButton(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return draftExpired(interaction)

  const modal = new ModalBuilder().setCustomId('rrb:textmodal').setTitle('Titre & description')
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Titre du panneau')
        .setStyle(TextInputStyle.Short)
        .setValue(draft.title)
        .setRequired(true)
        .setMaxLength(200),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(draft.description)
        .setRequired(false)
        .setMaxLength(2000),
    ),
  )
  await interaction.showModal(modal)
}

export async function onEditTextModal(interaction: ModalSubmitInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return draftExpired(interaction)

  draft.title = interaction.fields.getTextInputValue('title')
  draft.description = interaction.fields.getTextInputValue('description')

  if (interaction.isFromMessage()) {
    await interaction.update(renderBuilder(draft))
  } else {
    await interaction.reply({ content: '✅ Titre et description mis à jour.', ephemeral: true })
  }
}

export async function onResetRoles(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return draftExpired(interaction)

  draft.roles = []
  await interaction.update(renderBuilder(draft))
}

export async function onPublish(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return draftExpired(interaction)

  if (draft.roles.length === 0) {
    await interaction.reply({ content: '❌ Ajoute au moins un rôle avant de publier.', ephemeral: true })
    return
  }
  if (!draft.channelId) {
    await interaction.reply({ content: '❌ Choisis d’abord un salon de publication.', ephemeral: true })
    return
  }

  const channel = await interaction.guild?.channels.fetch(draft.channelId).catch(() => null)
  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    await interaction.reply({ content: '❌ Salon de publication invalide.', ephemeral: true })
    return
  }

  await channel.send(buildRolePanel(draft))
  drafts.delete(interaction.user.id)
  await interaction.update({ content: `✅ Panneau publié dans <#${draft.channelId}> !`, embeds: [], components: [] })
}
