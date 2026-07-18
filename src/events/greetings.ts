import type { GuildMember, PartialGuildMember } from 'discord.js'
import { greetingStore } from '../db/greetings'
import { buildGreetingMessage, type GreetingVars } from '../features/greetings/render'
import type { GreetingKind } from '../features/greetings/types'

function varsFor(member: GuildMember | PartialGuildMember): GreetingVars {
  return {
    userMention: `<@${member.id}>`,
    username: member.user.username,
    tag: member.user.tag,
    server: member.guild.name,
    memberCount: member.guild.memberCount,
  }
}

async function sendGreeting(member: GuildMember | PartialGuildMember, kind: GreetingKind): Promise<void> {
  const cfg = greetingStore.get(member.guild.id, kind)
  if (!cfg.enabled || !cfg.channelId) return
  const channel = member.guild.channels.cache.get(cfg.channelId)
  if (!channel || !channel.isTextBased() || !('send' in channel)) return
  const message = buildGreetingMessage(cfg, varsFor(member))
  if (message) await channel.send(message).catch(() => undefined)
}

export function onGuildMemberAdd(member: GuildMember): void {
  void sendGreeting(member, 'welcome')
}

export function onGuildMemberRemove(member: GuildMember | PartialGuildMember): void {
  void sendGreeting(member, 'goodbye')
}
