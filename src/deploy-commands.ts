import { REST, Routes } from 'discord.js'
import { config } from './config'
import { commands } from './commands'

/**
 * Enregistre les slash-commands sur le serveur Z9 (déploiement « guild » =
 * instantané, idéal en développement). À relancer à chaque ajout/modif de commande :
 *   npm run deploy
 */
async function main(): Promise<void> {
  const body = commands.map(command => command.data.toJSON())
  const rest = new REST().setToken(config.token)

  console.log(`Déploiement de ${body.length} commande(s) sur la guilde ${config.guildId}…`)
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body })
  console.log('✅ Commandes déployées.')
}

main().catch(error => {
  console.error('❌ Échec du déploiement des commandes :', error)
  process.exit(1)
})
