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
import { rolePanelStore } from '../../db/rolePanels'
import { buildEmbed, isHttpUrl } from '../embeds/render'
import type { StoredEmbed } from '../embeds/types'
import { buildPanelMessage } from './render'
import { BEHAVIOR_LABELS, MODE_LABELS, type EntryStyle, type PanelBehavior, type PanelMode, type RolePanel, type RolePanelEntry } from './types'

const MAX_ROLES = 25

interface PanelDraft {
  guildId: string
  channelId?: string
  mode: PanelMode
  behavior: PanelBehavior
  limitCount?: number
  embed: StoredEmbed
  entries: RolePanelEntry[]
}

const drafts = new Map<string, PanelDraft>()

function parseColor(input: string): number | undefined {
  const s = input.trim().toLowerCase()
  const named: Record<string, number> = {
    rouge: 0xed4245, vert: 0x57f287, bleu: 0x5865f2, jaune: 0xfee75c, orange: 0xe67e22,
    rose: 0xeb459e, violet: 0x9b59b6, blanc: 0xffffff, noir: 0x2b2d31, gris: 0x95a5a6,
  }
  if (named[s] !== undefined) return named[s]
  const hex = s.replace('#', '')
  if (/^[0-9a-f]{6}$/.test(hex)) return parseInt(hex, 16)
  return undefined
}

function parseStyle(input: string): EntryStyle {
  const s = input.trim().toLowerCase()
  if (/^(prim|bleu)/.test(s)) return 'primary'
  if (/^(succ|vert)/.test(s)) return 'success'
  if (/^(dang|roug)/.test(s)) return 'danger'
  return 'secondary'
}

function renderBuilder(draft: PanelDraft): BaseMessageOptions {
  const preview = buildEmbed(draft.embed) ?? new EmbedBuilder().setColor(Z9_COLOR).setDescription('*(apparence par défaut — règle-la via « Apparence »)*')

  const roleList = draft.entries.length
    ? draft.entries.map((e, i) => `\`${i + 1}.\` ${e.emoji ? e.emoji + ' ' : ''}**${e.label}**${e.description ? ` — ${e.description}` : ''}`).join('\n')
    : '_aucun — ajoute-en avec le menu ci-dessous_'

  const summary = [
    '🎛️ **Éditeur de panneau de rôles**',
    `Mode : **${MODE_LABELS[draft.mode]}** · Comportement : **${BEHAVIOR_LABELS[draft.behavior]}${draft.behavior === 'limit' && draft.limitCount ? ` (${draft.limitCount})` : ''}**`,
    `Salon : ${draft.channelId ? `<#${draft.channelId}>` : '_non défini_'}`,
    `Rôles (${draft.entries.length}) :\n${roleList}`,
    draft.mode === 'reactions' ? '⚠️ Mode réactions : chaque rôle doit avoir un **emoji** (via « Configurer un rôle »).' : '',
  ].filter(Boolean).join('\n')

  const roleRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new RoleSelectMenuBuilder().setCustomId('rrb:addrole').setPlaceholder('➕ Ajouter des rôles…').setMinValues(0).setMaxValues(10),
  )
  const channelRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('rrb:channel').setPlaceholder('📢 Salon de publication…').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1),
  )
  const optRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('rrb:opt').setPlaceholder('⚙️ Réglages…').addOptions(
      { label: 'Mode : Boutons', value: 'mode:buttons', emoji: '🔘' },
      { label: 'Mode : Menu déroulant', value: 'mode:select', emoji: '📋' },
      { label: 'Mode : Réactions', value: 'mode:reactions', emoji: '😀' },
      { label: 'Comportement : Normal', value: 'beh:normal', emoji: '🔁' },
      { label: 'Comportement : Unique', value: 'beh:unique', emoji: '☝️' },
      { label: 'Comportement : Ajout seul', value: 'beh:add_only', emoji: '📥' },
      { label: 'Comportement : Limité…', value: 'beh:limit', emoji: '🔢' },
      { label: 'Apparence (titre, couleur, image)…', value: 'apparence', emoji: '🎨' },
      { label: 'Configurer un rôle…', value: 'configrole', emoji: '🛠️' },
      { label: 'Retirer un rôle…', value: 'removerole', emoji: '🗑️' },
    ),
  )
  const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rrb:publish').setLabel('Publier').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rrb:close').setLabel('Fermer').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  )

  return { content: summary, embeds: [preview], components: [roleRow, channelRow, optRow, buttonRow] }
}

