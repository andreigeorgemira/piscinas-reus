import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnitType } from './schema'

/** The only Spanish string in this module: the label for items with no group. */
export const UNGROUPED_NAME = 'Sin grupo'

/** How many concepts one screen of the price book holds. */
export const DEFAULT_PAGE_SIZE = 25

/** The value the group filter uses for "items filed under no group at all". */
export const UNGROUPED_FILTER = 'ungrouped'

export type PriceBookItem = {
  id: string
  groupId: string | null
  code: string | null
  name: string
  description: string | null
  unit: UnitType
  unitCost: number
  unitPrice: number
  isActive: boolean
}

export type PriceBookGroup = {
  id: string | null
  name: string
  position: number
  /** The items on THIS page. */
  items: PriceBookItem[]
  /**
   * How many concepts the group holds in total, whatever this page shows.
   * A folded group is a one-line summary of itself, and "3" when the group
   * has ten and seven are on page two is not a summary, it is a wrong
   * number.
   */
  itemCount: number
}

/** A group as the filter chips and the row selects need it. */
export type PriceBookGroupRef = { id: string; name: string; itemCount: number }

/** Which side of `is_active` a listing wants. */
export type ActiveFilter = 'all' | 'active' | 'retired'

/** A price book, as the list screen shows it. */
export type PriceBook = {
  id: string
  name: string
  description: string | null
  position: number
  createdAt: string
  groupCount: number
  itemCount: number
}

export type PriceBookFilter = {
  /** Which book to read. Required: every screen is a view of one book. */
  priceBookId: string
  /** Free text matched against code, name and description. */
  search?: string | null
  /** A group id, `UNGROUPED_FILTER`, or null for every group. */
  groupId?: string | null
  /** One unit of measure, or null for all of them. */
  unit?: UnitType | null
  /** Inclusive bounds on unit_cost, in euros. Either may stand alone. */
  costMin?: number | null
  costMax?: number | null
  /** Defaults to 'all': this is the screen that brings a retired item back. */
  active?: ActiveFilter
  /** 1-based. Out-of-range pages return no items rather than erroring. */
  page?: number
  /**
   * null asks for the whole catalogue on one screen, which is what the
   * grouped view wants: a group split across two pages is a group whose
   * concepts you cannot see together, and that was the single most
   * confusing thing about this screen. Searching still pages, because a
   * result set has no groups to keep whole.
   */
  pageSize?: number | null
}

/**
 * One page of the price book, and enough about the rest of it to page
 * through.
 *
 * PostgREST caps every response at `max_rows` (1000 in supabase/config.toml,
 * and 1000 is the hosted default too). This used to be handled by fetching
 * everything and telling staff when the cap bit, which is honest but leaves a
 * catalogue past a thousand concepts unreachable. It now asks for one page at
 * a time, so the cap is no longer reachable and `itemsTotal` is what drives
 * the pager rather than a warning.
 */
export type PriceBookListing = {
  /** Real groups in position order, each carrying this page's items, with
   *  the synthetic ungrouped bucket last when it has any. */
  groups: PriceBookGroup[]
  /** Every group that exists, whatever this page shows. */
  allGroups: PriceBookGroupRef[]
  /** Items on this page, and how many the filter matches in total. */
  itemsShown: number
  itemsTotal: number
  page: number
  pageSize: number
  pageCount: number
  /**
   * True when the server returned fewer items than exist. PostgREST caps
   * every response at max_rows (1000), so an unpaged read of a very large
   * book is a slice -- and a slice that says nothing is the bug this flag
   * exists to prevent.
   */
  capped: boolean
}

type GroupRow = {
  id: string
  name: string
  position: number
  /**
   * PostgREST returns an embedded aggregate as a one-element array. An empty
   * group still comes back, with `[{ count: 0 }]` -- unlike embedding the
   * rows themselves, which drops it (see listPriceBook).
   */
  price_book_items: { count: number }[]
}

type ItemRow = {
  id: string
  group_id: string | null
  code: string | null
  name: string
  description: string | null
  unit: UnitType
  unit_cost: number
  unit_price: number
  is_active: boolean
}

