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
import { embedStore } from '../../db/embeds'
import { rolePanelStore } from '../../db/rolePanels'
import { buildEmbed, isHttpUrl } from '../embeds/render'
import type { StoredEmbed } from '../embeds/types'
import { buildPanelMessage, countRows, safeEmoji } from './render'
import {
  BEHAVIOR_LABELS,
  GROUP_TYPE_LABELS,
  emptyGroup,
  type GroupBehavior,
  type GroupType,
  type LinkButton,
  type RoleGroup,
  type RolePanel,
} from './types'

const MAX_ROWS = 5
const MAX_ROLES_PER_GROUP = 25
type Row = ActionRowBuilder<MessageActionRowComponentBuilder>

interface PanelDraft {
  guildId: string
  channelId?: string
  panelId?: number
  messageId?: string
  origChannelId?: string
  embed: StoredEmbed
  groups: RoleGroup[]
  linkButtons: LinkButton[]
  editingGroup?: number
}

const drafts = new Map<string, PanelDraft>()

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

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

function parseStyle(input: string): RoleGroup['entries'][number]['style'] {
  const s = input.trim().toLowerCase()
  if (/^(prim|bleu)/.test(s)) return 'primary'
  if (/^(succ|vert)/.test(s)) return 'success'
  if (/^(dang|roug)/.test(s)) return 'danger'
  return 'secondary'
}

function draftToPanel(draft: PanelDraft, id = 0): RolePanel {
  return {
    id,
    guildId: draft.guildId,
    channelId: draft.channelId,
    messageId: draft.messageId,
    embed: draft.embed,
    groups: draft.groups,
    linkButtons: draft.linkButtons,
  }
}

async function expired(
  interaction: RoleSelectMenuInteraction | ChannelSelectMenuInteraction | StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction,
): Promise<void> {
  await interaction.reply({ content: '⌛ Éditeur expiré. Relance `/reactionrole create`.', ephemeral: true }).catch(() => undefined)
}

/* ─────────────────────────── Rendu ─────────────────────────── */

