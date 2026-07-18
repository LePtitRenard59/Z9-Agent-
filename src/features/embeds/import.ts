import type { StoredEmbed } from './types'

/**
 * Fusionne un JSON Discohook dans un embed. Tolérant aux ``` / ```json et espaces
 * autour du JSON collé. Retourne false si le JSON est invalide.
 */
export function mergeDiscohook(d: StoredEmbed, raw: string): boolean {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return false
  }
  const root = parsed as Record<string, unknown>
  const src = (root.messages as { data?: Record<string, unknown> }[] | undefined)?.[0]?.data ?? root
  if (typeof src.content === 'string') d.content = src.content
  const e = (Array.isArray(src.embeds) ? src.embeds[0] : undefined) as Record<string, any> | undefined
  if (e) {
    if (e.title) d.title = e.title
    if (e.url) d.url = e.url
    if (e.description) d.description = e.description
    if (typeof e.color === 'number') d.color = e.color
    if (e.image?.url) d.image = e.image.url
    if (e.thumbnail?.url) d.thumbnail = e.thumbnail.url
    if (e.author?.name) d.author = { name: e.author.name, iconURL: e.author.icon_url, url: e.author.url }
    if (e.footer?.text) d.footer = { text: e.footer.text, iconURL: e.footer.icon_url }
    if (e.timestamp) d.timestamp = true
    if (Array.isArray(e.fields)) d.fields = e.fields.map((f: any) => ({ name: String(f.name), value: String(f.value), inline: Boolean(f.inline) }))
  }
  return true
}
