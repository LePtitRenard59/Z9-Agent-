import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type RoleSelectMenuInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { Z9_COLOR } from '../../config'
import { ticketPanelStore } from '../../db/ticketPanels'
import { buildEmbed, isHttpUrl } from '../embeds/render'
import { buildTicketPanelMessage } from './render'
import { emptyPanelConfig, type TicketPanel, type TicketPanelConfig } from './types'

const MAX_CATEGORIES = 20

interface TicketDraft {
  guildId: string
  panelId?: number
  messageId?: string
  origChannelId?: string
  publishChannelId?: string
  config: TicketPanelConfig
  editingCategory?: number
}

const drafts = new Map<string, TicketDraft>()

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
function genKey(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}
function parseColor(input: string): number | undefined {
  const s = input.trim().toLowerCase()
  const named: Record<string, number> = { rouge: 0xed4245, vert: 0x57f287, bleu: 0x5865f2, jaune: 0xfee75c, orange: 0xe67e22, rose: 0xeb459e, violet: 0x9b59b6, blanc: 0xffffff, noir: 0x2b2d31, gris: 0x95a5a6 }
  if (named[s] !== undefined) return named[s]
  const hex = s.replace('#', '')
  if (/^[0-9a-f]{6}$/.test(hex)) return parseInt(hex, 16)
  return undefined
}

function render(draft: TicketDraft): BaseMessageOptions {
  const preview = buildEmbed(draft.config.embed) ?? new EmbedBuilder().setColor(Z9_COLOR).setDescription('*(apparence par défaut)*')
  const c = draft.config
  const catLines = c.categories.length
    ? c.categories.map((cat, i) => `\`${i + 1}.\` ${cat.emoji ? cat.emoji + ' ' : ''}**${cat.label}**${cat.description ? ` — ${cat.description}` : ''}`).join('\n')
    : '_aucune — ajoutes-en une_'
  const summary = [
    '🎫 **Éditeur de panneau de tickets**',
    `Rôles staff : ${c.staffRoleIds.length ? c.staffRoleIds.map(id => `<@&${id}>`).join(' ') : '_non défini_'}`,
    `Catégorie parent : ${c.parentCategoryId ? `<#${c.parentCategoryId}>` : '_non défini (salons à la racine)_'}`,
    `Salon des transcripts : ${c.logsChannelId ? `<#${c.logsChannelId}>` : '_non défini_'}`,
    `**Catégories de ticket :**\n${catLines}`,
  ].join('\n')

  const staffRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new RoleSelectMenuBuilder().setCustomId('tk:staff').setPlaceholder('🛡️ Rôles staff (qui voient les tickets)…').setMinValues(0).setMaxValues(10),
  )
  const parentRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('tk:parent').setPlaceholder('📁 Catégorie parent des tickets…').addChannelTypes(ChannelType.GuildCategory).setMinValues(0).setMaxValues(1),
  )
  const logsRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('tk:logs').setPlaceholder('📄 Salon des transcripts…').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(0).setMaxValues(1),
  )
  const mainRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('tk:main').setPlaceholder('⚙️ Configurer…').addOptions(
      { label: 'Apparence (titre, couleur, image…)', value: 'app', emoji: '🎨' },
      { label: 'Ajouter une catégorie', value: 'addcat', emoji: '➕' },
      ...c.categories.map((cat, i) => ({ label: `Éditer : ${cat.label}`.slice(0, 90), value: `cat:${i}`, emoji: '✏️' })),
      { label: 'Retirer une catégorie', value: 'removecat', emoji: '🗑️' },
    ),
  )
  const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('tk:publish').setLabel(draft.panelId ? 'Mettre à jour' : 'Publier ici').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tk:close').setLabel('Fermer').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  )

  return { content: summary, embeds: [preview], components: [staffRow, parentRow, logsRow, mainRow, buttonRow] }
}

async function expired(interaction: RoleSelectMenuInteraction | ChannelSelectMenuInteraction | StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  await interaction.reply({ content: '⌛ Éditeur expiré. Relance `/tickets panel`.', ephemeral: true }).catch(() => undefined)
}

export async function startTicketBuilder(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
    return
  }
  const draft: TicketDraft = { guildId: interaction.guildId, publishChannelId: interaction.channelId ?? undefined, config: emptyPanelConfig() }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...render(draft), ephemeral: true })
}

export async function startTicketBuilderEdit(interaction: ChatInputCommandInteraction, panel: TicketPanel): Promise<void> {
  const draft: TicketDraft = {
    guildId: panel.guildId,
    panelId: panel.id,
    messageId: panel.messageId,
    origChannelId: panel.channelId,
    publishChannelId: panel.channelId ?? interaction.channelId ?? undefined,
    config: clone(panel.config),
  }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...render(draft), ephemeral: true })
}

export async function onStaff(interaction: RoleSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.config.staffRoleIds = [...interaction.values]
  await interaction.update(render(draft))
}
export async function onParent(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.config.parentCategoryId = interaction.values[0] || undefined
  await interaction.update(render(draft))
}
export async function onLogs(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.config.logsChannelId = interaction.values[0] || undefined
  await interaction.update(render(draft))
}

function categoryModal(customId: string, values?: { label?: string; emoji?: string; description?: string; intro?: string }): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(customId).setTitle('Catégorie de ticket')
  const add = (id: string, label: string, style: TextInputStyle, value?: string, required = false, max?: number) =>
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      (() => { const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required); if (value) t.setValue(value); if (max) t.setMaxLength(max); return t })()))
  add('label', 'Nom de la catégorie', TextInputStyle.Short, values?.label, true, 80)
  add('emoji', 'Emoji (optionnel)', TextInputStyle.Short, values?.emoji, false, 60)
  add('description', 'Description (optionnel)', TextInputStyle.Short, values?.description, false, 100)
  add('intro', 'Message d’accueil du ticket', TextInputStyle.Paragraph, values?.intro, false, 1000)
  return modal
}