function renderMain(draft: PanelDraft): BaseMessageOptions {
  const preview = buildEmbed(draft.embed) ?? new EmbedBuilder().setColor(Z9_COLOR).setDescription('*(apparence par défaut — règle-la via « Apparence »)*')

  const rows = countRows(draftToPanel(draft))
  const groupLines = draft.groups.length
    ? draft.groups.map((g, i) => `\`${i + 1}.\` **${GROUP_TYPE_LABELS[g.type]}** · ${BEHAVIOR_LABELS[g.behavior]}${g.behavior === 'limit' && g.limitCount ? ` (${g.limitCount})` : ''} · ${g.entries.length} rôle(s)${g.placeholder ? ` · « ${g.placeholder} »` : ''}`).join('\n')
    : '_aucun groupe — ajoutes-en un_'

  const summary = [
    '🎛️ **Éditeur de panneau de rôles**',
    `Salon : ${draft.channelId ? `<#${draft.channelId}>` : '_non défini_'} · Rangées : **${rows}/5**`,
    `**Groupes :**\n${groupLines}`,
    draft.linkButtons.length ? `**Boutons-liens :** ${draft.linkButtons.map(b => b.label).join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const channelRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('rrg:channel').setPlaceholder('📢 Salon de publication…').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1),
  )

  const mainOptions = [
    { label: 'Apparence (titre, couleur, image…)', value: 'app:form', emoji: '🎨' },
    ...draft.groups.map((g, i) => ({ label: `Éditer le groupe ${i + 1} — ${GROUP_TYPE_LABELS[g.type]}`, value: `grp:${i}`, emoji: '✏️' })),
    { label: 'Ajouter un groupe', value: 'addgroup', emoji: '➕' },
    { label: 'Ajouter un bouton-lien', value: 'links', emoji: '🔗' },
  ]
  const mainRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('rrg:main').setPlaceholder('⚙️ Configurer…').addOptions(mainOptions.slice(0, 25)),
  )

  const components: Row[] = [channelRow, mainRow]
  const savedEmbeds = embedStore.list(draft.guildId)
  if (savedEmbeds.length) {
    components.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId('rrg:embed').setPlaceholder('🎨 Charger un embed sauvegardé comme apparence…').addOptions(savedEmbeds.slice(0, 25).map(n => ({ label: n, value: n }))),
    ))
  }
  components.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rrg:publish').setLabel(draft.panelId ? 'Mettre à jour' : 'Publier').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rrg:close').setLabel('Fermer').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  ))

  return { content: summary, embeds: [preview], components }
}

function renderGroup(draft: PanelDraft): BaseMessageOptions {
  const idx = draft.editingGroup as number
  const group = draft.groups[idx]
  const roleList = group.entries.length
    ? group.entries.map((e, i) => `\`${i + 1}.\` ${e.emoji ? e.emoji + ' ' : ''}**${e.label}**${e.description ? ` — ${e.description}` : ''}`).join('\n')
    : '_aucun rôle — ajoutes-en avec le menu ci-dessous_'

  const content = [
    `✏️ **Groupe ${idx + 1}** — ${GROUP_TYPE_LABELS[group.type]} · ${BEHAVIOR_LABELS[group.behavior]}${group.behavior === 'limit' && group.limitCount ? ` (${group.limitCount})` : ''}`,
    group.placeholder ? `Titre du menu : « ${group.placeholder} »` : '',
    `**Rôles :**\n${roleList}`,
    group.type === 'reactions' ? '⚠️ Mode réactions : chaque rôle doit avoir un **emoji**.' : '',
  ].filter(Boolean).join('\n')

  const roleRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new RoleSelectMenuBuilder().setCustomId('rrg:addrole').setPlaceholder('➕ Ajouter des rôles à ce groupe…').setMinValues(0).setMaxValues(10),
  )
  const goptRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('rrg:gopt').setPlaceholder('⚙️ Réglages du groupe…').addOptions(
      { label: 'Type : Menu déroulant', value: 'gtype:select', emoji: '📋' },
      { label: 'Type : Boutons', value: 'gtype:buttons', emoji: '🔘' },
      { label: 'Type : Réactions', value: 'gtype:reactions', emoji: '😀' },
      { label: 'Comportement : Normal', value: 'gbeh:normal', emoji: '🔁' },
      { label: 'Comportement : Unique', value: 'gbeh:unique', emoji: '☝️' },
      { label: 'Comportement : Ajout seul', value: 'gbeh:add_only', emoji: '📥' },
      { label: 'Comportement : Limité…', value: 'gbeh:limit', emoji: '🔢' },
      { label: 'Titre du menu (placeholder)…', value: 'gplaceholder', emoji: '🏷️' },
      { label: 'Configurer un rôle…', value: 'gconfigrole', emoji: '🛠️' },
      { label: 'Retirer un rôle…', value: 'gremoverole', emoji: '🗑️' },
    ),
  )
  const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('rrg:back').setLabel('Retour').setEmoji('⬅️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rrg:delgroup').setLabel('Supprimer le groupe').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  )

  return { content, embeds: [], components: [roleRow, goptRow, buttonRow] }
}

function render(draft: PanelDraft): BaseMessageOptions {
  return draft.editingGroup === undefined ? renderMain(draft) : renderGroup(draft)
}

/* ─────────────────────────── Démarrage ─────────────────────────── */

export async function startRoleBuilder(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
    return
  }
  const draft: PanelDraft = {
    guildId: interaction.guildId,
    embed: { title: 'Choisis tes rôles', description: 'Sélectionne les rôles qui t’intéressent.' },
    groups: [],
    linkButtons: [],
  }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...render(draft), ephemeral: true })
}

export async function startRoleBuilderEdit(interaction: ChatInputCommandInteraction, panel: RolePanel): Promise<void> {
  const draft: PanelDraft = {
    guildId: panel.guildId,
    channelId: panel.channelId,
    origChannelId: panel.channelId,
    panelId: panel.id,
    messageId: panel.messageId,
    embed: clone(panel.embed),
    groups: clone(panel.groups),
    linkButtons: clone(panel.linkButtons),
  }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...render(draft), ephemeral: true })
}

