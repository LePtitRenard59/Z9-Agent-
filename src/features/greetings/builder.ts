import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
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
import { StringSelectMenuBuilder } from 'discord.js'
import { Z9_COLOR } from '../../config'
import { embedStore } from '../../db/embeds'
import { greetingStore } from '../../db/greetings'
import { mergeDiscohook } from '../embeds/import'
import { buildEmbed } from '../embeds/render'
import { buildGreetingMessage, type GreetingVars } from './render'
import { KIND_LABELS, type GreetingConfig, type GreetingKind } from './types'

interface Draft {
  guildId: string
  kind: GreetingKind
  config: GreetingConfig
}

const drafts = new Map<string, Draft>()

const VARS_HINT = 'Variables : `{user}` `{username}` `{tag}` `{server}` `{membercount}` `{avatar}` `{server_icon}` — utilisables aussi dans l’auteur, le footer, l’image de l’embed.'

function parseColor(input: string): number | undefined {
  const s = input.trim().toLowerCase()
  const named: Record<string, number> = { rouge: 0xed4245, vert: 0x57f287, bleu: 0x5865f2, jaune: 0xfee75c, orange: 0xe67e22, rose: 0xeb459e, violet: 0x9b59b6, blanc: 0xffffff, noir: 0x2b2d31, gris: 0x95a5a6 }
  if (named[s] !== undefined) return named[s]
  const hex = s.replace('#', '')
  if (/^[0-9a-f]{6}$/.test(hex)) return parseInt(hex, 16)
  return undefined
}

function save(draft: Draft): void {
  greetingStore.save(draft.guildId, draft.kind, draft.config)
}

function render(draft: Draft): BaseMessageOptions {
  const c = draft.config
  const summary = [
    `👋 **Éditeur — message de ${KIND_LABELS[draft.kind].toLowerCase()}**`,
    `État : ${c.enabled ? '✅ **Activé**' : '⏸️ Désactivé'} · Salon : ${c.channelId ? `<#${c.channelId}>` : '_non défini_'} · Mode : **${c.useEmbed ? 'Embed' : 'Texte'}**`,
    c.content ? `Message :\n> ${c.content.replace(/\n/g, '\n> ')}` : '_message vide_',
    VARS_HINT,
  ].join('\n')

  const embeds = c.useEmbed ? [buildEmbed(c.embed) ?? new EmbedBuilder().setColor(Z9_COLOR).setDescription('*(embed vide — configure-le)*')] : []

  const channelRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('grt:channel').setPlaceholder('📢 Salon…').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(0).setMaxValues(1),
  )
  const optRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('grt:opt').setPlaceholder('⚙️ Configurer…').addOptions(
      { label: 'Message (texte au-dessus)', value: 'text', emoji: '✏️' },
      { label: 'Embed — infos de base (titre, description, couleur)', value: 'basic', emoji: '🎨' },
      { label: 'Embed — auteur', value: 'author', emoji: '👤' },
      { label: 'Embed — footer', value: 'footer', emoji: '🔻' },
      { label: 'Embed — images (grande image, miniature)', value: 'images', emoji: '🖼️' },
      { label: `Embed — horodatage : ${c.embed.timestamp ? 'activé' : 'désactivé'}`, value: 'timestamp', emoji: '🕒' },
      { label: 'Importer un JSON Discohook', value: 'import', emoji: '📥' },
      { label: `Mode : ${c.useEmbed ? 'repasser en texte' : 'utiliser un embed'}`, value: 'mode', emoji: '🔀' },
      { label: 'Tester dans le salon', value: 'test', emoji: '🧪' },
    ),
  )
  const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('grt:toggle').setLabel(c.enabled ? 'Désactiver' : 'Activer').setEmoji(c.enabled ? '⏸️' : '✅').setStyle(c.enabled ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('grt:close').setLabel('Fermer').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  )

  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [channelRow, optRow]
  const savedEmbeds = embedStore.list(draft.guildId)
  if (savedEmbeds.length) {
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId('grt:embed').setPlaceholder('🎨 Charger un embed sauvegardé…').addOptions(savedEmbeds.slice(0, 25).map(n => ({ label: n, value: n }))),
    ))
  }
  rows.push(buttonRow)

  return { content: summary, embeds, components: rows }
}

