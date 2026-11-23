'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { roundMoney } from '@/lib/money'
import type { ClientPreview } from '@/lib/clients/preview'
import { getClient } from '@/lib/clients/queries'
import { listQuotes } from '@/lib/quotes/queries'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** How many of a client's quotes the preview lists. */
const LISTED = 5

/** The client card's dialog: the contact details and the latest quotes. */
export async function loadClientPreview(
  id: string,
): Promise<{ preview: ClientPreview } | { error: string }> {
  if (typeof id !== 'string' || !UUID.test(id)) return { error: 'El cliente no es válido.' }

  const supabase = await requireAdmin()
  try {
    const [client, recent, accepted] = await Promise.all([
      getClient(supabase, id),
      listQuotes(supabase, { clientId: id, pageSize: LISTED }),
      listQuotes(supabase, { clientId: id, status: 'accepted', pageSize: 100 }),
    ])
    if (!client) return { error: 'Ese cliente ya no existe.' }

    return {
      preview: {
        client,
        quotes: recent.quotes.map((quote) => ({
          id: quote.id,
          reference: quote.reference,
          title: quote.title,
          status: quote.status,
          total: quote.totals.grandTotal,
          createdAt: quote.createdAt,
        })),
        quoteCount: recent.total,
        acceptedTotal: roundMoney(accepted.quotes.reduce((sum, quote) => sum + quote.totals.grandTotal, 0)),
      },
    }
  } catch (error) {
    console.error('client preview failed', error)
    return { error: 'No se pudo abrir la ficha. Inténtalo de nuevo.' }
  }
}
