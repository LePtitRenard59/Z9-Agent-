import { EmbedBuilder, type GuildMember } from 'discord.js'
import { config, Z9_COLOR } from '../config'

/** Message de bienvenue automatique à l'arrivée d'un membre. */
export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  if (!config.channels.welcome) return

  const channel = member.guild.channels.cache.get(config.channels.welcome)
  if (!channel || !channel.isTextBased() || !('send' in channel)) return

  const embed = new EmbedBuilder()
    .setColor(Z9_COLOR)
    .setTitle(`Bienvenue ${member.user.username} 👋`)
    .setDescription(
      "Content de t'accueillir sur **Z9** !\n" +
        'Pense à lire le règlement et à te vérifier pour accéder au reste du serveur.',
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp()

  await channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => undefined)
}
