import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
  type MessageActionRowComponentBuilder,
} from 'discord.js'
import type { StoredEmbed } from './types'

/** Vrai si la chaîne est une URL http(s) valide (Discord exige ce format). */
export function isHttpUrl(s?: string): boolean {
  if (!s) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Vrai si l'embed n'a aucun contenu affichable (Discord refuse un embed vide). */
export function isEmbedEmpty(d: StoredEmbed): boolean {
  return (
    !d.title &&
    !d.description &&
    !d.image &&
    !d.thumbnail &&
    !(d.fields && d.fields.length) &&
    !d.author?.name &&
    !d.footer?.text
  )
}

export function buildEmbed(d: StoredEmbed): EmbedBuilder | null {
  if (isEmbedEmpty(d)) return null
  const e = new EmbedBuilder()
  if (d.title) e.setTitle(d.title)
  if (isHttpUrl(d.url)) e.setURL(d.url as string)
  if (d.description) e.setDescription(d.description)
  if (typeof d.color === 'number') e.setColor(d.color)
  if (d.author?.name) {
    e.setAuthor({
      name: d.author.name,
      iconURL: isHttpUrl(d.author.iconURL) ? d.author.iconURL : undefined,
      url: isHttpUrl(d.author.url) ? d.author.url : undefined,
    })
  }
  if (d.footer?.text) {
    e.setFooter({ text: d.footer.text, iconURL: isHttpUrl(d.footer.iconURL) ? d.footer.iconURL : undefined })
  }
  if (isHttpUrl(d.image)) e.setImage(d.image as string)
  if (isHttpUrl(d.thumbnail)) e.setThumbnail(d.thumbnail as string)
  if (d.timestamp) e.setTimestamp()
  if (d.fields && d.fields.length) {
    e.addFields(d.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? false })))
  }
  return e
}

/** Boutons-liens (URL) répartis en lignes de 5. */
export function buildLinkButtons(d: StoredEmbed): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  if (!d.buttons || d.buttons.length === 0) return []
  const valid = d.buttons.filter(b => isHttpUrl(b.url))
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = []
  for (let i = 0; i < valid.length; i += 5) {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    for (const b of valid.slice(i, i + 5)) {
      const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(b.url)
      if (b.emoji) button.setEmoji(b.emoji)
      row.addComponents(button)
    }
    rows.push(row)
  }
  return rows
}

/** Message final prêt à envoyer (texte + embed + boutons-liens). */
export function renderEmbedMessage(d: StoredEmbed): BaseMessageOptions {
  const embed = buildEmbed(d)
  return {
    content: d.content || undefined,
    embeds: embed ? [embed] : [],
    components: buildLinkButtons(d),
  }
}
