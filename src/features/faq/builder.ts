import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { Z9_COLOR } from '../../config'
import { embedStore } from '../../db/embeds'
import { faqPanelStore } from '../../db/faqPanels'
import { mergeDiscohook } from '../embeds/import'
import { buildEmbed } from '../embeds/render'
import type { StoredEmbed } from '../embeds/types'
import { buildFaqPanelMessage } from './render'
import { FAQ_STYLE_LABELS, emptyButton, emptyFaq, type FaqButton, type FaqButtonStyle, type FaqPanel } from './types'

const MAX_BUTTONS = 25
type Row = ActionRowBuilder<MessageActionRowComponentBuilder>

interface FaqDraft {
  guildId: string
  channelId?: string
  panelId?: number
  messageId?: string
  origChannelId?: string
  embed: StoredEmbed
  buttons: FaqButton[]
  editingButton?: number
}

const drafts = new Map<string, FaqDraft>()

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
function parseColor(input: string): number | undefined {
  const s = input.trim().toLowerCase()
  const named: Record<string, number> = { rouge: 0xed4245, vert: 0x57f287, bleu: 0x5865f2, jaune: 0xfee75c, orange: 0xe67e22, rose: 0xeb459e, violet: 0x9b59b6, blanc: 0xffffff, noir: 0x2b2d31, gris: 0x95a5a6 }
  if (named[s] !== undefined) return named[s]
  const hex = s.replace('#', '')
  if (/^[0-9a-f]{6}$/.test(hex)) return parseInt(hex, 16)
  return undefined
}
function parseStyle(input: string): FaqButtonStyle {
  const s = input.trim().toLowerCase()
  if (/^(bleu|prim)/.test(s)) return 'primary'
  if (/^(vert|succ)/.test(s)) return 'success'
  if (/^(roug|dang)/.test(s)) return 'danger'
  return 'secondary'
}
function draftToPanel(draft: FaqDraft, id = 0): FaqPanel {
  return { id, guildId: draft.guildId, channelId: draft.channelId, messageId: draft.messageId, embed: draft.embed, buttons: draft.buttons }
}

async function expired(interaction: ChannelSelectMenuInteraction | StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  await interaction.reply({ content: '⌛ Éditeur expiré. Relance `/faq create`.', ephemeral: true }).catch(() => undefined)
}

/* ───── Rendu ───── */

function renderMain(draft: FaqDraft): BaseMessageOptions {
  const preview = buildEmbed(draft.embed) ?? new EmbedBuilder().setColor(Z9_COLOR).setDescription('*(apparence par défaut)*')
  const btnLines = draft.buttons.length
    ? draft.buttons.map((b, i) => `\`${i + 1}.\` ${b.emoji ? b.emoji + ' ' : ''}**${b.label}** _(${FAQ_STYLE_LABELS[b.style]})_`).join('\n')
    : '_aucun bouton — ajoutes-en un_'
  const summary = [
    '📖 **Éditeur de FAQ**',
    `Salon : ${draft.channelId ? `<#${draft.channelId}>` : '_non défini_'} · Boutons : **${draft.buttons.length}/25**`,
    `**Boutons :**\n${btnLines}`,
  ].join('\n')

  const channelRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('fq:channel').setPlaceholder('📢 Salon de publication…').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1),
  )
  const mainRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('fq:main').setPlaceholder('⚙️ Configurer…').addOptions(
      { label: 'Apparence du panneau (titre, couleur, image…)', value: 'app', emoji: '🎨' },
      { label: 'Importer un JSON Discohook (panneau)', value: 'import', emoji: '📥' },
      { label: 'Ajouter un bouton', value: 'addbtn', emoji: '➕' },
      ...draft.buttons.map((b, i) => ({ label: `Éditer le bouton ${i + 1} — ${b.label}`.slice(0, 90), value: `btn:${i}`, emoji: '✏️' })),
    ),
  )
  const rows: Row[] = [channelRow, mainRow]
  const saved = embedStore.list(draft.guildId)
  if (saved.length) {
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId('fq:embed').setPlaceholder('🎨 Apparence du panneau depuis un embed sauvegardé…').addOptions(saved.slice(0, 25).map(n => ({ label: n, value: n }))),
    ))
  }
  rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('fq:publish').setLabel(draft.panelId ? 'Mettre à jour' : 'Publier').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('fq:close').setLabel('Fermer').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  ))
  return { content: summary, embeds: [preview], components: rows }
}