async function expired(interaction: RoleSelectMenuInteraction | ChannelSelectMenuInteraction | StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  await interaction.reply({ content: '⌛ Éditeur expiré. Relance `/reactionrole create`.', ephemeral: true }).catch(() => undefined)
}

export async function startRoleBuilder(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
    return
  }
  const draft: PanelDraft = {
    guildId: interaction.guildId,
    mode: 'buttons',
    behavior: 'normal',
    embed: { title: 'Choisis tes rôles', description: 'Sélectionne les rôles qui t’intéressent.' },
    entries: [],
  }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...renderBuilder(draft), ephemeral: true })
}

export async function onAddRole(interaction: RoleSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  for (const [roleId, role] of interaction.roles) {
    if (draft.entries.length >= MAX_ROLES) break
    if (draft.entries.some(e => e.roleId === roleId)) continue
    draft.entries.push({ roleId, label: role.name.slice(0, 80), position: draft.entries.length })
  }
  await interaction.update(renderBuilder(draft))
}

export async function onPickChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.channelId = interaction.values[0]
  await interaction.update(renderBuilder(draft))
}

export async function onOpt(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const v = interaction.values[0]

  if (v.startsWith('mode:')) {
    draft.mode = v.slice(5) as PanelMode
    await interaction.update(renderBuilder(draft))
    return
  }
  if (v.startsWith('beh:')) {
    const b = v.slice(4) as PanelBehavior
    if (b === 'limit') {
      const modal = new ModalBuilder().setCustomId('rrb:m:limit').setTitle('Nombre maximum de rôles')
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('limit').setLabel('Limite (nombre)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue(draft.limitCount ? String(draft.limitCount) : ''),
      ))
      await interaction.showModal(modal)
      return
    }
    draft.behavior = b
    draft.limitCount = undefined
    await interaction.update(renderBuilder(draft))
    return
  }
  if (v === 'apparence') {
    const modal = new ModalBuilder().setCustomId('rrb:m:apparence').setTitle('Apparence du panneau')
    const add = (id: string, label: string, style: TextInputStyle, value?: string, ph?: string) =>
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false).setValue(value ?? '').setPlaceholder(ph ?? '')))
    add('title', 'Titre', TextInputStyle.Short, draft.embed.title)
    add('description', 'Description', TextInputStyle.Paragraph, draft.embed.description)
    add('color', 'Couleur (#E8943A ou nom)', TextInputStyle.Short, typeof draft.embed.color === 'number' ? '#' + draft.embed.color.toString(16).padStart(6, '0') : '')
    add('image', 'Image / GIF (URL)', TextInputStyle.Short, draft.embed.image, 'https://…')
    await interaction.showModal(modal)
    return
  }
  if (v === 'configrole') {
    if (!draft.entries.length) {
      await interaction.reply({ content: '❌ Ajoute d’abord des rôles.', ephemeral: true })
      return
    }
    const modal = new ModalBuilder().setCustomId('rrb:m:configrole').setTitle('Configurer un rôle')
    const add = (id: string, label: string, style: TextInputStyle, ph?: string) =>
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(id === 'index').setPlaceholder(ph ?? '')))
    add('index', `Numéro du rôle (1 à ${draft.entries.length})`, TextInputStyle.Short)
    add('label', 'Nom affiché (laisser vide = inchangé)', TextInputStyle.Short)
    add('emoji', 'Emoji', TextInputStyle.Short, '🆕 ou :nom: custom')
    add('description', 'Description', TextInputStyle.Short)
    add('style', 'Style bouton (bleu/gris/vert/rouge)', TextInputStyle.Short, 'gris')
    await interaction.showModal(modal)
    return
  }
  if (v === 'removerole') {
    if (!draft.entries.length) {
      await interaction.reply({ content: '❌ Aucun rôle à retirer.', ephemeral: true })
      return
    }
    const modal = new ModalBuilder().setCustomId('rrb:m:removerole').setTitle('Retirer un rôle')
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('index').setLabel(`Numéro du rôle (1 à ${draft.entries.length})`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2),
    ))
    await interaction.showModal(modal)
    return
  }
}

