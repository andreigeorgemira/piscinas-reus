import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnitType } from '@/lib/price-book/schema'
import { escapeFilterTerm } from '@/lib/supabase/filters'
import type { QuoteStatus } from './status'

/** How many quotes one screen holds. */
export const DEFAULT_PAGE_SIZE = 25

/**
 * How many clients a search resolves before it gives up widening.
 *
 * Searching quotes by a client's surname is done by resolving the name to ids
 * and adding them to the filter (see listQuotes), and those ids travel in the
 * query string. A surname shared by three hundred clients would build a URL
 * long enough for PostgREST to refuse with a 414 -- the same wall the price
 * book's code lookup hit. Past the cap the answer is a narrower search, which
 * is what the client screen is for.
 */
const CLIENT_MATCH_LIMIT = 50

/** Every total the admin screens show. Cost and margin are admin-only. */
export type QuoteTotals = {
  baseTotal: number
  recommendedTotal: number
  selectedExtrasTotal: number
  grandTotal: number
  costTotal: number
  margin: number
}

/** A quote as a list row shows it. */
export type QuoteListRow = {
  id: string
  reference: string
  title: string
  status: QuoteStatus
  clientId: string | null
  clientName: string | null
  createdAt: string
  sentAt: string | null
  validUntil: string | null
  projectReference: string | null
  /** How many lines the quote holds. A quote with none is a quote nobody wrote. */
  lineCount: number
  totals: QuoteTotals
}