/* ─────────────────────────── Écran principal ─────────────────────────── */

export async function onChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.channelId = interaction.values[0]
  await interaction.update(render(draft))
}

export async function onPickEmbed(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const record = embedStore.get(draft.guildId, interaction.values[0])
  if (!record) {
    await interaction.reply({ content: '❌ Embed introuvable.', ephemeral: true })
    return
  }
  draft.embed = clone(record.data)
  await interaction.update(render(draft))
}

export async function onMain(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const v = interaction.values[0]

  if (v === 'app:form') {
    const modal = new ModalBuilder().setCustomId('rrg:m:apparence').setTitle('Apparence du panneau')
    const add = (id: string, label: string, style: TextInputStyle, value?: string, ph?: string) =>
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false).setValue(value ?? '').setPlaceholder(ph ?? '')))
    add('title', 'Titre', TextInputStyle.Short, draft.embed.title)
    add('description', 'Description', TextInputStyle.Paragraph, draft.embed.description)
    add('color', 'Couleur (#E8943A ou nom)', TextInputStyle.Short, typeof draft.embed.color === 'number' ? '#' + draft.embed.color.toString(16).padStart(6, '0') : '')
    add('image', 'Image / bannière (URL)', TextInputStyle.Short, draft.embed.image, 'https://…')
    add('thumbnail', 'Miniature (URL)', TextInputStyle.Short, draft.embed.thumbnail, 'https://…')
    await interaction.showModal(modal)
    return
  }
  if (v === 'addgroup') {
    if (draft.groups.length >= MAX_ROWS) {
      await interaction.reply({ content: '❌ Maximum atteint (5 rangées de composants).', ephemeral: true })
      return
    }
    draft.groups.push(emptyGroup('select'))
    draft.editingGroup = draft.groups.length - 1
    await interaction.update(render(draft))
    return
  }
  if (v === 'links') {
    const modal = new ModalBuilder().setCustomId('rrg:m:link').setTitle('Ajouter un bouton-lien')
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Texte du bouton').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('url').setLabel('Lien (URL)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('https://…')),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (optionnel)').setStyle(TextInputStyle.Short).setRequired(false)),
    )
    await interaction.showModal(modal)
    return
  }
  if (v.startsWith('grp:')) {
    draft.editingGroup = Number(v.slice(4))
    await interaction.update(render(draft))
  }
}

/* ─────────────────────────── Écran de groupe ─────────────────────────── */

export async function onAddRoleToGroup(interaction: RoleSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft || draft.editingGroup === undefined) return expired(interaction)
  const group = draft.groups[draft.editingGroup]
  for (const [roleId, role] of interaction.roles) {
    if (group.entries.length >= MAX_ROLES_PER_GROUP) break
    if (group.entries.some(e => e.roleId === roleId)) continue
    group.entries.push({ roleId, label: role.name.slice(0, 80) })
  }
  await interaction.update(render(draft))
}

