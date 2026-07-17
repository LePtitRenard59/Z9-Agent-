import 'dotenv/config'

/** Récupère une variable obligatoire, avec un message clair si elle manque. */
function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} — vérifie ton fichier .env (voir .env.example).`)
  }
  return value
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: required('DISCORD_GUILD_ID'),

  // IDs des salons (optionnels : une fonctionnalité se désactive si son salon n'est pas renseigné)
  channels: {
    welcome: process.env.CHANNEL_WELCOME ?? '',
    goodbye: process.env.CHANNEL_GOODBYE ?? '',
    tickets: process.env.CHANNEL_TICKETS ?? '',
    reports: process.env.CHANNEL_REPORTS ?? '',
    suggestions: process.env.CHANNEL_SUGGESTIONS ?? '',
    bonsPlans: process.env.CHANNEL_BONS_PLANS ?? '',
    logs: process.env.CHANNEL_LOGS ?? '',
    roleLogs: process.env.CHANNEL_ROLE_LOGS ?? '',
    contenu: process.env.CHANNEL_CONTENU ?? '',
  },
} as const

/** Couleur d'accent Z9 (orange été) pour les embeds du bot. */
export const Z9_COLOR = 0xe8943a