function renderButton(draft: FaqDraft): BaseMessageOptions {
  const idx = draft.editingButton as number
  const b = draft.buttons[idx]
  const answerPreview = buildEmbed(b.answer) ?? new EmbedBuilder().setColor(Z9_COLOR).setDescription('*(réponse vide — configure-la)*')
  const content = [
    `✏️ **Bouton ${idx + 1}** — ${b.emoji ? b.emoji + ' ' : ''}**${b.label}** _(${FAQ_STYLE_LABELS[b.style]})_`,
    'Aperçu de la **réponse** (envoyée en éphémère au clic) :',
  ].join('\n')

  const optRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('fq:bopt').setPlaceholder('⚙️ Configurer le bouton…').addOptions(
      { label: 'Libellé / emoji / couleur du bouton', value: 'meta', emoji: '🏷️' },
      { label: 'Réponse — infos de base (titre, description, couleur)', value: 'ans_basic', emoji: '📝' },
      { label: 'Réponse — importer un JSON Discohook', value: 'ans_import', emoji: '📥' },
    ),
  )
  const rows: Row[] = [optRow]
  const saved = embedStore.list(draft.guildId)
  if (saved.length) {
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId('fq:ansembed').setPlaceholder('🎨 Réponse depuis un embed sauvegardé…').addOptions(saved.slice(0, 25).map(n => ({ label: n, value: n }))),
    ))
  }
  rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('fq:back').setLabel('Retour').setEmoji('⬅️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('fq:testans').setLabel('Tester la réponse').setEmoji('🧪').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('fq:delbtn').setLabel('Supprimer le bouton').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  ))
  return { content, embeds: [answerPreview], components: rows }
}

function render(draft: FaqDraft): BaseMessageOptions {
  return draft.editingButton === undefined ? renderMain(draft) : renderButton(draft)
}

/* ───── Démarrage ───── */

export async function startFaqBuilder(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
    return
  }
  const base = emptyFaq()
  const draft: FaqDraft = { guildId: interaction.guildId, channelId: interaction.channelId ?? undefined, embed: base.embed, buttons: base.buttons }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...render(draft), ephemeral: true })
}

export async function startFaqBuilderEdit(interaction: ChatInputCommandInteraction, panel: FaqPanel): Promise<void> {
  const draft: FaqDraft = {
    guildId: panel.guildId,
    channelId: panel.channelId,
    origChannelId: panel.channelId,
    panelId: panel.id,
    messageId: panel.messageId,
    embed: clone(panel.embed),
    buttons: clone(panel.buttons),
  }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...render(draft), ephemeral: true })
}

/* ───── Écran principal ───── */

export async function onFqChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.channelId = interaction.values[0]
  await interaction.update(render(draft))
}

function appearanceModal(id: string, e: StoredEmbed): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(id).setTitle('Apparence')
  const add = (fid: string, label: string, style: TextInputStyle, value?: string, ph?: string) =>
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId(fid).setLabel(label).setStyle(style).setRequired(false).setValue(value ?? '').setPlaceholder(ph ?? '')))
  add('title', 'Titre', TextInputStyle.Short, e.title)
  add('description', 'Description', TextInputStyle.Paragraph, e.description)
  add('color', 'Couleur (#E8943A ou nom)', TextInputStyle.Short, typeof e.color === 'number' ? '#' + e.color.toString(16).padStart(6, '0') : '')
  add('image', 'Image (URL, optionnel)', TextInputStyle.Short, e.image, 'https://…')
  return modal
}
function importModal(id: string): ModalBuilder {
  return new ModalBuilder().setCustomId(id).setTitle('Importer un JSON Discohook').addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('json').setLabel('Colle le JSON').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000)))
}

