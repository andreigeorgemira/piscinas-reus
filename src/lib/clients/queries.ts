import type { SupabaseClient } from '@supabase/supabase-js'
import { escapeFilterTerm } from '@/lib/supabase/filters'

/** How many clients one screen holds. */
export const DEFAULT_PAGE_SIZE = 25

export type Client = {
  id: string
  fullName: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  notes: string | null
  /**
   * The portal account linked to this client, when there is one. Set by the
   * trigger in 0008_account_linking.sql, never by this application's forms.
   */
  userId: string | null
  createdAt: string
  /** How many quotes this client has, whatever their status. */
  quoteCount: number
}

export type ClientListing = {
  clients: Client[]
  shown: number
  total: number
  page: number
  pageSize: number
  pageCount: number
}

type ClientRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  notes: string | null
  user_id: string | null
  created_at: string
  quotes: { count: number }[]
}

const SELECT = 'id, full_name, email, phone, address, city, postal_code, notes, user_id, created_at, quotes(count)'

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    notes: row.notes,
    userId: row.user_id,
    createdAt: row.created_at,
    // An embedded aggregate arrives as a one-element array.
    quoteCount: row.quotes[0]?.count ?? 0,
  }
}

/**
 * One page of the client list, newest first.
 *
 * Newest first rather than alphabetical: the client somebody is looking for is
 * usually the one they just spoke to, and the search box is how a name from
 * three years ago is found.
 *
 * The search covers name, email, phone and city. Phone deliberately: staff
 * search by the number on a missed call, and a phone stored as '977 123 456'
 * is found by '123' because the match is a substring on both sides.
 *
 * RLS on `clients` is admin-only plus each client's own row
 * (0003_rls_policies.sql), so a caller who is neither sees an empty list
 * rather than an error.
 */
export async function listClients(
  supabase: SupabaseClient,
  filter: { search?: string | null; page?: number; pageSize?: number } = {},
): Promise<ClientListing> {
  const pageSize = Math.max(1, Math.trunc(filter.pageSize ?? DEFAULT_PAGE_SIZE))
  const page = Math.max(1, Math.trunc(filter.page ?? 1))
  const from = (page - 1) * pageSize

  let query = supabase.from('clients').select(SELECT, { count: 'exact' })

  const search = filter.search?.trim() ?? ''
  if (search !== '') {
    const term = escapeFilterTerm(search)
    query = query.or(
      `full_name.ilike."*${term}*",email.ilike."*${term}*",phone.ilike."*${term}*",city.ilike."*${term}*"`,
    )
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error

  const clients = (data as ClientRow[]).map(toClient)
  // A null count means the server sent none, not that the table is empty.
  const total = count ?? clients.length

  return {
    clients,
    shown: clients.length,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** One client by id, or null when it does not exist (or RLS hides it). */
export async function getClient(supabase: SupabaseClient, id: string): Promise<Client | null> {
  const { data, error } = await supabase.from('clients').select(SELECT).eq('id', id).maybeSingle()

  if (error) throw error
  if (!data) return null

  return toClient(data as ClientRow)
}

/** A client as the quote form's picker lists them. */
export type ClientOption = { id: string; fullName: string; email: string; city: string | null }

/**
 * Clients for the "who is this quote for" picker, alphabetical.
 *
 * Alphabetical here and newest-first in the list above, on purpose: this is a
 * list somebody reads to find a name they already know, and the other is a
 * screen somebody opens to see what happened lately.
 *
 * Capped rather than paged. A picker is not a screen to page through; past the
 * cap the answer is to type, which is what `search` is for.
 */
export async function listClientOptions(
  supabase: SupabaseClient,
  options: { search?: string | null; limit?: number } = {},
): Promise<ClientOption[]> {
  const limit = Math.max(1, Math.trunc(options.limit ?? 100))

  let query = supabase.from('clients').select('id, full_name, email, city')

  const search = options.search?.trim() ?? ''
  if (search !== '') {
    const term = escapeFilterTerm(search)
    query = query.or(`full_name.ilike."*${term}*",email.ilike."*${term}*",phone.ilike."*${term}*"`)
  }

  const { data, error } = await query.order('full_name').limit(limit)

  if (error) throw error

  return (data as { id: string; full_name: string; email: string; city: string | null }[]).map(
    (row) => ({ id: row.id, fullName: row.full_name, email: row.email, city: row.city }),
  )
}