export type QuoteListing = {
  quotes: QuoteListRow[]
  shown: number
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type QuoteFilter = {
  /** Free text matched against the reference, the title and the client's name. */
  search?: string | null
  /** One status, or null for every one of them. */
  status?: QuoteStatus | null
  /** Only this client's quotes. What the client's own page shows. */
  clientId?: string | null
  page?: number
  pageSize?: number
}

/** A line of a quote. Every field is the snapshot the line was written with. */
export type QuoteItem = {
  id: string
  /** Where the line came from, when it came from the catalogue. Provenance only. */
  priceBookItemId: string | null
  groupName: string | null
  name: string
  description: string | null
  unit: UnitType
  quantity: number
  unitCost: number
  unitPrice: number
  discountPct: number
  isRecommended: boolean
  clientSelected: boolean
  position: number
  /** When the line was written. The board orders copies and free lines by it. */
  createdAt: string
}

/** A quote, everything on its screen, in one object. */
export type QuoteDetail = {
  id: string
  reference: string
  title: string
  status: QuoteStatus
  startDatePlanned: string | null
  validUntil: string | null
  clientNotes: string | null
  internalNotes: string | null
  accessToken: string
  sentAt: string | null
  respondedAt: string | null
  createdAt: string
  /**
   * Null until somebody puts a name on the quote: a price is often quoted
   * before the client exists as a record (0014_quote_without_client.sql).
   */
  client: {
    id: string
    fullName: string
    email: string
    phone: string | null
    address: string | null
    city: string | null
    postalCode: string | null
  } | null
  project: { id: string; reference: string } | null
  items: QuoteItem[]
  totals: QuoteTotals
}

const ZERO_TOTALS: QuoteTotals = {
  baseTotal: 0,
  recommendedTotal: 0,
  selectedExtrasTotal: 0,
  grandTotal: 0,
  costTotal: 0,
  margin: 0,
}

type TotalsRow = {
  quote_id: string
  base_total: number
  recommended_total: number
  selected_extras_total: number
  grand_total: number
  cost_total: number
  margin: number
}

function toTotals(row: TotalsRow | undefined): QuoteTotals {
  if (!row) return ZERO_TOTALS
  return {
    baseTotal: row.base_total,
    recommendedTotal: row.recommended_total,
    selectedExtrasTotal: row.selected_extras_total,
    grandTotal: row.grand_total,
    costTotal: row.cost_total,
    margin: row.margin,
  }
}

type ItemRow = {
  id: string
  price_book_item_id: string | null
  group_name: string | null
  name: string
  description: string | null
  unit: UnitType
  quantity: number
  unit_cost: number
  unit_price: number
  discount_pct: number
  is_recommended: boolean
  client_selected: boolean
  position: number
  created_at: string
}

function toItem(row: ItemRow): QuoteItem {
  return {
    id: row.id,
    priceBookItemId: row.price_book_item_id,
    groupName: row.group_name,
    name: row.name,
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    unitCost: row.unit_cost,
    unitPrice: row.unit_price,
    discountPct: row.discount_pct,
    isRecommended: row.is_recommended,
    clientSelected: row.client_selected,
    position: row.position,
    createdAt: row.created_at,
  }
}

const ITEM_SELECT =
  'id, price_book_item_id, group_name, name, description, unit, quantity, unit_cost, unit_price, discount_pct, is_recommended, client_selected, position, created_at'

/**
 * Reads the totals of a set of quotes.
 *
 * Its own query rather than an embedded select: `quote_totals` is a view, and
 * PostgREST can only embed what it can see a foreign key for. The view
 * exposes quote_id and nothing declares it a reference to quotes.id, so the
 * rows are fetched by id and joined here.
 *
 * A quote with no lines has no row in the view at all (the view groups over a
 * left join, so it does have one -- with zeros), but a quote the caller cannot
 * read has none either, which is why a missing row reads as zeros rather than
 * as an error: an admin always gets the row, and nobody else gets the quote.
 */
async function readTotals(
  supabase: SupabaseClient,
  quoteIds: string[],
): Promise<Map<string, QuoteTotals>> {
  if (quoteIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('quote_totals')
    .select('quote_id, base_total, recommended_total, selected_extras_total, grand_total, cost_total, margin')
    .in('quote_id', quoteIds)

  if (error) throw error

  return new Map((data as TotalsRow[]).map((row) => [row.quote_id, toTotals(row)]))
}

type QuoteListRowResponse = {
  id: string
  reference: string
  title: string
  status: QuoteStatus
  client_id: string | null
  created_at: string
  sent_at: string | null
  valid_until: string | null
  clients: { full_name: string } | null
  projects: { reference: string } | null
  /** An embedded aggregate, which PostgREST answers as a one-element array. */
  quote_items: { count: number }[]
}

/**
 * One page of the quote list, newest first.
 *
 * The client's name and the project's reference come along as embedded
 * selects, because a list of quotes that says only 'Q-2026-0004' is a list of
 * filing codes: the first thing anyone asks of a quote is whose it is.
 *
 * `clients` is embedded as a nullable object although `quotes.client_id` is
 * `not null`: the row is only absent when RLS hides the client from the
 * caller, which for an admin never happens. Reading it as nullable costs one
 * fallback and turns a would-be crash into a row that renders.
 */
export async function listQuotes(
  supabase: SupabaseClient,
  filter: QuoteFilter = {},
): Promise<QuoteListing> {
  const pageSize = Math.max(1, Math.trunc(filter.pageSize ?? DEFAULT_PAGE_SIZE))
  const page = Math.max(1, Math.trunc(filter.page ?? 1))
  const from = (page - 1) * pageSize

  let query = supabase
    .from('quotes')
    .select(
      'id, reference, title, status, client_id, created_at, sent_at, valid_until, clients(full_name), projects(reference), quote_items(count)',
      { count: 'exact' },
    )

  if (filter.status) {
    query = query.eq('status', filter.status)
  }

  if (filter.clientId) {
    query = query.eq('client_id', filter.clientId)
  }

  const search = filter.search?.trim() ?? ''
  if (search !== '') {
    const term = escapeFilterTerm(search)
    const conditions = [`reference.ilike."*${term}*"`, `title.ilike."*${term}*"`]

    // Staff type a surname into this box, not a reference. A filter on an
    // embedded resource would only trim the embedded rows, not the quotes, so
    // the name is resolved to client ids first and those join the same `or`.
    // One extra round trip, and only while searching.
    const { data: matches, error } = await supabase
      .from('clients')
      .select('id')
      .or(`full_name.ilike."*${term}*",email.ilike."*${term}*"`)
      .limit(CLIENT_MATCH_LIMIT)

    if (error) throw error

    const ids = (matches as { id: string }[]).map((row) => row.id)
    if (ids.length > 0) {
      conditions.push(`client_id.in.(${ids.join(',')})`)
    }

    query = query.or(conditions.join(','))
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error

  /*
   * The cast goes through `unknown` because this project has no generated
   * database types: supabase-js cannot know the cardinality of an embedded
   * resource, so it infers an array, while PostgREST answers a to-one embed
   * (a quote's client, a concept's group) with an object -- which is what the
   * integration suite observes, e.g. the `projects` assertion in
   * tests/integration/quote-lifecycle.test.ts. An aggregate embed like
   * `price_book_items(count)` really is a one-element array, and those stay
   * typed as one above.
   */
  const rows = data as unknown as QuoteListRowResponse[]
  const totals = await readTotals(
    supabase,
    rows.map((row) => row.id),
  )

  const quotes: QuoteListRow[] = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    clientId: row.client_id,
    clientName: row.clients?.full_name ?? null,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    validUntil: row.valid_until,
    projectReference: row.projects?.reference ?? null,
    lineCount: row.quote_items[0]?.count ?? 0,
    totals: totals.get(row.id) ?? ZERO_TOTALS,
  }))

  const total = count ?? quotes.length

  return {
    quotes,
    shown: quotes.length,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/**
 * Every line of one quote, in no particular order.
 *
 * The board decides the order (src/lib/quotes/board.ts), so this deliberately
 * does not: a read that imposed `position` would make the next position depend
 * on the last one.
 */
export async function listQuoteItems(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<QuoteItem[]> {
  const { data, error } = await supabase
    .from('quote_items')
    .select(ITEM_SELECT)
    .eq('quote_id', quoteId)

  if (error) throw error

  return (data as ItemRow[]).map(toItem)
}

type QuoteDetailResponse = {
  id: string
  reference: string
  title: string
  status: QuoteStatus
  start_date_planned: string | null
  valid_until: string | null
  client_notes: string | null
  internal_notes: string | null
  access_token: string
  sent_at: string | null
  responded_at: string | null
  created_at: string
  clients: {
    id: string
    full_name: string
    email: string
    phone: string | null
    address: string | null
    city: string | null
    postal_code: string | null
  } | null
  projects: { id: string; reference: string } | null
  quote_items: ItemRow[]
}

/**
 * One quote with everything its editor renders, or null when it does not exist
 * (or RLS hides it).
 *
 * Lines are ordered by `position`, then by creation: position is what dragging
 * a row writes, and two lines added in the same second before anything was
 * dragged would otherwise swap places between renders.
 */
export async function getQuote(
  supabase: SupabaseClient,
  id: string,
): Promise<QuoteDetail | null> {
  const [quoteResult, totals] = await Promise.all([
    supabase
      .from('quotes')
      .select(
        `id, reference, title, status, start_date_planned, valid_until, client_notes, internal_notes,
         access_token, sent_at, responded_at, created_at,
         clients(id, full_name, email, phone, address, city, postal_code),
         projects(id, reference),
         quote_items(${ITEM_SELECT})`,
      )
      .eq('id', id)
      .order('position', { referencedTable: 'quote_items' })
      .order('created_at', { referencedTable: 'quote_items' })
      .maybeSingle(),
    readTotals(supabase, [id]),
  ])

  if (quoteResult.error) throw quoteResult.error
  if (!quoteResult.data) return null

  // An embedded to-one resource, typed as explained in listQuotes above.
  const row = quoteResult.data as unknown as QuoteDetailResponse

  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    startDatePlanned: row.start_date_planned,
    validUntil: row.valid_until,
    clientNotes: row.client_notes,
    internalNotes: row.internal_notes,
    accessToken: row.access_token,
    sentAt: row.sent_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    client: row.clients
      ? {
          id: row.clients.id,
          fullName: row.clients.full_name,
          email: row.clients.email,
          phone: row.clients.phone,
          address: row.clients.address,
          city: row.clients.city,
          postalCode: row.clients.postal_code,
        }
      : null,
    project: row.projects ? { id: row.projects.id, reference: row.projects.reference } : null,
    items: row.quote_items.map(toItem),
    totals: totals.get(id) ?? ZERO_TOTALS,
  }
}
