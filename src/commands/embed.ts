import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { Command } from '../types/command'
import { embedStore } from '../db/embeds'
import { emptyEmbed } from '../features/embeds/types'
import { openEditor } from '../features/embeds/editor'
import { isEmbedEmpty, renderEmbedMessage } from '../features/embeds/render'

/**
 * /embed — constructeur d'embeds nommés, éditables et réutilisables (façon Mimu).
 * Sous-commandes : create · edit · post · list · delete · clone.
 */
export const embed: Command = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Créer et gérer des embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s =>
      s.setName('create').setDescription('Créer un nouvel embed nommé')
        .addStringOption(o => o.setName('nom').setDescription('Nom de l’embed').setRequired(true)),
    )
    .addSubcommand(s =>
      s.setName('edit').setDescription('Éditer un embed existant')
        .addStringOption(o => o.setName('nom').setDescription('Nom de l’embed').setRequired(true)),
    )
    .addSubcommand(s =>
      s.setName('post').setDescription('Publier un embed')
        .addStringOption(o => o.setName('nom').setDescription('Nom de l’embed').setRequired(true))
        .addChannelOption(o => o.setName('salon').setDescription('Salon (par défaut : ici)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
    )
    .addSubcommand(s => s.setName('list').setDescription('Lister les embeds enregistrés'))
    .addSubcommand(s =>
      s.setName('delete').setDescription('Supprimer un embed')
        .addStringOption(o => o.setName('nom').setDescription('Nom de l’embed').setRequired(true)),
    )
    .addSubcommand(s =>
      s.setName('clone').setDescription('Dupliquer un embed')
        .addStringOption(o => o.setName('source').setDescription('Embed à copier').setRequired(true))
        .addStringOption(o => o.setName('nouveau').setDescription('Nom de la copie').setRequired(true)),
    ),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ Commande utilisable uniquement sur un serveur.', ephemeral: true })
      return
    }
    const guildId = interaction.guildId
    const sub = interaction.options.getSubcommand()

    switch (sub) {
      case 'create': {
        const name = interaction.options.getString('nom', true)
        if (embedStore.exists(guildId, name)) {
          await interaction.reply({ content: `❌ Un embed **${name}** existe déjà. Utilise \`/embed edit ${name}\`.`, ephemeral: true })
          return
        }
        await openEditor(interaction, name, guildId, emptyEmbed())
        return
      }
      case 'edit': {
        const name = interaction.options.getString('nom', true)
        const record = embedStore.get(guildId, name)
        if (!record) {
          await interaction.reply({ content: `❌ Aucun embed nommé **${name}**.`, ephemeral: true })
          return
        }
        await openEditor(interaction, name, guildId, record.data)
        return
      }
      case 'post': {
        const name = interaction.options.getString('nom', true)
        const record = embedStore.get(guildId, name)
        if (!record) {
          await interaction.reply({ content: `❌ Aucun embed nommé **${name}**.`, ephemeral: true })
          return
        }
        if (isEmbedEmpty(record.data) && !record.data.content) {
          await interaction.reply({ content: '❌ Cet embed est vide.', ephemeral: true })
          return
        }
        const targetId = interaction.options.getChannel('salon')?.id ?? interaction.channelId
        const target = targetId ? await interaction.guild?.channels.fetch(targetId).catch(() => null) : null
        if (!target || !target.isTextBased() || !('send' in target)) {
          await interaction.reply({ content: '❌ Salon de publication invalide.', ephemeral: true })
          return
        }
        await target.send(renderEmbedMessage(record.data))
        await interaction.reply({ content: `📢 Embed **${name}** publié dans <#${target.id}>.`, ephemeral: true })
        return
      }
      case 'list': {
        const names = embedStore.list(guildId)
        await interaction.reply({
          content: names.length ? `📁 Embeds enregistrés :\n${names.map(n => `• \`${n}\``).join('\n')}` : 'Aucun embed enregistré. Crée-en un avec `/embed create <nom>`.',
          ephemeral: true,
        })
        return
      }
      case 'delete': {
        const name = interaction.options.getString('nom', true)
        const ok = embedStore.delete(guildId, name)
        await interaction.reply({ content: ok ? `🗑️ Embed **${name}** supprimé.` : `❌ Aucun embed nommé **${name}**.`, ephemeral: true })
        return
      }
      case 'clone': {
        const source = interaction.options.getString('source', true)
        const target = interaction.options.getString('nouveau', true)
        const ok = embedStore.clone(guildId, source, target, interaction.user.id)
        await interaction.reply({
          content: ok ? `📑 **${source}** dupliqué vers **${target}**.` : `❌ Impossible (source introuvable ou **${target}** existe déjà).`,
          ephemeral: true,
        })
        return
      }
    }
  },
}
