# z9-discord-bot

Bot Discord custom du serveur **Z9**, en `discord.js` + TypeScript.

> ⚠️ La modération et la vérification sont gérées par **RaidProtect** — ce bot s'occupe du reste
> (embeds, tickets, reaction-roles, report, bienvenue, suggestions, FAQ, annonces, star-board, logs…).

## Prérequis
- **Node.js 18+**
- Une application Discord créée sur le [Developer Portal](https://discord.com/developers/applications)
  avec les **Privileged Intents** activés : *Server Members Intent* et *Message Content Intent*.

## Installation
```bash
npm install
```

## Configuration
1. Copier `.env.example` en **`.env`**.
2. Renseigner :
   - `DISCORD_TOKEN` → le token du bot (**secret**, jamais commité).
   - `DISCORD_CLIENT_ID` → déjà pré-rempli (Application ID, public).
   - `DISCORD_GUILD_ID` → l'ID du serveur Z9.
   - les `CHANNEL_*` → IDs des salons (Mode développeur Discord → clic droit → *Copier l'identifiant*).

## Déployer les slash-commands
À lancer une fois, puis à chaque ajout/modif de commande :
```bash
npm run deploy
```

## Lancer le bot
```bash
npm run dev     # développement (rechargement auto)
npm run build   # compile en JavaScript (dossier dist/)
npm start       # exécute la version compilée (production)
```

## Structure
```
src/
  index.ts            Démarrage + connexion Discord
  deploy-commands.ts  Enregistrement des slash-commands
  config.ts           Lecture du .env + IDs centralisés
  commands/           Slash-commands (/ping, /embed, …)
  events/             Écouteurs d'événements (interactions, arrivées membres, …)
  types/              Types partagés
embeds/               JSON Discohook versionnés (embeds réutilisables)
```

## Fonctionnalités
- ✅ `/ping` — test de latence
- ✅ `/embed` — publie un embed conçu sur [Discohook](https://discohook.org) (colle le JSON)
- ✅ Message de bienvenue automatique
- 🔜 Tickets, reaction-roles, report, suggestions, FAQ, annonces, star-board, logs
- ⏳ (après le backend) embed paiement/accès + attribution automatique du rôle d'accès

## Workflow
Développement en local → `git commit` → `git push` (repo dédié) → déploiement sur l'hébergeur
(Railway / Render / Fly.io). Le token et les secrets restent dans `.env` (jamais sur GitHub).