async function expired(interaction: ChannelSelectMenuInteraction | StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  await interaction.reply({ content: '⌛ Éditeur expiré. Relance la commande.', ephemeral: true }).catch(() => undefined)
}

export async function startGreetingEditor(interaction: ChatInputCommandInteraction, kind: GreetingKind): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: '❌ Utilisable uniquement sur un serveur.', ephemeral: true })
    return
  }
  const draft: Draft = { guildId: interaction.guildId, kind, config: greetingStore.get(interaction.guildId, kind) }
  drafts.set(interaction.user.id, draft)
  await interaction.reply({ ...render(draft), ephemeral: true })
}

export async function onGrtChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  draft.config.channelId = interaction.values[0] || undefined
  save(draft)
  await interaction.update(render(draft))
}

function varsFor(interaction: StringSelectMenuInteraction): GreetingVars {
  return {
    userMention: `<@${interaction.user.id}>`,
    username: interaction.user.username,
    tag: interaction.user.tag,
    server: interaction.guild?.name ?? 'le serveur',
    memberCount: interaction.guild?.memberCount ?? 0,
    avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
    serverIcon: interaction.guild?.iconURL({ extension: 'png', size: 256 }) ?? '',
  }
}

export async function onGrtOpt(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const v = interaction.values[0]

  if (v === 'text') {
    const modal = new ModalBuilder().setCustomId('grt:m:text').setTitle('Message (texte)')
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('content').setLabel('Texte (variables autorisées)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(2000).setValue(draft.config.content)))
    await interaction.showModal(modal)
    return
  }
  const e = draft.config.embed
  const modal = (id: string, title: string, fields: [string, string, TextInputStyle, string?, string?][]): ModalBuilder => {
    const m = new ModalBuilder().setCustomId(id).setTitle(title)
    for (const [fid, label, style, value, ph] of fields) {
      m.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId(fid).setLabel(label).setStyle(style).setRequired(false).setValue(value ?? '').setPlaceholder(ph ?? '')))
    }
    return m
  }

  if (v === 'basic') {
    await interaction.showModal(modal('grt:m:basic', 'Embed — infos de base', [
      ['title', 'Titre', TextInputStyle.Short, e.title],
      ['description', 'Description', TextInputStyle.Paragraph, e.description],
      ['color', 'Couleur (#E8943A ou nom)', TextInputStyle.Short, typeof e.color === 'number' ? '#' + e.color.toString(16).padStart(6, '0') : ''],
      ['url', 'Lien du titre (optionnel)', TextInputStyle.Short, e.url, 'https://…'],
    ]))
    return
  }
  if (v === 'author') {
    await interaction.showModal(modal('grt:m:author', 'Embed — auteur', [
      ['name', 'Nom (ex: {username})', TextInputStyle.Short, e.author?.name],
      ['icon', 'Icône (URL ou {avatar})', TextInputStyle.Short, e.author?.iconURL],
      ['url', 'Lien (optionnel)', TextInputStyle.Short, e.author?.url],
    ]))
    return
  }
  if (v === 'footer') {
    await interaction.showModal(modal('grt:m:footer', 'Embed — footer', [
      ['text', 'Texte (ex: {membercount} membres)', TextInputStyle.Short, e.footer?.text],
      ['icon', 'Icône (URL ou {server_icon})', TextInputStyle.Short, e.footer?.iconURL],
    ]))
    return
  }
  if (v === 'images') {
    await interaction.showModal(modal('grt:m:images', 'Embed — images', [
      ['image', 'Grande image / bannière (URL)', TextInputStyle.Short, e.image, 'https://… ou {avatar}'],
      ['thumbnail', 'Miniature (URL ou {server_icon})', TextInputStyle.Short, e.thumbnail],
    ]))
    return
  }
  if (v === 'timestamp') {
    e.timestamp = !e.timestamp
    draft.config.useEmbed = true
    save(draft)
    await interaction.update(render(draft))
    return
  }
  if (v === 'import') {
    const modal = new ModalBuilder().setCustomId('grt:m:import').setTitle('Importer un JSON Discohook')
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('json').setLabel('Colle le JSON').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000)))
    await interaction.showModal(modal)
    return
  }
  if (v === 'mode') {
    draft.config.useEmbed = !draft.config.useEmbed
    save(draft)
    await interaction.update(render(draft))
    return
  }
  if (v === 'test') {
    if (!draft.config.channelId) {
      await interaction.reply({ content: '❌ Choisis d’abord un salon.', ephemeral: true })
      return
    }
    const channel = await interaction.guild?.channels.fetch(draft.config.channelId).catch(() => null)
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      await interaction.reply({ content: '❌ Salon invalide.', ephemeral: true })
      return
    }
    const message = buildGreetingMessage(draft.config, varsFor(interaction))
    if (!message) {
      await interaction.reply({ content: '❌ Message vide.', ephemeral: true })
      return
    }
    await channel.send(message)
    await interaction.reply({ content: `🧪 Test envoyé dans <#${draft.config.channelId}>.`, ephemeral: true })
  }
}