export async function onFqMain(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const v = interaction.values[0]

  if (v === 'app') { await interaction.showModal(appearanceModal('fq:m:app', draft.embed)); return }
  if (v === 'import') { await interaction.showModal(importModal('fq:m:import')); return }
  if (v === 'addbtn') {
    if (draft.buttons.length >= MAX_BUTTONS) { await interaction.reply({ content: '❌ Maximum 25 boutons.', ephemeral: true }); return }
    draft.buttons.push(emptyButton())
    draft.editingButton = draft.buttons.length - 1
    await interaction.update(render(draft))
    return
  }
  if (v.startsWith('btn:')) {
    draft.editingButton = Number(v.slice(4))
    await interaction.update(render(draft))
  }
}

export async function onFqPickEmbed(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const rec = embedStore.get(draft.guildId, interaction.values[0])
  if (!rec) { await interaction.reply({ content: '❌ Embed introuvable.', ephemeral: true }); return }
  draft.embed = clone(rec.data)
  await interaction.update(render(draft))
}

/* ───── Écran bouton ───── */

export async function onFqBopt(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft || draft.editingButton === undefined) return expired(interaction)
  const b = draft.buttons[draft.editingButton]
  const v = interaction.values[0]

  if (v === 'meta') {
    const modal = new ModalBuilder().setCustomId('fq:m:meta').setTitle('Bouton')
    const add = (fid: string, label: string, style: TextInputStyle, value?: string, ph?: string, required = false) =>
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId(fid).setLabel(label).setStyle(style).setRequired(required).setValue(value ?? '').setPlaceholder(ph ?? '')))
    add('label', 'Libellé du bouton', TextInputStyle.Short, b.label, undefined, true)
    add('emoji', 'Emoji (optionnel)', TextInputStyle.Short, b.emoji, '📦')
    add('style', 'Couleur (bleu / gris / vert / rouge)', TextInputStyle.Short, FAQ_STYLE_LABELS[b.style].toLowerCase())
    await interaction.showModal(modal)
    return
  }
  if (v === 'ans_basic') { await interaction.showModal(appearanceModal('fq:m:ansbasic', b.answer)); return }
  if (v === 'ans_import') { await interaction.showModal(importModal('fq:m:ansimport')); return }
}

export async function onFqPickAnsEmbed(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft || draft.editingButton === undefined) return expired(interaction)
  const rec = embedStore.get(draft.guildId, interaction.values[0])
  if (!rec) { await interaction.reply({ content: '❌ Embed introuvable.', ephemeral: true }); return }
  draft.buttons[draft.editingButton].answer = clone(rec.data)
  await interaction.update(render(draft))
}

export async function onFqBack(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.editingButton = undefined
  await interaction.update(render(draft))
}

export async function onFqDelButton(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft || draft.editingButton === undefined) return expired(interaction)
  draft.buttons.splice(draft.editingButton, 1)
  draft.editingButton = undefined
  await interaction.update(render(draft))
}

export async function onFqTestAnswer(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft || draft.editingButton === undefined) return expired(interaction)
  const b = draft.buttons[draft.editingButton]
  const embed = buildEmbed(b.answer)
  const content = b.answer.content || undefined
  if (!embed && !content) { await interaction.reply({ content: '❌ Réponse vide.', ephemeral: true }); return }
  await interaction.reply({ content, embeds: embed ? [embed] : [], ephemeral: true })
}

/* ───── Modals ───── */

