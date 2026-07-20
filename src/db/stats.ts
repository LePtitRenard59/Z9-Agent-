import { db } from './index'

export interface StatsConfig {
  categoryId?: string
  membersChannelId?: string
  boostsChannelId?: string
  inviteChannelId?: string
}

const selectStmt = db.prepare('SELECT data FROM stats WHERE guild_id = ?')
const allStmt = db.prepare('SELECT guild_id, data FROM stats')
const upsertStmt = db.prepare(
  `INSERT INTO stats (guild_id, data) VALUES (?, ?)
   ON CONFLICT(guild_id) DO UPDATE SET data = excluded.data`,
)
const deleteStmt = db.prepare('DELETE FROM stats WHERE guild_id = ?')

export const statsStore = {
  get(guildId: string): StatsConfig | null {
    const row = selectStmt.get(guildId) as { data: string } | undefined
    return row ? (JSON.parse(row.data) as StatsConfig) : null
  },
  save(guildId: string, config: StatsConfig): void {
    upsertStmt.run(guildId, JSON.stringify(config))
  },
  delete(guildId: string): void {
    deleteStmt.run(guildId)
  },
  all(): { guildId: string; config: StatsConfig }[] {
    return (allStmt.all() as unknown as { guild_id: string; data: string }[]).map(r => ({
      guildId: r.guild_id,
      config: JSON.parse(r.data) as StatsConfig,
    }))
  },
}
