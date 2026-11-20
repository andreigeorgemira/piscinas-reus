import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuoteStatus } from '@/lib/quotes/status'

/**
 * What a signed-in client sees of their own paperwork.
 *
 * Read through the client views (0004_client_views.sql, restated in 0019),
 * never the tables: a client holds no policy on public.quotes that would let
 * them read a row, and the views name their columns, so cost, margin and
 * internal notes cannot leak through here whatever this code asks for.
 */

export type PortalQuote = {
  id: string
  reference: string
  title: string
  status: Exclude<QuoteStatus, 'draft'>
  sentAt: string | null
  validUntil: string | null
  accessToken: string
  /** What the client would pay: with VAT when the quote carries it. */
  total: number
  vatIncluded: boolean
}

export type PortalProject = {
  id: string
  reference: string
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  startDatePlanned: string | null
}

export const PROJECT_STATUS_LABELS: Record<PortalProject['status'], string> = {
  pending: 'Pendiente de empezar',
  in_progress: 'En obra',
  completed: 'Terminada',
  cancelled: 'Cancelada',
}

export const PORTAL_QUOTE_STATUS_LABELS: Record<PortalQuote['status'], string> = {
  sent: 'Pendiente de tu respuesta',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
}

type QuoteRow = {
  id: string
  reference: string
  title: string
  status: PortalQuote['status']
  sent_at: string | null
  valid_until: string | null
  access_token: string
}

type TotalsRow = {
  quote_id: string
  grand_total: number | string
  vat_rate: number | string | null
  total_with_vat: number | string
}

export async function listPortalQuotes(supabase: SupabaseClient): Promise<PortalQuote[]> {
  const [quotes, totals] = await Promise.all([
    supabase
      .from('client_quotes')
      .select('id, reference, title, status, sent_at, valid_until, access_token')
      .order('sent_at', { ascending: false, nullsFirst: false }),
    supabase.from('client_quote_totals').select('quote_id, grand_total, vat_rate, total_with_vat'),
  ])
  if (quotes.error) throw quotes.error
  if (totals.error) throw totals.error

  const byQuote = new Map((totals.data as TotalsRow[]).map((row) => [row.quote_id, row]))

  return (quotes.data as QuoteRow[]).map((row) => {
    const total = byQuote.get(row.id)
    const vatIncluded = total?.vat_rate !== null && total?.vat_rate !== undefined
    return {
      id: row.id,
      reference: row.reference,
      title: row.title,
      status: row.status,
      sentAt: row.sent_at,
      validUntil: row.valid_until,
      accessToken: row.access_token,
      total: Number(vatIncluded ? total!.total_with_vat : (total?.grand_total ?? 0)),
      vatIncluded,
    }
  })
}

export async function listPortalProjects(supabase: SupabaseClient): Promise<PortalProject[]> {
  const { data, error } = await supabase
    .from('client_projects')
    .select('id, reference, name, status, start_date_planned')
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data as { id: string; reference: string; name: string; status: PortalProject['status']; start_date_planned: string | null }[]).map(
    (row) => ({
      id: row.id,
      reference: row.reference,
      name: row.name,
      status: row.status,
      startDatePlanned: row.start_date_planned,
    }),
  )
}