export async function onGopt(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft || draft.editingGroup === undefined) return expired(interaction)
  const group = draft.groups[draft.editingGroup]
  const v = interaction.values[0]

  if (v.startsWith('gtype:')) {
    group.type = v.slice(6) as GroupType
    await interaction.update(render(draft))
    return
  }
  if (v.startsWith('gbeh:')) {
    const b = v.slice(5) as GroupBehavior
    if (b === 'limit') {
      const modal = new ModalBuilder().setCustomId('rrg:m:glimit').setTitle('Limite de rôles')
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('limit').setLabel('Nombre max de rôles').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue(group.limitCount ? String(group.limitCount) : '')))
      await interaction.showModal(modal)
      return
    }
    group.behavior = b
    group.limitCount = undefined
    await interaction.update(render(draft))
    return
  }
  if (v === 'gplaceholder') {
    const modal = new ModalBuilder().setCustomId('rrg:m:gplaceholder').setTitle('Titre du menu')
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('placeholder').setLabel('Texte affiché sur le menu').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100).setValue(group.placeholder ?? '').setPlaceholder('Ton Pays')))
    await interaction.showModal(modal)
    return
  }
  if (v === 'gconfigrole') {
    if (!group.entries.length) {
      await interaction.reply({ content: '❌ Ajoute d’abord des rôles.', ephemeral: true })
      return
    }
    const modal = new ModalBuilder().setCustomId('rrg:m:gconfigrole').setTitle('Configurer un rôle')
    const add = (id: string, label: string, ph?: string) =>
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(id === 'index').setPlaceholder(ph ?? '')))
    add('index', `Numéro du rôle (1 à ${group.entries.length})`)
    add('label', 'Nom affiché (vide = inchangé)')
    add('emoji', 'Emoji', '🆕')
    add('description', 'Description')
    add('style', 'Style bouton (bleu/gris/vert/rouge)', 'gris')
    await interaction.showModal(modal)
    return
  }
  if (v === 'gremoverole') {
    if (!group.entries.length) {
      await interaction.reply({ content: '❌ Aucun rôle à retirer.', ephemeral: true })
      return
    }
    const modal = new ModalBuilder().setCustomId('rrg:m:gremoverole').setTitle('Retirer un rôle')
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('index').setLabel(`Numéro du rôle (1 à ${group.entries.length})`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2)))
    await interaction.showModal(modal)
  }
}

export async function onBack(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.editingGroup = undefined
  await interaction.update(render(draft))
}

export async function onDeleteGroup(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft || draft.editingGroup === undefined) return expired(interaction)
  draft.groups.splice(draft.editingGroup, 1)
  draft.editingGroup = undefined
  await interaction.update(render(draft))
}

/* ─────────────────────────── Modals ─────────────────────────── */

