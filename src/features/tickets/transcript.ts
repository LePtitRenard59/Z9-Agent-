import { AttachmentBuilder, type Message, type TextChannel } from 'discord.js'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** Génère un transcript HTML stylé (façon Discord) des messages du salon. */
export async function generateTranscript(channel: TextChannel, ticketId: number): Promise<AttachmentBuilder> {
  const messages: Message[] = []
  let before: string | undefined
  for (let page = 0; page < 5; page++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) })
    if (batch.size === 0) break
    messages.push(...batch.values())
    before = batch.last()?.id
    if (batch.size < 100) break
  }
  messages.reverse()

  const rows = messages
    .map(m => {
      const time = new Date(m.createdTimestamp).toLocaleString('fr-FR')
      const body = esc(m.content || '')
      const attachments = [...m.attachments.values()].map(a => `<a href="${esc(a.url)}">${esc(a.name ?? 'fichier')}</a>`).join(' ')
      const embeds = m.embeds.length ? `<em class="embeds">[${m.embeds.length} embed(s)]</em>` : ''
      return `<div class="msg"><img class="av" src="${esc(m.author.displayAvatarURL({ extension: 'png' }))}" alt=""><div class="col"><div class="head"><span class="name">${esc(m.author.tag)}</span><span class="time">${time}</span></div><div class="body">${body}${attachments ? `<div class="att">${attachments}</div>` : ''}${embeds}</div></div></div>`
    })
    .join('\n')

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket #${ticketId} — ${esc(channel.name)}</title>
<style>
  body{background:#313338;color:#dbdee1;font-family:"gg sans",-apple-system,Segoe UI,sans-serif;margin:0;padding:24px;line-height:1.4}
  h1{color:#fff;font-size:20px;margin:0 0 4px}
  .meta{color:#949ba4;font-size:13px;margin-bottom:20px}
  .msg{display:flex;gap:14px;padding:10px 0;border-top:1px solid #3a3c41}
  .av{width:40px;height:40px;border-radius:50%;flex:0 0 auto}
  .head{margin-bottom:2px}
  .name{color:#f2f3f5;font-weight:600}
  .time{color:#949ba4;font-size:12px;margin-left:8px}
  .body{white-space:pre-wrap;word-break:break-word}
  .att a{color:#00a8fc;text-decoration:none}
  .embeds{color:#949ba4;font-size:12px}
</style></head><body>
<h1>🎫 Ticket #${ticketId}</h1>
<div class="meta">Salon : #${esc(channel.name)} · ${messages.length} message(s) · exporté le ${new Date().toLocaleString('fr-FR')}</div>
${rows || '<p class="meta">Aucun message.</p>'}
</body></html>`

  return new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `ticket-${ticketId}.html` })
}
