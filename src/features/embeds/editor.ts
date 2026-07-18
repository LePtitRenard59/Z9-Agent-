import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { embedStore } from '../../db/embeds'
import type { StoredEmbed } from './types'
import { buildEmbed, isEmbedEmpty, isHttpUrl, renderEmbedMessage } from './render'
import { mergeDiscohook } from './import'

interface Draft {
  name: string
  guildId: string
  data: StoredEmbed
}

/** Brouillons en cours d'édition, un par utilisateur (transitoire). */
const drafts = new Map<string, Draft>()

const PARTS: { label: string; value: string; description: string; emoji: string }[] = [
  { label: 'Titre & lien', value: 'title', description: 'Titre de l’embed (et URL cliquable)', emoji: '🔠' },
  { label: 'Description', value: 'description', description: 'Texte principal (markdown)', emoji: '📝' },
  { label: 'Couleur', value: 'color', description: 'Barre latérale colorée (hex ou nom)', emoji: '🎨' },
  { label: 'Image', value: 'image', description: 'Grande image / GIF', emoji: '🖼️' },
  { label: 'Miniature', value: 'thumbnail', description: 'Petite image en haut à droite', emoji: '📌' },
  { label: 'Auteur', value: 'author', description: 'Ligne d’auteur (nom + icône)', emoji: '👤' },
  { label: 'Footer', value: 'footer', description: 'Pied de page (texte + icône)', emoji: '🔻' },
  { label: 'Ajouter un champ', value: 'addfield', description: 'Bloc nom / valeur', emoji: '➕' },
  { label: 'Retirer un champ', value: 'removefield', description: 'Supprimer un champ par son numéro', emoji: '➖' },
  { label: 'Texte du message', value: 'content', description: 'Texte hors embed', emoji: '💬' },
  { label: 'Timestamp on/off', value: 'timestamp', description: 'Afficher l’horodatage', emoji: '🕒' },
  { label: 'Ajouter un bouton-lien', value: 'button', description: 'Bouton qui ouvre une URL', emoji: '🔗' },
  { label: 'Importer un JSON Discohook', value: 'import', description: 'Partir d’un design Discohook', emoji: '📥' },
]

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

/** Rendu du message d'édition (aperçu + contrôles), envoyé en éphémère. */
function renderEditor(draft: Draft): BaseMessageOptions {
  const preview = buildEmbed(draft.data) ?? new EmbedBuilder().setDescription('*(embed vide — édite une partie via le menu ci-dessous)*')

  const notes: string[] = [`🛠️ **Éditeur d’embed** — \`${draft.name}\``]
  if (draft.data.content) notes.push(`💬 *Texte du message :* ${draft.data.content.slice(0, 150)}`)
  if (draft.data.buttons?.length) notes.push(`🔗 *Boutons :* ${draft.data.buttons.map(b => b.label).join(', ')}`)

  const partRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('emb:part')
      .setPlaceholder('✏️ Éditer une partie…')
      .addOptions(PARTS.map(p => ({ label: p.label, value: p.value, description: p.description, emoji: p.emoji }))),
  )
  const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('emb:save').setLabel('Sauvegarder').setEmoji('💾').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('emb:publishhere').setLabel('Publier ici').setEmoji('📢').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('emb:close').setLabel('Fermer').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  )

  return { content: notes.join('\n'), embeds: [preview], components: [partRow, buttonRow] }
}

/** Démarre l'éditeur (depuis /embed create ou /embed edit). */
export async function openEditor(
  interaction: ChatInputCommandInteraction,
  name: string,
  guildId: string,
  data: StoredEmbed,
): Promise<void> {
  drafts.set(interaction.user.id, { name, guildId, data })
  await interaction.reply({ ...renderEditor({ name, guildId, data }), ephemeral: true })
}

async function expired(interaction: StringSelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  await interaction.reply({ content: '⌛ Éditeur expiré. Relance `/embed edit <nom>`.', ephemeral: true }).catch(() => undefined)
}