export async function onBuilderModal(interaction: ModalSubmitInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const part = interaction.customId.split(':')[2]
  const val = (id: string) => interaction.fields.getTextInputValue(id).trim()

  if (part === 'apparence') {
    draft.embed.title = val('title') || undefined
    draft.embed.description = val('description') || undefined
    const rawColor = val('color')
    if (rawColor) {
      const c = parseColor(rawColor)
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
    const thumb = val('thumbnail')
    draft.embed.thumbnail = thumb && isHttpUrl(thumb) ? thumb : undefined
  } else if (part === 'link') {
    const url = val('url')
    if (!isHttpUrl(url)) {
      await interaction.reply({ content: '❌ URL invalide (doit commencer par http).', ephemeral: true })
      return
    }
    draft.linkButtons.push({ label: val('label'), url, emoji: safeEmoji(val('emoji')) })
  } else if (part === 'glimit' && draft.editingGroup !== undefined) {
    const n = parseInt(val('limit'), 10)
    if (Number.isNaN(n) || n < 1) {
      await interaction.reply({ content: '❌ Nombre invalide.', ephemeral: true })
      return
    }
    draft.groups[draft.editingGroup].behavior = 'limit'
    draft.groups[draft.editingGroup].limitCount = n
  } else if (part === 'gplaceholder' && draft.editingGroup !== undefined) {
    draft.groups[draft.editingGroup].placeholder = val('placeholder') || undefined
  } else if (part === 'gconfigrole' && draft.editingGroup !== undefined) {
    const group = draft.groups[draft.editingGroup]
    const idx = parseInt(val('index'), 10) - 1
    if (idx < 0 || idx >= group.entries.length) {
      await interaction.reply({ content: '❌ Numéro de rôle invalide.', ephemeral: true })
      return
    }
    const entry = group.entries[idx]
    if (val('label')) entry.label = val('label').slice(0, 80)
    entry.emoji = val('emoji') || undefined
    entry.description = val('description') || undefined
    if (val('style')) entry.style = parseStyle(val('style'))
  } else if (part === 'gremoverole' && draft.editingGroup !== undefined) {
    const group = draft.groups[draft.editingGroup]
    const idx = parseInt(val('index'), 10) - 1
    if (idx < 0 || idx >= group.entries.length) {
      await interaction.reply({ content: '❌ Numéro de rôle invalide.', ephemeral: true })
      return
    }
    group.entries.splice(idx, 1)
  }

  if (interaction.isFromMessage()) {
    await interaction.update(render(draft))
  } else {
    await interaction.reply({ content: '✅ Mis à jour.', ephemeral: true })
  }
}

/* ─────────────────────────── Publication ─────────────────────────── */

export async function onBuilderPublish(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)

  const nonEmptyGroups = draft.groups.filter(g => g.entries.length > 0)
  if (nonEmptyGroups.length === 0 && draft.linkButtons.length === 0) {
    await interaction.reply({ content: '❌ Ajoute au moins un groupe avec des rôles (ou un bouton-lien).', ephemeral: true })
    return
  }
  if (!draft.channelId) {
    await interaction.reply({ content: '❌ Choisis un salon de publication.', ephemeral: true })
    return
  }
  const reactionsMissingEmoji = nonEmptyGroups.some(g => g.type === 'reactions' && g.entries.some(e => !safeEmoji(e.emoji)))
  if (reactionsMissingEmoji) {
    await interaction.reply({ content: '❌ En mode réactions, **chaque rôle doit avoir un emoji valide** (Configurer un rôle).', ephemeral: true })
    return
  }

  // Panneau final (on ne garde que les groupes non vides).
  const panelDraft: PanelDraft = { ...draft, groups: nonEmptyGroups }
  const rows = countRows(draftToPanel(panelDraft))
  if (rows > MAX_ROWS) {
    await interaction.reply({ content: `❌ Trop de composants : ${rows} rangées (max 5). Réduis les groupes/rôles.`, ephemeral: true })
    return
  }

  const channel = await interaction.guild?.channels.fetch(draft.channelId).catch(() => null)
  if (!channel || !channel.isTextBased() || !('send' in channel) || !('messages' in channel)) {
    await interaction.reply({ content: '❌ Salon de publication invalide.', ephemeral: true })
    return
  }

  const id = draft.panelId ?? rolePanelStore.create(draft.guildId)
  const panel = draftToPanel(panelDraft, id)
  rolePanelStore.save(panel)

  const editInPlace = draft.panelId && draft.messageId && draft.origChannelId === draft.channelId
  let message
  try {
    if (editInPlace) {
      const existing = await channel.messages.fetch(draft.messageId as string).catch(() => null)
      message = existing ? await existing.edit(buildPanelMessage(panel)) : await channel.send(buildPanelMessage(panel))
    } else {
      if (draft.panelId && draft.messageId && draft.origChannelId) {
        const oldChannel = await interaction.guild?.channels.fetch(draft.origChannelId).catch(() => null)
        if (oldChannel?.isTextBased() && 'messages' in oldChannel) await oldChannel.messages.delete(draft.messageId).catch(() => undefined)
      }
      message = await channel.send(buildPanelMessage(panel))
    }
  } catch (error) {
    console.error('Erreur publication panneau :', error)
    await interaction.reply({ content: '❌ Publication impossible (permissions du bot ? emoji/URL invalide ?).', ephemeral: true })
    return
  }

  rolePanelStore.setPublished(id, draft.channelId, message.id)

  // Réactions : (re)synchronise les emojis des groupes « réactions ».
  const reactionEmojis = nonEmptyGroups.filter(g => g.type === 'reactions').flatMap(g => g.entries.map(e => safeEmoji(e.emoji)).filter(Boolean) as string[])
  if (reactionEmojis.length) {
    await message.reactions.removeAll().catch(() => undefined)
    for (const emoji of reactionEmojis) await message.react(emoji).catch(() => undefined)
  }

  drafts.delete(interaction.user.id)
  await interaction.update({
    content: draft.panelId ? `✅ Panneau \`#${id}\` mis à jour dans <#${draft.channelId}> !` : `✅ Panneau publié dans <#${draft.channelId}> !`,
    embeds: [],
    components: [],
  })
}

export async function onBuilderClose(interaction: ButtonInteraction): Promise<void> {
  drafts.delete(interaction.user.id)
  await interaction.update({ content: '✅ Éditeur fermé.', embeds: [], components: [] })
}
