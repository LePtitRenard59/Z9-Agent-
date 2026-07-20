import { ChannelType, PermissionFlagsBits, type Guild, type GuildBasedChannel } from 'discord.js'
import { statsStore } from '../../db/stats'

function membersName(guild: Guild): string {
  return `👥 Membres : ${guild.memberCount}`
}
function boostsName(guild: Guild): string {
  return `🚀 Boosts : ${guild.premiumSubscriptionCount ?? 0}`
}

/** Chaîne d'invitation : vanity si dispo, sinon création d'une invitation permanente. */
async function inviteName(guild: Guild): Promise<string> {
  if (guild.vanityURLCode) return `🔗 .gg/${guild.vanityURLCode}`
  const me = guild.members.me
  const channel = guild.channels.cache.find(
    (c): c is GuildBasedChannel =>
      c.type === ChannelType.GuildText && Boolean(me) && Boolean(c.permissionsFor(me!)?.has(PermissionFlagsBits.CreateInstantInvite)),
  )
  if (channel && channel.type === ChannelType.GuildText) {
    const invite = await channel.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null)
    if (invite) return `🔗 discord.gg/${invite.code}`
  }
  return '🔗 discord.gg'
}

/** Crée la catégorie + les salons vocaux de stats (verrouillés). */
export async function createStats(guild: Guild): Promise<void> {
  const denyConnect = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }]
  const category = await guild.channels.create({ name: '📊 Statistiques', type: ChannelType.GuildCategory })
  const members = await guild.channels.create({ name: membersName(guild), type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: denyConnect })
  const boosts = await guild.channels.create({ name: boostsName(guild), type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: denyConnect })
  const invite = await guild.channels.create({ name: await inviteName(guild), type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: denyConnect })

  statsStore.save(guild.id, {
    categoryId: category.id,
    membersChannelId: members.id,
    boostsChannelId: boosts.id,
    inviteChannelId: invite.id,
  })
}

async function renameIfChanged(guild: Guild, channelId: string | undefined, name: string): Promise<void> {
  if (!channelId) return
  const channel = guild.channels.cache.get(channelId)
  if (channel && channel.name !== name) await channel.setName(name).catch(() => undefined)
}

/** Met à jour les compteurs (membres, boosts) — l'invitation ne change pas. */
export async function updateGuildStats(guild: Guild): Promise<void> {
  const cfg = statsStore.get(guild.id)
  if (!cfg) return
  await renameIfChanged(guild, cfg.membersChannelId, membersName(guild))
  await renameIfChanged(guild, cfg.boostsChannelId, boostsName(guild))
}

/** Supprime les salons de stats + la config. */
export async function removeStats(guild: Guild): Promise<void> {
  const cfg = statsStore.get(guild.id)
  if (!cfg) return
  for (const id of [cfg.membersChannelId, cfg.boostsChannelId, cfg.inviteChannelId, cfg.categoryId]) {
    if (!id) continue
    await guild.channels.cache.get(id)?.delete().catch(() => undefined)
  }
  statsStore.delete(guild.id)
}
