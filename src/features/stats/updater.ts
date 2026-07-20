import type { Client } from 'discord.js'
import { statsStore } from '../../db/stats'
import { updateGuildStats } from './service'

const INTERVAL_MS = 10 * 60 * 1000 // 10 min (le renommage de salons est fortement rate-limité)

/** Lance la mise à jour périodique des salons de stats de toutes les guildes. */
export function startStatsUpdater(client: Client): void {
  const tick = async (): Promise<void> => {
    for (const { guildId } of statsStore.all()) {
      const guild = client.guilds.cache.get(guildId)
      if (guild) await updateGuildStats(guild).catch(() => undefined)
    }
  }
  void tick() // première passe au démarrage
  setInterval(() => void tick(), INTERVAL_MS)
}