function toItem(row: ItemRow): PriceBookItem {
  return {
    id: row.id,
    groupId: row.group_id,
    code: row.code,
    name: row.name,
    description: row.description,
    unit: row.unit,
    unitCost: row.unit_cost,
    unitPrice: row.unit_price,
    isActive: row.is_active,
  }
}

/**
 * Wraps a search term for use inside a PostgREST `or` filter.
 *
 * That filter is a comma-separated string, so a search for "gresite, borada"
 * would otherwise be parsed as two conditions and the second one - `borada`,
 * with no column or operator - makes the whole request a 400. Parentheses
 * group conditions and would do the same. PostgREST's own answer is to
 * double-quote the value, which makes every reserved character literal; only
 * the backslash and the quote itself then need escaping.
 *
 * `*` is left alone deliberately: it is the ilike wildcard, and a staff
 * member typing `REV-*` meaning "everything in revestimiento" gets what they
 * asked for.
 */
function quoteFilterValue(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Reads one page of the price book as the grouped catalogue the admin screen
 * renders.
 *
 * Two queries, not one embedded PostgREST select: the nested form
 * (`price_book_groups.select('*, price_book_items(*)')`) drops a group that
 * currently has no items, and an empty group is exactly what a staff member
 * sees right after creating one. Fetching groups and items separately and
 * assembling them here in TypeScript keeps that group visible.
 *
 * Items are ordered by code, so a page break falls between two codes rather
 * than inside a group: with codes prefixed by group, as every catalogue this
 * app has seen writes them, groups stay contiguous. A group whose items
 * straddle a page break renders its header on both pages, which is what a
 * paper catalogue does too.
 *
 * Retired items (is_active = false) are returned too - hiding them is the
 * quote editor's job in a later phase, and this is the screen that brings
 * them back.
 *
 * RLS on both tables is admin-only (supabase/migrations/0003_rls_policies.sql),
 * so a caller who isn't staff simply matches no rows on either query. That is
 * the desired behaviour: a caller that forgot to gate with requireAdmin
 * renders an empty page rather than an error that leaks the catalogue's shape.
 */
export async function listPriceBook(
  supabase: SupabaseClient,
  filter: PriceBookFilter,
): Promise<PriceBookListing> {
  const paging = filter.pageSize !== null
  const pageSize = Math.max(1, filter.pageSize ?? DEFAULT_PAGE_SIZE)
  const page = paging ? Math.max(1, Math.trunc(filter.page ?? 1)) : 1
  const from = (page - 1) * pageSize

  const search = filter.search?.trim() ?? ''

  let itemsQuery = supabase
    .from('price_book_items')
    .select('id, group_id, code, name, description, unit, unit_cost, unit_price, is_active', {
      count: 'exact',
    })
    .eq('price_book_id', filter.priceBookId)

  if (search !== '') {
    const term = quoteFilterValue(search)
    itemsQuery = itemsQuery.or(
      `code.ilike."*${term}*",name.ilike."*${term}*",description.ilike."*${term}*"`,
    )
  }

  if (filter.groupId === UNGROUPED_FILTER) {
    itemsQuery = itemsQuery.is('group_id', null)
  } else if (filter.groupId) {
    itemsQuery = itemsQuery.eq('group_id', filter.groupId)
  }

  if (filter.unit) {
    itemsQuery = itemsQuery.eq('unit', filter.unit)
  }

  // Bounds are applied independently: "everything over 100 euros" is as
  // useful a question as "between 20 and 50", and needs no upper bound.
  if (typeof filter.costMin === 'number' && Number.isFinite(filter.costMin)) {
    itemsQuery = itemsQuery.gte('unit_cost', filter.costMin)
  }
  if (typeof filter.costMax === 'number' && Number.isFinite(filter.costMax)) {
    itemsQuery = itemsQuery.lte('unit_cost', filter.costMax)
  }

  if (filter.active === 'active') {
    itemsQuery = itemsQuery.eq('is_active', true)
  } else if (filter.active === 'retired') {
    itemsQuery = itemsQuery.eq('is_active', false)
  }

  const [groupsResult, itemsResult] = await Promise.all([
    supabase
      .from('price_book_groups')
      .select('id, name, position, price_book_items(count)')
      .eq('price_book_id', filter.priceBookId)
      .order('position')
      .order('name'),
    paging
      ? itemsQuery.order('code', { nullsFirst: false }).order('name').range(from, from + pageSize - 1)
      : itemsQuery.order('code', { nullsFirst: false }).order('name'),
  ])

  if (groupsResult.error) throw groupsResult.error
  if (itemsResult.error) throw itemsResult.error

  const groupRows = groupsResult.data as GroupRow[]

  const groups = new Map<string, PriceBookGroup>(
    groupRows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        position: row.position,
        items: [],
        itemCount: row.price_book_items[0]?.count ?? 0,
      },
    ]),
  )

  const ungroupedItems: PriceBookItem[] = []

  for (const row of itemsResult.data as ItemRow[]) {
    const item = toItem(row)
    if (item.groupId === null) {
      ungroupedItems.push(item)
      continue
    }
    // `?.` drops the item when its group is not in the map. That is not
    // merely defensive: the two queries above run under Promise.all, so a
    // group deleted between them is absent from `groups` while its items
    // (already reassigned to group_id null by `on delete set null`, or read
    // a moment earlier) can still name it. Dropping one row from a screen
    // the next refresh renders correctly beats throwing on the whole page.
    groups.get(item.groupId)?.items.push(item)
  }

  const result = Array.from(groups.values())

  // Appended last, and only when non-empty: an admin with a fully-grouped
  // catalogue should never see an empty "Sin grupo" section. Never sorted
  // into position order - it is not a group anyone chose, so `position`
  // here is a placeholder no caller reads (the group section UI never offers
  // a rename control for `id === null`).
  if (ungroupedItems.length > 0) {
    result.push({
      id: null,
      name: UNGROUPED_NAME,
      position: 0,
      items: ungroupedItems,
      // The bucket has no row to count from, and counting it would cost a
      // query to tell staff something the page already shows. Callers that
      // need a total treat 0 as "not known" for the ungrouped bucket.
      itemCount: ungroupedItems.length,
    })
  }

  const itemsShown = itemsResult.data.length
  // A null count means the server did not send one at all, not that the table
  // is empty. Falling back to what did arrive keeps the pager from claiming a
  // page that does not exist.
  const itemsTotal = itemsResult.count ?? itemsShown

  return {
    groups: result,
    allGroups: groupRows.map((row) => ({
      id: row.id,
      name: row.name,
      itemCount: row.price_book_items[0]?.count ?? 0,
    })),
    itemsShown,
    itemsTotal,
    page,
    pageSize,
    pageCount: paging ? Math.max(1, Math.ceil(itemsTotal / pageSize)) : 1,
    capped: itemsShown < itemsTotal && !paging,
  }
}

