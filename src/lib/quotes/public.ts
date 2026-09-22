import type { SupabaseClient } from '@supabase/supabase-js'
import { getSiteUrl } from '@/lib/env'
import type { UnitType } from '@/lib/price-book/schema'
import type { QuoteStatus } from './status'

/**
 * The quote as the person holding the link may see it.
 *
 * The shape is whatever public.quote_by_token returns (0015_public_quote_link.sql),
 * and the list of fields here is the same list the function builds: cost,
 * margin and internal notes are absent from both, and the absence is enforced
 * there, not here. This module only gives it a name in TypeScript.
 */
export type PublicQuoteItem = {
  id: string
  groupName: string | null
  name: string
  description: string | null
  unit: UnitType
  quantity: number
  unitPrice: number
  discountPct: number
  isRecommended: boolean
  clientSelected: boolean
  lineTotal: number
}

export type PublicQuote = {
  id: string
  reference: string
  title: string
  status: QuoteStatus
  startDatePlanned: string | null
  validUntil: string | null
  clientNotes: string | null
  sentAt: string | null
  respondedAt: string | null
  signedName: string | null
  signedAt: string | null
  rejectionReason: string | null
  client: {
    fullName: string
    email: string
    address: string | null
    city: string | null
    postalCode: string | null
  } | null
  /** Groups in the order the editor left them, each with its own subtotal. */
  groups: { name: string; items: PublicQuoteItem[]; subtotal: number }[]
  /** The optional extras, whatever group they were written in. */
  extras: PublicQuoteItem[]
  totals: {
    baseTotal: number
    recommendedTotal: number
    selectedExtrasTotal: number
    grandTotal: number
  }
}

/** The name a line with no group is printed under, here and in the PDF. */
export const UNGROUPED_SECTION = 'Otros trabajos'

type RawItem = {
  id: string
  group_name: string | null
  name: string
  description: string | null
  unit: UnitType
  quantity: string | number
  unit_price: string | number
  discount_pct: string | number
  is_recommended: boolean
  client_selected: boolean
  line_total: string | number
}

type RawQuote = {
  id: string
  reference: string
  title: string
  status: QuoteStatus
  start_date_planned: string | null
  valid_until: string | null
  client_notes: string | null
  sent_at: string | null
  responded_at: string | null
  signed_name: string | null
  signed_at: string | null
  rejection_reason: string | null
  client: {
    full_name: string
    email: string
    address: string | null
    city: string | null
    postal_code: string | null
  } | null
  items: RawItem[]
  totals: {
    base_total: string | number
    recommended_total: string | number
    selected_extras_total: string | number
    grand_total: string | number
  }
}

/**
 * numeric comes back as a string over PostgREST, which is right of it -- a
 * numeric can hold more than a double -- and useless here, where every figure
 * is euros or a measurement and JavaScript is doing the arithmetic anyway.
 */
function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value)
}

function toItem(raw: RawItem): PublicQuoteItem {
  return {
    id: raw.id,
    groupName: raw.group_name,
    name: raw.name,
    description: raw.description,
    unit: raw.unit,
    quantity: toNumber(raw.quantity),
    unitPrice: toNumber(raw.unit_price),
    discountPct: toNumber(raw.discount_pct),
    isRecommended: raw.is_recommended,
    clientSelected: raw.client_selected,
    lineTotal: toNumber(raw.line_total),
  }
}

/**
 * Reads the quote behind a token, or null when there is nothing to show.
 *
 * Null covers three cases the caller must not be able to tell apart: no such
 * token, a quote still in draft, and a token that was rotated when its quote was
 * reopened. The function in the database answers the same way for all three.
 *
 * The caller is anonymous. This goes through the ordinary Supabase client with
 * the publishable key -- the whole point of 0015 is that the token is the
 * credential, so nothing here needs the service role, and nothing here should
 * have it.
 */
export async function readPublicQuote(
  supabase: SupabaseClient,
  token: string,
): Promise<PublicQuote | null> {
  const { data, error } = await supabase.rpc('quote_by_token', { p_token: token })

  if (error) throw error
  if (!data) return null

  const raw = data as RawQuote
  const items = raw.items.map(toItem)

  // Grouped for the document, in the order the lines arrive (the function
  // orders by position, which the editor keeps as the catalogue's order).
  const groups: PublicQuote['groups'] = []
  for (const item of items) {
    if (item.isRecommended) continue
    const name = item.groupName ?? UNGROUPED_SECTION
    const last = groups.find((group) => group.name === name)
    if (last) {
      last.items.push(item)
      last.subtotal += item.lineTotal
      continue
    }
    groups.push({ name, items: [item], subtotal: item.lineTotal })
  }

  return {
    id: raw.id,
    reference: raw.reference,
    title: raw.title,
    status: raw.status,
    startDatePlanned: raw.start_date_planned,
    validUntil: raw.valid_until,
    clientNotes: raw.client_notes,
    sentAt: raw.sent_at,
    respondedAt: raw.responded_at,
    signedName: raw.signed_name,
    signedAt: raw.signed_at,
    rejectionReason: raw.rejection_reason,
    client: raw.client
      ? {
          fullName: raw.client.full_name,
          email: raw.client.email,
          address: raw.client.address,
          city: raw.client.city,
          postalCode: raw.client.postal_code,
        }
      : null,
    groups,
    extras: items.filter((item) => item.isRecommended),
    totals: {
      baseTotal: toNumber(raw.totals.base_total),
      recommendedTotal: toNumber(raw.totals.recommended_total),
      selectedExtrasTotal: toNumber(raw.totals.selected_extras_total),
      grandTotal: toNumber(raw.totals.grand_total),
    },
  }
}

/**
 * The address the client is sent.
 *
 * Short on purpose: it is pasted into an email, read aloud over the phone and
 * forwarded through WhatsApp, and every extra segment is another chance for a
 * line break to eat half of it. `/q/<token>` and nothing else.
 */
export function publicQuoteUrl(token: string): string {
  try {
    return `${getSiteUrl().replace(/\/$/, '')}/q/${token}`
  } catch {
    /*
     * A deployment with no SITE_URL still has to render the quote list: the
     * address is used there for a "copiar enlace" button, and a missing
     * variable must not take the screen down with it. The relative form works
     * in the browser that copies it; what it cannot do is travel in an email,
     * and sending reads SITE_URL through this same function, so that path fails
     * where it should -- at the send, with a message about configuration.
     */
    return `/q/${token}`
  }
}

/** A date as Spain writes it, from the ISO the database keeps. */
export function formatSpanishDate(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