export async function onGrtPickEmbed(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const record = embedStore.get(draft.guildId, interaction.values[0])
  if (!record) {
    await interaction.reply({ content: '❌ Embed introuvable.', ephemeral: true })
    return
  }
  draft.config.embed = JSON.parse(JSON.stringify(record.data))
  draft.config.useEmbed = true
  save(draft)
  await interaction.update(render(draft))
}

export async function onGrtModal(interaction: ModalSubmitInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const part = interaction.customId.split(':')[2]
  const val = (id: string) => interaction.fields.getTextInputValue(id).trim()

  if (part === 'import') {
    if (!mergeDiscohook(draft.config.embed, interaction.fields.getTextInputValue('json'))) {
      await interaction.reply({ content: '❌ JSON invalide.', ephemeral: true })
      return
    }
    draft.config.useEmbed = true
  } else if (part === 'text') {
    draft.config.content = interaction.fields.getTextInputValue('content')
  } else if (part === 'basic') {
    const e = draft.config.embed
    e.title = val('title') || undefined
    e.description = val('description') || undefined
    e.url = val('url') || undefined // brut : peut contenir une variable
    const raw = val('color')
    if (raw) {
      const c = parseColor(raw)
      if (c === undefined) { await interaction.reply({ content: '❌ Couleur non reconnue (ex: `#E8943A` ou `orange`).', ephemeral: true }); return }
      e.color = c
    } else e.color = undefined
    draft.config.useEmbed = true
  } else if (part === 'author') {
    const name = val('name')
    draft.config.embed.author = name ? { name, iconURL: val('icon') || undefined, url: val('url') || undefined } : undefined
    draft.config.useEmbed = true
  } else if (part === 'footer') {
    const text = val('text')
    draft.config.embed.footer = text ? { text, iconURL: val('icon') || undefined } : undefined
    draft.config.useEmbed = true
  } else if (part === 'images') {
    draft.config.embed.image = val('image') || undefined
    draft.config.embed.thumbnail = val('thumbnail') || undefined
    draft.config.useEmbed = true
  }
  save(draft)
  if (interaction.isFromMessage()) await interaction.update(render(draft))
  else await interaction.reply({ content: '✅ Mis à jour.', ephemeral: true })
}

export async function onGrtToggle(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  if (!draft.config.enabled && !draft.config.channelId) {
    await interaction.reply({ content: '❌ Choisis un salon avant d’activer.', ephemeral: true })
    return
  }
  draft.config.enabled = !draft.config.enabled
  save(draft)
  await interaction.update(render(draft))
}

export async function onGrtClose(interaction: ButtonInteraction): Promise<void> {
  drafts.delete(interaction.user.id)
  await interaction.update({ content: '✅ Éditeur fermé (config enregistrée).', embeds: [], components: [] })
}
