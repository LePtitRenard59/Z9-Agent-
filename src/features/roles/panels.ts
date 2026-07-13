import { ButtonStyle } from 'discord.js'

export interface RoleButton {
  /** ID du rôle Discord (voir README : comment récupérer un ID de rôle). */
  roleId: string
  label: string
  emoji?: string
  style?: ButtonStyle
}

export interface RolePanel {
  /** Clé unique du panneau, utilisée par /setup-roles panneau:<key>. */
  key: string
  title: string
  description: string
  roles: RoleButton[]
}

/**
 * ✏️ À PERSONNALISER : remplis chaque `roleId` avec l'ID du rôle correspondant.
 * Pour obtenir un ID de rôle : tape « \@NomDuRole » dans un salon (avec l'antislash)
 * → Discord affiche « <@&123456789> » : le nombre est l'ID.
 * Un rôle sans `roleId` renseigné est simplement ignoré (aucun bouton).
 */
export const rolePanels: RolePanel[] = [
  {
    key: 'notifs',
    title: '🔔 Choisis tes notifications',
    description: 'Clique sur un bouton pour **recevoir** (ou **retirer**) les pings qui t’intéressent.',
    roles: [
      { roleId: '', label: 'Nouveautés', emoji: '🆕', style: ButtonStyle.Secondary },
      { roleId: '', label: 'Bons plans', emoji: '💸', style: ButtonStyle.Secondary },
      { roleId: '', label: 'Drops', emoji: '🔥', style: ButtonStyle.Secondary },
    ],
  },
]
