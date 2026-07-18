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
- ✅ **Reaction-roles** — `/reactionrole create · edit · list · delete` : éditeur interactif **entièrement depuis Discord**, organisé en sections (écran principal + écran par groupe). Un panneau = **un embed riche + plusieurs groupes** (jusqu'à 5 rangées) : chaque groupe est un **menu**, des **boutons** ou des **réactions**, avec son propre comportement (normal / unique / ajout-seul / limité), ses rôles (emoji, description, label, style) et son titre. Plus des **boutons-liens**. → permet plusieurs menus (Ton Pays, Ta ville…) sur un seul message. Apparence via formulaire **ou** embed sauvegardé complet. **Édition** en place + **logs** (`CHANNEL_ROLE_LOGS`). Persistés en SQLite (JSON).
- ✅ **Tickets** — `/tickets panel · edit · list · delete` : éditeur interactif pour un panneau à **menu de catégories**. À l'ouverture, création d'un **salon privé** (membre + rôles staff), boutons **Prendre en charge** / **Fermer**, **anti-doublon** (1 ticket ouvert par catégorie). Fermeture → **transcript HTML** archivé dans le salon de logs + suppression du salon.
- ✅ **Report** — menus contextuels (clic droit) **« Signaler le message »** et **« Signaler le membre »** → formulaire de raison → récap envoyé dans `#signalements` (`CHANNEL_REPORTS`) avec boutons staff **Marquer traité / Ignorer**. Cooldown anti-abus.
- ✅ **Bienvenue / Au revoir** — `/welcome` et `/goodbye` : éditeur interactif (salon, message **texte** ou **embed**, **import JSON Discohook** ou **embed sauvegardé**, activer/désactiver, bouton **Tester**). **Variables** `{user}` `{username}` `{tag}` `{server}` `{membercount}` (remplacées aussi dans l'embed importé). Envoi auto à l'arrivée / au départ. Config en SQLite.
- 🔜 Suggestions, FAQ, annonces, star-board, logs, reaction-roles avancés (rôles temporaires)
- ⏳ (après le backend) embed paiement/accès + attribution automatique du rôle d'accès

### Utiliser les tickets (`/tickets panel`)
1. `/tickets panel` (staff) dans le salon où publier le panneau → éditeur éphémère.
2. **Rôle staff** (qui voit les tickets), **Catégorie parent** (où créer les salons), **Salon des transcripts**.
3. **⚙️ Configurer…** → Apparence · Ajouter une catégorie (nom, emoji, description, message d'accueil) · Éditer / Retirer.
4. **✅ Publier ici** → le membre choisit une catégorie dans le menu → un salon privé `ticket-…` est créé.
5. Dans le ticket : **Prendre en charge** (staff) · **Fermer** → transcript HTML dans le salon de logs, puis suppression.

### Base de données
Le bot utilise **`node:sqlite`** (module SQLite intégré à Node, aucune dépendance native).
Le fichier vit dans `data/z9bot.db` (ignoré par git). Le schéma est créé automatiquement au démarrage.

### Utiliser l'embed builder (`/embed`)
- `/embed create <nom>` → ouvre l'éditeur (menu « Éditer une partie » + aperçu en direct), puis **💾 Sauvegarder** ou **📢 Publier ici**.
- `/embed edit <nom>` → rouvre un embed pour le modifier.
- `/embed post <nom> [salon]` → publie un embed sauvegardé.
- `/embed list · delete · clone` → gérer ses embeds.

### Utiliser les reaction-roles (`/reactionrole create`)
**Écran principal** :
- **Salon de publication** (menu de salons)
- **⚙️ Configurer…** → Apparence (titre/couleur/image/miniature), Ajouter un groupe, Éditer le groupe N, Ajouter un bouton-lien
- **🎨 Charger un embed sauvegardé** (apparence complète, si un embed existe)
- **✅ Publier / Mettre à jour**

**Écran d'un groupe** (après « Ajouter/Éditer un groupe ») :
- **Ajouter des rôles** (menu de rôles)
- **⚙️ Réglages du groupe** → Type (menu / boutons / réactions), Comportement (normal / unique / ajout-seul / limité), Titre du menu, Configurer un rôle (emoji/description/label/style), Retirer un rôle
- **⬅️ Retour** · **🗑️ Supprimer le groupe**

Notes :
- Max **5 rangées** de composants par message (l'éditeur affiche le compteur `Rangées : X/5`).
- ⚠️ Le **rôle du bot** doit être **au-dessus** des rôles distribués.
- Logs : `CHANNEL_ROLE_LOGS` (sinon `CHANNEL_LOGS`).
- `/reactionrole edit <id>` rouvre l'éditeur · `list` liste les `#id` · `delete <id>` supprime.

## Workflow
Développement en local → `git commit` → `git push` (repo dédié) → déploiement sur l'hébergeur
(Railway / Render / Fly.io). Le token et les secrets restent dans `.env` (jamais sur GitHub).
