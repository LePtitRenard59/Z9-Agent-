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
import { greetingStore } from '../../db/greetings'
import { buildEmbed, isHttpUrl } from '../embeds/render'
import { buildGreetingMessage, type GreetingVars } from './render'
import { KIND_LABELS, type GreetingConfig, type GreetingKind } from './types'

interface Draft {
  guildId: string
  kind: GreetingKind
  config: GreetingConfig
}

const drafts = new Map<string, Draft>()

const VARS_HINT = 'Variables : `{user}` `{username}` `{tag}` `{server}` `{membercount}`'

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
      { label: 'Message (texte)', value: 'text', emoji: '✏️' },
      { label: 'Embed (titre, description, couleur, image)', value: 'embed', emoji: '🎨' },
      { label: `Mode : ${c.useEmbed ? 'repasser en texte' : 'utiliser un embed'}`, value: 'mode', emoji: '🔀' },
      { label: 'Tester dans le salon', value: 'test', emoji: '🧪' },
    ),
  )
  const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('grt:toggle').setLabel(c.enabled ? 'Désactiver' : 'Activer').setEmoji(c.enabled ? '⏸️' : '✅').setStyle(c.enabled ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('grt:close').setLabel('Fermer').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  )

  return { content: summary, embeds, components: [channelRow, optRow, buttonRow] }
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
  if (v === 'embed') {
    const modal = new ModalBuilder().setCustomId('grt:m:embed').setTitle('Embed')
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

export async function onGrtModal(interaction: ModalSubmitInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const part = interaction.customId.split(':')[2]
  const val = (id: string) => interaction.fields.getTextInputValue(id).trim()

  if (part === 'text') {
    draft.config.content = interaction.fields.getTextInputValue('content')
  } else if (part === 'embed') {
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
