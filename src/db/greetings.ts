import { db } from './index'
import { defaultGreeting, type GreetingConfig, type GreetingKind } from '../features/greetings/types'

const selectStmt = db.prepare('SELECT data FROM greetings WHERE guild_id = ? AND kind = ?')
const upsertStmt = db.prepare(
  `INSERT INTO greetings (guild_id, kind, data) VALUES (?, ?, ?)
   ON CONFLICT(guild_id, kind) DO UPDATE SET data = excluded.data`,
)

export const greetingStore = {
  get(guildId: string, kind: GreetingKind): GreetingConfig {
    const row = selectStmt.get(guildId, kind) as { data: string } | undefined
    if (!row) return defaultGreeting(kind)
    return { ...defaultGreeting(kind), ...(JSON.parse(row.data) as GreetingConfig) }
  },
  save(guildId: string, kind: GreetingKind, config: GreetingConfig): void {
    upsertStmt.run(guildId, kind, JSON.stringify(config))
  },
}
