/** Représentation d'un embed sauvegardé (sérialisée en JSON dans la base). */
export interface StoredEmbed {
  /** Texte du message, hors embed. */
  content?: string
  title?: string
  url?: string
  description?: string
  /** Couleur au format entier (0xRRGGBB). */
  color?: number
  author?: { name: string; iconURL?: string; url?: string }
  footer?: { text: string; iconURL?: string }
  image?: string
  thumbnail?: string
  timestamp?: boolean
  fields?: { name: string; value: string; inline?: boolean }[]
  /** Boutons-liens (ouvrent une URL). */
  buttons?: { label: string; url: string; emoji?: string }[]
}

export function emptyEmbed(): StoredEmbed {
  return {}
}
