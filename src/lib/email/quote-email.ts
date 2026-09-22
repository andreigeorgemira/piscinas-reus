import { formatEuros } from '@/lib/price-book/decimal'
import { formatSpanishDate } from '@/lib/quotes/public'

/**
 * The email that carries a quote to a client.
 *
 * Pure on purpose: what it says is worth a test, and what sends it is worth
 * none. The HTML is written by hand and inline-styled because email clients
 * have no cascade worth relying on, and it is deliberately plain -- a quote
 * arriving as a designed newsletter reads as marketing, and this one is a
 * document somebody asked for.
 *
 * Every version has a text part. Some clients show it, some people prefer it,
 * and a link that only exists inside HTML is a link a spam filter is more
 * likely to eat.
 */
export type QuoteEmailInput = {
  reference: string
  title: string
  clientName: string
  total: number
  validUntil: string | null
  /** Where the client signs. Built by publicQuoteUrl. */
  url: string
  /** A line or two the office adds from the send dialog. */
  message?: string | null
}

export type QuoteEmail = { subject: string; html: string; text: string }

/** Escapes what goes into the HTML part. Names and messages are user input. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildQuoteEmail(input: QuoteEmailInput): QuoteEmail {
  const validity = input.validUntil
    ? `Es válido hasta el ${formatSpanishDate(input.validUntil)}.`
    : ''

  const greeting = `Hola ${input.clientName},`
  const opening = `aquí tienes el presupuesto ${input.reference} para ${input.title}.`
  const amount = `Total: ${formatEuros(input.total)} (IVA no incluido).`
  const invitation =
    'Desde el enlace puedes verlo con detalle, marcar los extras que te interesen y firmarlo si te parece bien.'
  const message = input.message?.trim() ? input.message.trim() : null

  const text = [
    greeting,
    '',
    opening,
    amount,
    validity,
    '',
    message,
    message ? '' : null,
    invitation,
    '',
    input.url,
    '',
    'Piscinas Reus · Reus, Tarragona',
  ]
    .filter((line) => line !== null && line !== '')
    .join('\n')

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#16181d;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e6ea;border-radius:12px;">
    <tr><td style="padding:24px 24px 8px;">
      <p style="margin:0;font-size:15px;font-weight:600;">Piscinas Reus</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Construcción y mantenimiento de piscinas</p>
    </td></tr>
    <tr><td style="padding:8px 24px 0;">
      <p style="margin:16px 0 0;font-size:14px;">${escapeHtml(greeting)}</p>
      <p style="margin:8px 0 0;font-size:14px;line-height:22px;">${escapeHtml(opening)}</p>
      ${message ? `<p style="margin:12px 0 0;font-size:14px;line-height:22px;white-space:pre-line;">${escapeHtml(message)}</p>` : ''}
      <p style="margin:16px 0 0;font-size:18px;font-weight:600;">${escapeHtml(formatEuros(input.total))}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">IVA no incluido. ${escapeHtml(validity)}</p>
      <p style="margin:16px 0 0;font-size:14px;line-height:22px;">${escapeHtml(invitation)}</p>
    </td></tr>
    <tr><td style="padding:20px 24px 24px;">
      <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#16181d;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">Ver y firmar el presupuesto</a>
      <p style="margin:12px 0 0;font-size:11px;color:#9aa1ab;word-break:break-all;">${escapeHtml(input.url)}</p>
    </td></tr>
  </table>
  <p style="max-width:520px;margin:12px auto 0;font-size:11px;color:#9aa1ab;text-align:center;">Piscinas Reus · Reus, Tarragona</p>
</body>
</html>`

  return {
    subject: `Presupuesto ${input.reference} · ${input.title}`,
    html,
    text,
  }
}
