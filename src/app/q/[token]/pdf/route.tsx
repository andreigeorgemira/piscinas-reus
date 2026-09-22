import { renderToBuffer } from '@react-pdf/renderer'
import { fromPublicQuote, QuoteDocument } from '@/lib/quotes/pdf'
import { readPublicQuote } from '@/lib/quotes/public'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * The client's own PDF, behind the same token as the page.
 *
 * Generated on the way out rather than stored: a quote's figures change while
 * it is a draft and its extras change after it is sent, and a file written once
 * would start lying the moment either happened. Rendering costs a few hundred
 * milliseconds and is always the document the page is showing.
 *
 * Node runtime, stated rather than inherited: @react-pdf/renderer lays the page
 * out with Node APIs and will not run on the edge.
 */
export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: RouteContext<'/q/[token]/pdf'>) {
  const { token } = await params

  const supabase = await createServerSupabaseClient()
  const quote = await readPublicQuote(supabase, token)

  if (!quote) {
    // The same answer the page gives: a wrong token, a draft and a rotated
    // token are indistinguishable from out here.
    return new Response('No encontrado', { status: 404 })
  }

  const body = await renderToBuffer(<QuoteDocument quote={fromPublicQuote(quote)} />)

  return new Response(body as unknown as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      // inline: a phone opens it in the viewer, and the name is what it saves.
      'content-disposition': `inline; filename="${quote.reference}.pdf"`,
      // A signed quote is a different document from the same address, and an
      // unanswered one changes whenever an extra is ticked.
      'cache-control': 'no-store',
    },
  })
}
