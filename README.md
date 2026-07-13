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
- ✅ **Embed builder** — `/embed create · edit · post · list · delete · clone` : crée des embeds **nommés, sauvegardés et éditables** via un éditeur interactif (titre, description, couleur, image/GIF, miniature, champs, auteur, footer, timestamp, texte, boutons-liens, import JSON Discohook). Stockés en **SQLite**.
- ✅ **Reaction-roles** — `/reactionrole` ouvre un **éditeur interactif** (menus déroulants + boutons) pour créer et publier un panneau de rôles, **entièrement depuis Discord**
- ✅ Message de bienvenue automatique
- 🔜 Reaction-roles enrichis (menu/réactions, descriptions, image), tickets, report, suggestions, FAQ, annonces, star-board, logs
- ⏳ (après le backend) embed paiement/accès + attribution automatique du rôle d'accès

### Base de données
Le bot utilise **`node:sqlite`** (module SQLite intégré à Node, aucune dépendance native).
Le fichier vit dans `data/z9bot.db` (ignoré par git). Le schéma est créé automatiquement au démarrage.

### Utiliser l'embed builder (`/embed`)
- `/embed create <nom>` → ouvre l'éditeur (menu « Éditer une partie » + aperçu en direct), puis **💾 Sauvegarder** ou **📢 Publier ici**.
- `/embed edit <nom>` → rouvre un embed pour le modifier.
- `/embed post <nom> [salon]` → publie un embed sauvegardé.
- `/embed list · delete · clone` → gérer ses embeds.

### Utiliser les reaction-roles (`/reactionrole`)
1. Taper `/reactionrole` (staff, permission *Gérer les rôles*) → un panneau d'édition **éphémère** s'ouvre.
2. **Menu « Ajouter des rôles »** → choisir les rôles dans la liste.
3. **Menu « Salon »** → choisir où publier.
4. Bouton **« ✏️ Titre & description »** → personnaliser le message.
5. Bouton **« ✅ Publier »** → le panneau à boutons est posté ; les membres cliquent pour s'attribuer/retirer les rôles.
6. ⚠️ Le **rôle du bot** doit être **au-dessus** des rôles distribués (Paramètres serveur → Rôles).

## Workflow
Développement en local → `git commit` → `git push` (repo dédié) → déploiement sur l'hébergeur
(Railway / Render / Fly.io). Le token et les secrets restent dans `.env` (jamais sur GitHub).