export async function onMain(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const v = interaction.values[0]

  if (v === 'app') {
    const modal = new ModalBuilder().setCustomId('tk:m:app').setTitle('Apparence du panneau')
    const add = (id: string, label: string, style: TextInputStyle, value?: string, ph?: string) =>
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false).setValue(value ?? '').setPlaceholder(ph ?? '')))
    add('title', 'Titre', TextInputStyle.Short, draft.config.embed.title)
    add('description', 'Description', TextInputStyle.Paragraph, draft.config.embed.description)
    add('color', 'Couleur (#E8943A ou nom)', TextInputStyle.Short, typeof draft.config.embed.color === 'number' ? '#' + draft.config.embed.color.toString(16).padStart(6, '0') : '')
    add('image', 'Image / bannière (URL)', TextInputStyle.Short, draft.config.embed.image, 'https://…')
    await interaction.showModal(modal)
    return
  }
  if (v === 'addcat') {
    if (draft.config.categories.length >= MAX_CATEGORIES) {
      await interaction.reply({ content: '❌ Trop de catégories.', ephemeral: true })
      return
    }
    draft.editingCategory = undefined
    await interaction.showModal(categoryModal('tk:m:addcat'))
    return
  }
  if (v === 'removecat') {
    if (!draft.config.categories.length) {
      await interaction.reply({ content: '❌ Aucune catégorie.', ephemeral: true })
      return
    }
    const modal = new ModalBuilder().setCustomId('tk:m:removecat').setTitle('Retirer une catégorie')
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('index').setLabel(`Numéro (1 à ${draft.config.categories.length})`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2)))
    await interaction.showModal(modal)
    return
  }
  if (v.startsWith('cat:')) {
    const idx = Number(v.slice(4))
    const cat = draft.config.categories[idx]
    if (!cat) return
    draft.editingCategory = idx
    await interaction.showModal(categoryModal('tk:m:editcat', cat))
  }
}

export async function onTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const part = interaction.customId.split(':')[2]
  const val = (id: string) => interaction.fields.getTextInputValue(id).trim()

  if (part === 'app') {
    draft.config.embed.title = val('title') || undefined
    draft.config.embed.description = val('description') || undefined
    const raw = val('color')
    if (raw) {
      const c = parseColor(raw)
      if (c === undefined) { await interaction.reply({ content: '❌ Couleur non reconnue.', ephemeral: true }); return }
      draft.config.embed.color = c
    } else draft.config.embed.color = undefined
    const img = val('image')
    draft.config.embed.image = img && isHttpUrl(img) ? img : undefined
  } else if (part === 'addcat') {
    draft.config.categories.push({ key: genKey(), label: val('label').slice(0, 80), emoji: val('emoji') || undefined, description: val('description') || undefined, intro: val('intro') || undefined })
  } else if (part === 'editcat' && draft.editingCategory !== undefined) {
    const cat = draft.config.categories[draft.editingCategory]
    if (cat) {
      cat.label = val('label').slice(0, 80) || cat.label
      cat.emoji = val('emoji') || undefined
      cat.description = val('description') || undefined
      cat.intro = val('intro') || undefined
    }
  } else if (part === 'removecat') {
    const idx = parseInt(val('index'), 10) - 1
    if (idx < 0 || idx >= draft.config.categories.length) { await interaction.reply({ content: '❌ Numéro invalide.', ephemeral: true }); return }
    draft.config.categories.splice(idx, 1)
  }

  if (interaction.isFromMessage()) await interaction.update(render(draft))
  else await interaction.reply({ content: '✅ Mis à jour.', ephemeral: true })
}

export async function onTicketPublish(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  if (draft.config.categories.length === 0) {
    await interaction.reply({ content: '❌ Ajoute au moins une catégorie.', ephemeral: true })
    return
  }
  const channelId = draft.publishChannelId
  if (!channelId) {
    await interaction.reply({ content: '❌ Salon de publication introuvable (relance la commande dans un salon).', ephemeral: true })
    return
  }
  const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null)
  if (!channel || !channel.isTextBased() || !('send' in channel) || !('messages' in channel)) {
    await interaction.reply({ content: '❌ Salon de publication invalide.', ephemeral: true })
    return
  }

  const id = draft.panelId ?? ticketPanelStore.create(draft.guildId, draft.config)
  const panel: TicketPanel = { id, guildId: draft.guildId, channelId, messageId: draft.messageId, config: draft.config }
  ticketPanelStore.save(panel)

  const editInPlace = draft.panelId && draft.messageId && draft.origChannelId === channelId
  let message
  try {
    if (editInPlace) {
      const existing = await channel.messages.fetch(draft.messageId as string).catch(() => null)
      message = existing ? await existing.edit(buildTicketPanelMessage(panel)) : await channel.send(buildTicketPanelMessage(panel))
    } else {
      message = await channel.send(buildTicketPanelMessage(panel))
    }
  } catch (error) {
    console.error('Erreur publication panneau tickets :', error)
    await interaction.reply({ content: '❌ Publication impossible (permissions du bot ?).', ephemeral: true })
    return
  }
  ticketPanelStore.setPublished(id, channelId, message.id)
  drafts.delete(interaction.user.id)
  await interaction.update({ content: `✅ Panneau de tickets ${draft.panelId ? 'mis à jour' : 'publié'} dans <#${channelId}> !`, embeds: [], components: [] })
}

export async function onTicketClose(interaction: ButtonInteraction): Promise<void> {
  drafts.delete(interaction.user.id)
  await interaction.update({ content: '✅ Éditeur fermé.', embeds: [], components: [] })
}
