import { renderToBuffer } from '@react-pdf/renderer'
import { requireAdmin } from '@/lib/auth/require-admin'
import { fromQuoteDetail, QuoteDocument } from '@/lib/quotes/pdf'
import { getQuote } from '@/lib/quotes/queries'
import { getCompanySettings } from '@/lib/settings/queries'

/**
 * The office's PDF of any quote, draft included.
 *
 * The same document the client gets, with two differences that only exist
 * because this one is printed before anybody has answered: a draft carries a
 * band saying so across the top, and the signature block appears once there is
 * a signature to show.
 *
 * requireAdmin, then RLS: the read goes through the caller's own session, so a
 * non-admin gets nothing to render even if they reach this address.
 */
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: RouteContext<'/admin/quotes/[id]/pdf'>,
) {
  const { id } = await params

  const supabase = await requireAdmin()
  const quote = await getQuote(supabase, id)

  if (!quote) {
    return new Response('No encontrado', { status: 404 })
  }

  // The drawing is read on its own: it can weigh 300 kB, and nothing else on
  // the editor needs it. The document decides whether to print it (accepted
  // quotes only).
  const [{ data: signature, error: signatureError }, company] = await Promise.all([
    supabase.from('quotes').select('signature_image').eq('id', id).maybeSingle(),
    getCompanySettings(supabase),
  ])
  if (signatureError) throw signatureError

  const body = await renderToBuffer(
    <QuoteDocument
      quote={fromQuoteDetail(quote, company, signature?.signature_image ?? null)}
    />,
  )

  return new Response(body as unknown as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${quote.reference}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