export async function onBuilderModal(interaction: ModalSubmitInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const part = interaction.customId.split(':')[2]
  const val = (id: string) => interaction.fields.getTextInputValue(id).trim()

  if (part === 'limit') {
    const n = parseInt(val('limit'), 10)
    if (Number.isNaN(n) || n < 1) {
      await interaction.reply({ content: '❌ Nombre invalide.', ephemeral: true })
      return
    }
    draft.behavior = 'limit'
    draft.limitCount = n
  } else if (part === 'apparence') {
    draft.embed.title = val('title') || undefined
    draft.embed.description = val('description') || undefined
    const raw = val('color')
    if (raw) {
      const c = parseColor(raw)
      if (c === undefined) {
        await interaction.reply({ content: '❌ Couleur non reconnue.', ephemeral: true })
        return
      }
      draft.embed.color = c
    } else {
      draft.embed.color = undefined
    }
    const img = val('image')
    draft.embed.image = img && isHttpUrl(img) ? img : undefined
  } else if (part === 'configrole') {
    const idx = parseInt(val('index'), 10) - 1
    if (idx < 0 || idx >= draft.entries.length) {
      await interaction.reply({ content: '❌ Numéro de rôle invalide.', ephemeral: true })
      return
    }
    const entry = draft.entries[idx]
    if (val('label')) entry.label = val('label').slice(0, 80)
    entry.emoji = val('emoji') || undefined
    entry.description = val('description') || undefined
    if (val('style')) entry.style = parseStyle(val('style'))
  } else if (part === 'removerole') {
    const idx = parseInt(val('index'), 10) - 1
    if (idx < 0 || idx >= draft.entries.length) {
      await interaction.reply({ content: '❌ Numéro de rôle invalide.', ephemeral: true })
      return
    }
    draft.entries.splice(idx, 1)
    draft.entries.forEach((e, i) => (e.position = i))
  }

  if (interaction.isFromMessage()) {
    await interaction.update(renderBuilder(draft))
  } else {
    await interaction.reply({ content: '✅ Mis à jour.', ephemeral: true })
  }
}

export async function onBuilderPublish(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  if (draft.entries.length === 0) {
    await interaction.reply({ content: '❌ Ajoute au moins un rôle.', ephemeral: true })
    return
  }
  if (!draft.channelId) {
    await interaction.reply({ content: '❌ Choisis un salon de publication.', ephemeral: true })
    return
  }
  if (draft.mode === 'reactions' && draft.entries.some(e => !e.emoji)) {
    await interaction.reply({ content: '❌ En mode réactions, **chaque rôle doit avoir un emoji** (menu « Configurer un rôle »).', ephemeral: true })
    return
  }

  const channel = await interaction.guild?.channels.fetch(draft.channelId).catch(() => null)
  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    await interaction.reply({ content: '❌ Salon de publication invalide.', ephemeral: true })
    return
  }

  const id = rolePanelStore.create(draft.guildId)
  const panel: RolePanel = {
    id,
    guildId: draft.guildId,
    channelId: draft.channelId,
    mode: draft.mode,
    behavior: draft.behavior,
    limitCount: draft.limitCount,
    embed: draft.embed,
    entries: draft.entries,
  }
  rolePanelStore.save(panel)

  const message = await channel.send(buildPanelMessage(panel))
  rolePanelStore.setPublished(id, draft.channelId, message.id)

  if (draft.mode === 'reactions') {
    for (const entry of draft.entries) {
      if (entry.emoji) await message.react(entry.emoji).catch(() => undefined)
    }
  }

  drafts.delete(interaction.user.id)
  await interaction.update({ content: `✅ Panneau publié dans <#${draft.channelId}> !`, embeds: [], components: [] })
}

export async function onBuilderClose(interaction: ButtonInteraction): Promise<void> {
  drafts.delete(interaction.user.id)
  await interaction.update({ content: '✅ Éditeur fermé.', embeds: [], components: [] })
}