type PriceBookRow = {
  id: string
  name: string
  description: string | null
  position: number
  created_at: string
  price_book_groups: { count: number }[]
  price_book_items: { count: number }[]
}

/**
 * Every price book, with how much each one holds.
 *
 * The two counts ride along as embedded aggregates in the same request: a
 * list of books whose rows say nothing about their size is a list of names,
 * and the first thing anyone wants to know about a catalogue is how big it
 * is.
 */
export async function listPriceBooks(supabase: SupabaseClient): Promise<PriceBook[]> {
  const { data, error } = await supabase
    .from('price_books')
    .select('id, name, description, position, created_at, price_book_groups(count), price_book_items(count)')
    .order('position')
    .order('name')

  if (error) throw error

  return (data as PriceBookRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    position: row.position,
    createdAt: row.created_at,
    groupCount: row.price_book_groups[0]?.count ?? 0,
    itemCount: row.price_book_items[0]?.count ?? 0,
  }))
}

/** One price book by id, or null when it does not exist (or RLS hides it). */
export async function getPriceBook(
  supabase: SupabaseClient,
  id: string,
): Promise<PriceBook | null> {
  const { data, error } = await supabase
    .from('price_books')
    .select('id, name, description, position, created_at, price_book_groups(count), price_book_items(count)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as PriceBookRow
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    position: row.position,
    createdAt: row.created_at,
    groupCount: row.price_book_groups[0]?.count ?? 0,
    itemCount: row.price_book_items[0]?.count ?? 0,
  }
}