/** Choix d'une partie à éditer → ouvre un formulaire (ou bascule le timestamp). */
export async function onPartSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const part = interaction.values[0]
  const d = draft.data

  if (part === 'timestamp') {
    d.timestamp = !d.timestamp
    await interaction.update(renderEditor(draft))
    return
  }

  const modal = new ModalBuilder().setCustomId(`emb:m:${part}`)
  const rows: ActionRowBuilder<TextInputBuilder>[] = []
  const input = (id: string, label: string, style: TextInputStyle, opts: { value?: string; required?: boolean; max?: number; placeholder?: string } = {}) => {
    const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(opts.required ?? false)
    if (opts.value) t.setValue(opts.value.slice(0, opts.max ?? 4000))
    if (opts.max) t.setMaxLength(opts.max)
    if (opts.placeholder) t.setPlaceholder(opts.placeholder)
    rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(t))
    return t
  }

  switch (part) {
    case 'title':
      modal.setTitle('Titre & lien')
      input('title', 'Titre', TextInputStyle.Short, { value: d.title, required: true, max: 256 })
      input('url', 'Lien du titre (optionnel)', TextInputStyle.Short, { value: d.url, placeholder: 'https://…' })
      break
    case 'description':
      modal.setTitle('Description')
      input('description', 'Description (markdown)', TextInputStyle.Paragraph, { value: d.description, required: true, max: 4000 })
      break
    case 'color':
      modal.setTitle('Couleur')
      input('color', 'Couleur (ex: #E8943A, orange, bleu)', TextInputStyle.Short, { value: typeof d.color === 'number' ? '#' + d.color.toString(16).padStart(6, '0') : '', required: true, max: 20 })
      break
    case 'image':
      modal.setTitle('Image')
      input('image', 'URL de l’image / GIF', TextInputStyle.Short, { value: d.image, placeholder: 'https://…' })
      break
    case 'thumbnail':
      modal.setTitle('Miniature')
      input('thumbnail', 'URL de la miniature', TextInputStyle.Short, { value: d.thumbnail, placeholder: 'https://…' })
      break
    case 'author':
      modal.setTitle('Auteur')
      input('name', 'Nom de l’auteur', TextInputStyle.Short, { value: d.author?.name, required: true, max: 256 })
      input('iconURL', 'Icône (URL, optionnel)', TextInputStyle.Short, { value: d.author?.iconURL })
      input('url', 'Lien (optionnel)', TextInputStyle.Short, { value: d.author?.url })
      break
    case 'footer':
      modal.setTitle('Footer')
      input('text', 'Texte du footer', TextInputStyle.Short, { value: d.footer?.text, required: true, max: 2048 })
      input('iconURL', 'Icône (URL, optionnel)', TextInputStyle.Short, { value: d.footer?.iconURL })
      break
    case 'content':
      modal.setTitle('Texte du message')
      input('content', 'Texte affiché au-dessus de l’embed', TextInputStyle.Paragraph, { value: d.content, max: 2000 })
      break
    case 'addfield':
      modal.setTitle('Ajouter un champ')
      input('name', 'Nom du champ', TextInputStyle.Short, { required: true, max: 256 })
      input('value', 'Valeur', TextInputStyle.Paragraph, { required: true, max: 1024 })
      input('inline', 'En ligne ? (oui / non)', TextInputStyle.Short, { placeholder: 'non', max: 5 })
      break
    case 'removefield':
      modal.setTitle('Retirer un champ')
      input('index', `Numéro du champ (1 à ${d.fields?.length ?? 0})`, TextInputStyle.Short, { required: true, max: 3 })
      break
    case 'button':
      modal.setTitle('Ajouter un bouton-lien')
      input('label', 'Texte du bouton', TextInputStyle.Short, { required: true, max: 80 })
      input('url', 'Lien (URL)', TextInputStyle.Short, { required: true, placeholder: 'https://…' })
      input('emoji', 'Emoji (optionnel)', TextInputStyle.Short, { max: 60 })
      break
    case 'import':
      modal.setTitle('Importer un JSON Discohook')
      input('json', 'Colle le JSON', TextInputStyle.Paragraph, { required: true, max: 4000 })
      break
    default:
      await interaction.reply({ content: '❌ Partie inconnue.', ephemeral: true })
      return
  }

  modal.addComponents(...rows)
  await interaction.showModal(modal)
}


