import type { Emoji, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js'
import { rolePanelStore } from '../db/rolePanels'
import { addRole, logRoleChange, removeRole } from '../features/roles/apply'

/** Compare l'emoji stocké d'une entrée à l'emoji d'une réaction. */
function entryMatches(entryEmoji: string | undefined, emoji: Emoji): boolean {
  if (!entryEmoji) return false
  if (emoji.id) return entryEmoji.includes(emoji.id) // emoji custom : compare l'ID
  return entryEmoji === emoji.name // emoji unicode
}

async function handle(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  add: boolean,
): Promise<void> {
  if (user.bot) return
  try {
    if (reaction.partial) await reaction.fetch()
    const message = reaction.message
    if (!message.guildId || !message.guild) return

    const panel = rolePanelStore.getByMessage(message.guildId, message.id)
    if (!panel) return

    // Cherche, parmi les groupes « réactions », celui dont un emoji correspond.
    let match: { groupIdx: number; roleId: string } | undefined
    for (let i = 0; i < panel.groups.length; i++) {
      const group = panel.groups[i]
      if (group.type !== 'reactions') continue
      const entry = group.entries.find(e => entryMatches(e.emoji, reaction.emoji))
      if (entry) {
        match = { groupIdx: i, roleId: entry.roleId }
        break
      }
    }
    if (!match) return

    const member = await message.guild.members.fetch(user.id).catch(() => null)
    if (!member) return

    const group = panel.groups[match.groupIdx]
    const res = add ? await addRole(member, group, match.roleId) : await removeRole(member, group, match.roleId)
    await logRoleChange(member, res)
  } catch (error) {
    console.error('Erreur réaction → rôle :', error)
  }
}

export function onReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): void {
  void handle(reaction, user, true)
}

export function onReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): void {
  void handle(reaction, user, false)
}