export async function onFqModal(interaction: ModalSubmitInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const part = interaction.customId.split(':')[2]
  const val = (id: string) => interaction.fields.getTextInputValue(id).trim()

  const applyAppearance = async (e: StoredEmbed): Promise<boolean> => {
    e.title = val('title') || undefined
    e.description = val('description') || undefined
    const raw = val('color')
    if (raw) {
      const c = parseColor(raw)
      if (c === undefined) { await interaction.reply({ content: '❌ Couleur non reconnue.', ephemeral: true }); return false }
      e.color = c
    } else e.color = undefined
    e.image = val('image') || undefined
    return true
  }

  if (part === 'app') {
    if (!(await applyAppearance(draft.embed))) return
  } else if (part === 'import') {
    if (!mergeDiscohook(draft.embed, interaction.fields.getTextInputValue('json'))) { await interaction.reply({ content: '❌ JSON invalide.', ephemeral: true }); return }
  } else if (part === 'meta' && draft.editingButton !== undefined) {
    const b = draft.buttons[draft.editingButton]
    b.label = val('label').slice(0, 80) || b.label
    b.emoji = val('emoji') || undefined
    if (val('style')) b.style = parseStyle(val('style'))
  } else if (part === 'ansbasic' && draft.editingButton !== undefined) {
    if (!(await applyAppearance(draft.buttons[draft.editingButton].answer))) return
  } else if (part === 'ansimport' && draft.editingButton !== undefined) {
    if (!mergeDiscohook(draft.buttons[draft.editingButton].answer, interaction.fields.getTextInputValue('json'))) { await interaction.reply({ content: '❌ JSON invalide.', ephemeral: true }); return }
  }

  if (interaction.isFromMessage()) await interaction.update(render(draft))
  else await interaction.reply({ content: '✅ Mis à jour.', ephemeral: true })
}

/* ───── Publication ───── */

export async function onFqPublish(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  if (draft.buttons.length === 0) { await interaction.reply({ content: '❌ Ajoute au moins un bouton.', ephemeral: true }); return }
  if (!draft.channelId) { await interaction.reply({ content: '❌ Choisis un salon de publication.', ephemeral: true }); return }

  const channel = await interaction.guild?.channels.fetch(draft.channelId).catch(() => null)
  if (!channel || !channel.isTextBased() || !('send' in channel) || !('messages' in channel)) {
    await interaction.reply({ content: '❌ Salon invalide.', ephemeral: true })
    return
  }

  const id = draft.panelId ?? faqPanelStore.create(draft.guildId, { embed: draft.embed, buttons: draft.buttons })
  const panel = draftToPanel(draft, id)
  faqPanelStore.save(panel)

  const editInPlace = draft.panelId && draft.messageId && draft.origChannelId === draft.channelId
  let message
  try {
    if (editInPlace) {
      const existing = await channel.messages.fetch(draft.messageId as string).catch(() => null)
      message = existing ? await existing.edit(buildFaqPanelMessage(panel)) : await channel.send(buildFaqPanelMessage(panel))
    } else {
      if (draft.panelId && draft.messageId && draft.origChannelId) {
        const oldCh = await interaction.guild?.channels.fetch(draft.origChannelId).catch(() => null)
        if (oldCh?.isTextBased() && 'messages' in oldCh) await oldCh.messages.delete(draft.messageId).catch(() => undefined)
      }
      message = await channel.send(buildFaqPanelMessage(panel))
    }
  } catch (error) {
    console.error('Erreur publication FAQ :', error)
    await interaction.reply({ content: '❌ Publication impossible (permissions ? emoji invalide ?).', ephemeral: true })
    return
  }

  faqPanelStore.setPublished(id, draft.channelId, message.id)
  drafts.delete(interaction.user.id)
  await interaction.update({ content: `✅ FAQ ${draft.panelId ? 'mise à jour' : 'publiée'} dans <#${draft.channelId}> !`, embeds: [], components: [] })
}

export async function onFqClose(interaction: ButtonInteraction): Promise<void> {
  drafts.delete(interaction.user.id)
  await interaction.update({ content: '✅ Éditeur fermé.', embeds: [], components: [] })
}