/** Soumission d'un formulaire d'édition → applique la modif et rafraîchit l'aperçu. */
export async function onEditorModal(interaction: ModalSubmitInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  const d = draft.data
  const part = interaction.customId.split(':')[2]
  const val = (id: string) => interaction.fields.getTextInputValue(id).trim()

  // Valide une URL : vide → undefined, valide → la garde, invalide → ignore + avertit.
  const warnings: string[] = []
  const cleanUrl = (raw: string, label: string): string | undefined => {
    if (!raw) return undefined
    if (isHttpUrl(raw)) return raw
    warnings.push(`⚠️ ${label} ignoré : « ${raw} » n’est pas une URL valide (doit commencer par \`http\`).`)
    return undefined
  }

  switch (part) {
    case 'title':
      d.title = val('title')
      d.url = cleanUrl(val('url'), 'Lien du titre')
      break
    case 'description':
      d.description = val('description')
      break
    case 'color': {
      const c = parseColor(val('color'))
      if (c === undefined) {
        await interaction.reply({ content: '❌ Couleur non reconnue (ex: `#E8943A` ou `orange`).', ephemeral: true })
        return
      }
      d.color = c
      break
    }
    case 'image':
      d.image = cleanUrl(val('image'), 'Image')
      break
    case 'thumbnail':
      d.thumbnail = cleanUrl(val('thumbnail'), 'Miniature')
      break
    case 'author':
      d.author = { name: val('name'), iconURL: cleanUrl(val('iconURL'), 'Icône auteur'), url: cleanUrl(val('url'), 'Lien auteur') }
      break
    case 'footer':
      d.footer = { text: val('text'), iconURL: cleanUrl(val('iconURL'), 'Icône footer') }
      break
    case 'content':
      d.content = val('content') || undefined
      break
    case 'addfield':
      d.fields = [...(d.fields ?? []), { name: val('name'), value: val('value'), inline: /^o/i.test(val('inline')) }]
      break
    case 'removefield': {
      const idx = parseInt(val('index'), 10) - 1
      if (!d.fields || idx < 0 || idx >= d.fields.length) {
        await interaction.reply({ content: '❌ Numéro de champ invalide.', ephemeral: true })
        return
      }
      d.fields.splice(idx, 1)
      break
    }
    case 'button': {
      const url = cleanUrl(val('url'), 'Lien du bouton')
      if (!url) {
        await interaction.reply({ content: '❌ Un bouton-lien a besoin d’une URL valide (commençant par `http`).', ephemeral: true })
        return
      }
      d.buttons = [...(d.buttons ?? []), { label: val('label'), url, emoji: val('emoji') || undefined }]
      break
    }
    case 'import':
      if (!mergeDiscohook(d, interaction.fields.getTextInputValue('json'))) {
        await interaction.reply({ content: '❌ JSON invalide.', ephemeral: true })
        return
      }
      break
  }

  if (interaction.isFromMessage()) {
    await interaction.update(renderEditor(draft))
    if (warnings.length) await interaction.followUp({ content: warnings.join('\n'), ephemeral: true }).catch(() => undefined)
  } else {
    await interaction.reply({ content: warnings.length ? warnings.join('\n') : '✅ Modifié.', ephemeral: true })
  }
}

export async function onEditorSave(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  embedStore.save(draft.guildId, draft.name, draft.data, interaction.user.id)
  await interaction.reply({ content: `💾 Embed **${draft.name}** sauvegardé. Publie-le avec \`/embed post ${draft.name}\`.`, ephemeral: true })
}

export async function onEditorPublishHere(interaction: ButtonInteraction): Promise<void> {
  const draft = drafts.get(interaction.user.id)
  if (!draft) return expired(interaction)
  if (isEmbedEmpty(draft.data) && !draft.data.content) {
    await interaction.reply({ content: '❌ L’embed est vide.', ephemeral: true })
    return
  }
  const channel = interaction.channel
  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    await interaction.reply({ content: '❌ Impossible de publier dans ce salon.', ephemeral: true })
    return
  }
  await channel.send(renderEmbedMessage(draft.data))
  await interaction.reply({ content: '📢 Embed publié dans ce salon.', ephemeral: true })
}

export async function onEditorClose(interaction: ButtonInteraction): Promise<void> {
  drafts.delete(interaction.user.id)
  await interaction.update({ content: '✅ Éditeur fermé.', embeds: [], components: [] })
}
