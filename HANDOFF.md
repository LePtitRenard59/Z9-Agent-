# 🔄 Reprise du projet Z9 (handoff multi-machine)

Ce document résume **tout l'état du projet** pour reprendre sur n'importe quelle machine.
Il voyage avec le code via GitHub — pas besoin de copier des fichiers cachés `.claude`.

## ▶️ Continuer avec Claude sur une nouvelle machine
1. Installer **Node.js** (18+).
2. Récupérer les deux dépôts (privés) :
   - App : `https://github.com/LePtitRenard59/z9-catalog`
   - Bot : `https://github.com/LePtitRenard59/Z9-Agent-`
   (soit `git clone`, soit le dossier déjà transféré.)
3. Dans **chaque** projet : `npm install`.
4. Si PowerShell bloque npm : `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
5. Bot : recréer le fichier **`.env`** depuis `.env.example` (token du bot, `DISCORD_GUILD_ID`, IDs des salons).
6. Ouvrir Claude Code dans le projet et dire :
   > « Lis HANDOFF.md, on reprend le projet Z9. »

> ⚠️ La mémoire de Claude et l'historique de conversation restent **locaux à chaque PC**
> (dossier `~/.claude`). Ce fichier remplace ce contexte de façon portable.

---

## 🗺️ Vue d'ensemble
**Z9 Catalog** = app web privée (React 18 + Vite + TS + Tailwind) de gestion de catalogue
(articles, marques, fournisseurs, transporteurs, looks, wishlist) avec une **vitrine publique**
`/accueil` menant à un **accès privé** (le Hub `/`). Objectif à terme : **plateforme privée payante**
avec identité **Discord**, paiement **Stripe**, backend **Supabase**, hébergement **Vercel**.

Deux dépôts séparés :
- **z9-catalog** — l'application React.
- **Z9-Agent-** — le bot Discord custom (`discord.js` + TS).

## 🧭 Workflow local → en ligne
Développer en **local** → `git commit` → `git push` → (plus tard) Vercel déploie l'app automatiquement.
Le bot se déploiera sur un hébergeur persistant (Railway / Render / Fly.io). Secrets uniquement dans `.env` (jamais commités).

## 📌 Roadmap backend (phase monétisation) — sous-phases
1. ✅ **Nettoyage/conformité** de l'app (fait : ancien login retiré, `.gitignore` secrets, README, lint).
2. ⏳ **Supabase** (base + auth Discord + Edge Functions).
3. ⏳ Migration localStorage → Supabase.
4. ⏳ Connexion Discord (OAuth).
5. ⏳ Paiement Stripe.
6. ⏳ Webhook accès actif.
7. ⏳ Rôle Discord automatique.
8. ⏳ Hébergement Vercel.
9. ⏳ Tests complets avant lancement.

**10 points à valider avant de coder le backend :** paiement unique/abonnement · durée d'accès ·
nom exact du rôle Discord · ID serveur · salon de l'embed · texte de l'embed · boutons de l'embed ·
prix de lancement · données user à sauvegarder · solution backend retenue.

## 🤖 État du bot Discord
- **Fait :** scaffold `discord.js`+TS, `/ping` (testé ✅), `/embed` (publie du JSON Discohook via modal),
  message de bienvenue, config `.env` centralisée, déploiement guild des slash-commands. En ligne, invité en **Administrateur**, intents privilégiés activés.
- **Client ID (public) :** `1525157784109449297`.
- **Périmètre validé :** embeds à boutons, reaction-roles, tickets, report, bienvenue/départ,
  suggestions, FAQ, annonces, star-board→#bons-plans, auto-thread, logs, `/addcontent`, utilitaires.
  **Modération + vérification = laissées à RaidProtect** (pas dans ce bot).
- **Embeds :** design par l'utilisateur sur Discohook (JSON) + boutons fonctionnels codés dans le bot
  (Discohook ne fait que des boutons-liens).
- ⏳ **Après le backend :** embed paiement/accès (#accéder-z9) + attribution/retrait auto du rôle d'accès + logs paiements/connexions + auto-post catalogue.

### 👉 PROCHAINE ÉTAPE en cours
Coder le module **reaction-roles** : commande staff `/setup-roles` qui poste un panneau à boutons,
le bot attribue/retire les rôles au clic. **En attente : les noms des rôles à proposer.**
Puis : module **tickets**.

## 🗂️ Carte des salons Discord
- VÉRIFICATION : vérification, verification, partager
- ACCUEIL : reglement, bienvenue, ciao
- INFORMATION : annonces, accéder-z9 (futur embed paiement), mises-à-jour, retours-utilisateurs, faq
- TEXTUEL : general, share-your-qc, haul, cmd, suggestion
- ESPACE Z9 (privé) : nouveautés-catalogue, nouveaux-fournisseurs, transporteurs, bons-plans
- STAFF (privé) : general-staff, test-bot, logs-paiements, logs-connexions, logs-rôles, signalements,
  contenu-à-ajouter, raidprotect-logs, logs, moderator-only, + vocaux
- AIDE : Tickets, aide, report, + vocal support

## 🔒 Sécurité
- Secrets (token bot, clés Stripe/Discord/Supabase) : **jamais** dans le code/GitHub — uniquement `.env` local + variables d'environnement de l'hébergeur.
- Front : seules les variables préfixées `VITE_` sont publiques.
