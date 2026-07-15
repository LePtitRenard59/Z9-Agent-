import { EmbedBuilder, type GuildMember } from 'discord.js'
import { config, Z9_COLOR } from '../../config'
import type { RolePanel } from './types'

export interface ApplyResult {
  added: string[]
  removed: string[]
  refused?: string
}

function panelRoleIds(panel: RolePanel): string[] {
  return panel.entries.map(e => e.roleId)
}

/** Donne un rôle en respectant le comportement (unique / limite). */
export async function addRole(member: GuildMember, panel: RolePanel, roleId: string): Promise<ApplyResult> {
  const res: ApplyResult = { added: [], removed: [] }
  if (member.roles.cache.has(roleId)) return res

  if (panel.behavior === 'unique') {
    const others = panelRoleIds(panel).filter(id => id !== roleId && member.roles.cache.has(id))
    if (others.length) {
      await member.roles.remove(others)
      res.removed.push(...others)
    }
  } else if (panel.behavior === 'limit' && panel.limitCount) {
    const count = panelRoleIds(panel).filter(id => member.roles.cache.has(id)).length
    if (count >= panel.limitCount) {
      res.refused = `Limite atteinte : ${panel.limitCount} rôle(s) maximum sur ce panneau.`
      return res
    }
  }

  await member.roles.add(roleId)
  res.added.push(roleId)
  return res
}

/** Retire un rôle (sauf comportement « ajout seul »). */
export async function removeRole(member: GuildMember, panel: RolePanel, roleId: string): Promise<ApplyResult> {
  const res: ApplyResult = { added: [], removed: [] }
  if (panel.behavior === 'add_only') {
    res.refused = 'Ce panneau est en « ajout seul » : le rôle ne peut pas être retiré ici.'
    return res
  }
  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId)
    res.removed.push(roleId)
  }
  return res
}

/** Clic sur un bouton : bascule le rôle selon le comportement. */
export async function toggleButton(member: GuildMember, panel: RolePanel, roleId: string): Promise<ApplyResult> {
  if (member.roles.cache.has(roleId)) return removeRole(member, panel, roleId)
  return addRole(member, panel, roleId)
}

/** Menu déroulant : la sélection définit l'ensemble des rôles du panneau. */
export async function applySelect(member: GuildMember, panel: RolePanel, selected: string[]): Promise<ApplyResult> {
  const res: ApplyResult = { added: [], removed: [] }
  const ids = panelRoleIds(panel)
  const desired = selected.filter(id => ids.includes(id))

  if (panel.behavior === 'limit' && panel.limitCount && desired.length > panel.limitCount) {
    res.refused = `Trop de rôles : ${panel.limitCount} maximum.`
    return res
  }

  const toAdd = desired.filter(id => !member.roles.cache.has(id))
  const toRemove = panel.behavior === 'add_only' ? [] : ids.filter(id => !desired.includes(id) && member.roles.cache.has(id))

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

/** Journalise un changement de rôles dans le salon de logs, si configuré. */
export async function logRoleChange(member: GuildMember, res: ApplyResult): Promise<void> {
  if (!config.channels.logs || (res.added.length === 0 && res.removed.length === 0)) return
  const channel = member.guild.channels.cache.get(config.channels.logs)
  if (!channel || !channel.isTextBased() || !('send' in channel)) return

  const lines = [
    ...res.added.map(id => `➕ <@&${id}>`),
    ...res.removed.map(id => `➖ <@&${id}>`),
  ]
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
  const parts: string[] = []
  for (const id of res.added) parts.push(`➕ **${roleName(id)}**`)
  for (const id of res.removed) parts.push(`➖ **${roleName(id)}**`)
  return parts.length ? parts.join('\n') : 'Aucun changement.'
}
