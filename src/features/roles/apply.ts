import { EmbedBuilder, type GuildMember } from 'discord.js'
import { config, Z9_COLOR } from '../../config'
import type { RoleGroup } from './types'

export interface ApplyResult {
  added: string[]
  removed: string[]
  refused?: string
}

function groupRoleIds(group: RoleGroup): string[] {
  return group.entries.map(e => e.roleId)
}

/** Donne un rôle du groupe en respectant son comportement (unique / limite). */
export async function addRole(member: GuildMember, group: RoleGroup, roleId: string): Promise<ApplyResult> {
  const res: ApplyResult = { added: [], removed: [] }
  if (member.roles.cache.has(roleId)) return res

  if (group.behavior === 'unique') {
    const others = groupRoleIds(group).filter(id => id !== roleId && member.roles.cache.has(id))
    if (others.length) {
      await member.roles.remove(others)
      res.removed.push(...others)
    }
  } else if (group.behavior === 'limit' && group.limitCount) {
    const count = groupRoleIds(group).filter(id => member.roles.cache.has(id)).length
    if (count >= group.limitCount) {
      res.refused = `Limite atteinte : ${group.limitCount} rôle(s) maximum pour ce groupe.`
      return res
    }
  }

  await member.roles.add(roleId)
  res.added.push(roleId)
  return res
}

/** Retire un rôle du groupe (sauf comportement « ajout seul »). */
export async function removeRole(member: GuildMember, group: RoleGroup, roleId: string): Promise<ApplyResult> {
  const res: ApplyResult = { added: [], removed: [] }
  if (group.behavior === 'add_only') {
    res.refused = 'Ce groupe est en « ajout seul » : le rôle ne peut pas être retiré ici.'
    return res
  }
  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId)
    res.removed.push(roleId)
  }
  return res
}

/** Clic sur un bouton : bascule le rôle selon le comportement du groupe. */
export async function toggleButton(member: GuildMember, group: RoleGroup, roleId: string): Promise<ApplyResult> {
  if (member.roles.cache.has(roleId)) return removeRole(member, group, roleId)
  return addRole(member, group, roleId)
}

/** Menu déroulant : la sélection définit l'ensemble des rôles du groupe. */
export async function applySelect(member: GuildMember, group: RoleGroup, selected: string[]): Promise<ApplyResult> {
  const res: ApplyResult = { added: [], removed: [] }
  const ids = groupRoleIds(group)
  const desired = selected.filter(id => ids.includes(id))

  if (group.behavior === 'limit' && group.limitCount && desired.length > group.limitCount) {
    res.refused = `Trop de rôles : ${group.limitCount} maximum.`
    return res
  }

  const toAdd = desired.filter(id => !member.roles.cache.has(id))
  const toRemove = group.behavior === 'add_only' ? [] : ids.filter(id => !desired.includes(id) && member.roles.cache.has(id))

  if (toAdd.length) {
    await member.roles.add(toAdd)
    res.added.push(...toAdd)
  }
  if (toRemove.length) {
    await member.roles.remove(toRemove)
    res.removed.push(...toRemove)
  }
  return res
}

/** Journalise un changement de rôles dans le salon de logs (dédié ou général), si configuré. */
export async function logRoleChange(member: GuildMember, res: ApplyResult): Promise<void> {
  const channelId = config.channels.roleLogs || config.channels.logs
  if (!channelId || (res.added.length === 0 && res.removed.length === 0)) return
  const channel = member.guild.channels.cache.get(channelId)
  if (!channel || !channel.isTextBased() || !('send' in channel)) return

  const lines = [...res.added.map(id => `➕ <@&${id}>`), ...res.removed.map(id => `➖ <@&${id}>`)]
  const embed = new EmbedBuilder()
    .setColor(Z9_COLOR)
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setDescription(`**Rôles** pour <@${member.id}>\n${lines.join('\n')}`)
    .setTimestamp()
  await channel.send({ embeds: [embed] }).catch(() => undefined)
}

/** Résumé lisible pour la réponse éphémère au membre. */
export function summarize(res: ApplyResult, roleName: (id: string) => string): string {
  if (res.refused) return `⚠️ ${res.refused}`
  const parts = [...res.added.map(id => `➕ **${roleName(id)}**`), ...res.removed.map(id => `➖ **${roleName(id)}**`)]
  return parts.length ? parts.join('\n') : 'Aucun changement.'
}
