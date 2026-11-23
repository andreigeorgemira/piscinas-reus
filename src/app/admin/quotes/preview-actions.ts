'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { toQuotePreview, type QuotePreview } from '@/lib/quotes/preview'
import { getQuote } from '@/lib/quotes/queries'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * What the preview dialog on the quote list shows, read when it opens.
 *
 * A read through a Server Action rather than a page: the dialog lives on the
 * list and is opened by a click, and staff-only data must not travel without
 * the same check every admin screen makes. Not found and not visible are one
 * answer, as everywhere else.
 */
export async function loadQuotePreview(
  id: string,
): Promise<{ preview: QuotePreview } | { error: string }> {
  if (typeof id !== 'string' || !UUID.test(id)) return { error: 'El presupuesto no es válido.' }

  const supabase = await requireAdmin()
  try {
    const quote = await getQuote(supabase, id)
    if (!quote) return { error: 'Ese presupuesto ya no existe.' }
    return { preview: toQuotePreview(quote) }
  } catch (error) {
    console.error('quote preview failed', error)
    return { error: 'No se pudo abrir la vista previa. Inténtalo de nuevo.' }
  }
}
