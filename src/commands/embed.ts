import {
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type APIEmbed,
  type ModalSubmitInteraction,
} from 'discord.js'
import type { Command } from '../types/command'

/**
 * /embed — publie un embed conçu sur Discohook.
 * L'utilisateur choisit un salon, puis colle le JSON Discohook dans un modal.
 */
export const embed: Command = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Publier un embed (JSON Discohook) dans un salon')
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon où publier le message')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const channel = interaction.options.getChannel('salon', true)

    const modal = new ModalBuilder()
      .setCustomId(`embed:publish:${channel.id}`)
      .setTitle('Publier un embed')

    const input = new TextInputBuilder()
      .setCustomId('json')
      .setLabel('JSON Discohook (message complet)')
      .setPlaceholder('Colle ici le JSON copié depuis discohook.org…')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000)

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
    await interaction.showModal(modal)
  },
}

interface DiscohookPayload {
  content?: string
  embeds?: APIEmbed[]
  messages?: { data?: { content?: string; embeds?: APIEmbed[] } }[]
}

/** Normalise les deux formats d'export Discohook (direct ou « messages[].data »). */
function normalize(payload: DiscohookPayload): { content?: string; embeds: APIEmbed[] } {
  const data = payload.messages?.[0]?.data ?? payload
  return { content: data.content, embeds: data.embeds ?? [] }
}

/** Gère la soumission du modal /embed : parse le JSON et publie le message. */
export async function handleEmbedModal(interaction: ModalSubmitInteraction): Promise<void> {
  const channelId = interaction.customId.split(':')[2]
  const raw = interaction.fields.getTextInputValue('json')

  let parsed: DiscohookPayload
  try {
    parsed = JSON.parse(raw) as DiscohookPayload
  } catch {
    await interaction.reply({ content: '❌ Le JSON est invalide. Vérifie le copier-coller depuis Discohook.', ephemeral: true })
    return
  }

  const { content, embeds } = normalize(parsed)
  if (!content && embeds.length === 0) {
    await interaction.reply({ content: '❌ Le JSON ne contient ni texte ni embed.', ephemeral: true })
    return
  }

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null)
  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    await interaction.reply({ content: '❌ Salon introuvable ou non textuel.', ephemeral: true })
    return
  }

  try {
    await channel.send({ content: content ?? undefined, embeds })
    await interaction.reply({ content: `✅ Embed publié dans <#${channelId}>.`, ephemeral: true })
  } catch (err) {
    console.error('Erreur publication embed:', err)
    await interaction.reply({ content: "❌ Échec de la publication (permissions du bot ? contenu du JSON ?).", ephemeral: true })
  }
}
