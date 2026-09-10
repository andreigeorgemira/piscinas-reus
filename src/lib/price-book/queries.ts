import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnitType } from './schema'

/** The only Spanish string in this module: the label for items with no group. */
export const UNGROUPED_NAME = 'Sin grupo'

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
  items: PriceBookItem[]
}

/**
 * What listPriceBook found, together with how much of it the server was
 * willing to return.
 *
 * PostgREST caps every response at `max_rows` (1000 in
 * supabase/config.toml, and 1000 is the hosted default too). Neither query
 * in listPriceBook paginates, so a catalogue past that cap renders its
 * first 1000 items - ordered by code - and, without these counts, would say
 * nothing at all about the rest.
 *
 * Deliberately counts rather than pages: an invisible paging loop would
 * make this screen slower for every company that will never hit the cap,
 * and would hide the fact that a business with more than a thousand
 * concepts needs a screen designed for that. A truncation the staff can see
 * is honest, and is the thing that prompts the redesign.
 */
export type PriceBookListing = {
  groups: PriceBookGroup[]
  /** Items returned, and how many exist. Equal unless the cap bit. */
  itemsShown: number
  itemsTotal: number
  /** Groups returned, and how many exist. Equal unless the cap bit. */
  groupsShown: number
  groupsTotal: number
}

type GroupRow = {
  id: string
  name: string
  position: number
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
 * Reads the price book as the grouped catalogue the admin screen renders.
 *
 * Two queries, not one embedded PostgREST select: the nested form
 * (`price_book_groups.select('*, price_book_items(*)')`) drops a group that
 * currently has no items, and an empty group is exactly what a staff member
 * sees right after creating one. Fetching groups and items separately and
 * assembling them here in TypeScript keeps that group visible.
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
export async function listPriceBook(supabase: SupabaseClient): Promise<PriceBookListing> {
  // `count: 'exact'` is what makes the cap visible: PostgREST returns the
  // full matching count in Content-Range even when it only hands back
  // `max_rows` of them, so comparing the two is the only way this code can
  // tell a complete answer from a truncated one. See PriceBookListing.
  const [groupsResult, itemsResult] = await Promise.all([
    supabase
      .from('price_book_groups')
      .select('id, name, position', { count: 'exact' })
      .order('position')
      .order('name'),
    supabase
      .from('price_book_items')
      .select('id, group_id, code, name, description, unit, unit_cost, unit_price, is_active', {
        count: 'exact',
      })
      .order('code', { nullsFirst: false })
      .order('name'),
  ])

  if (groupsResult.error) throw groupsResult.error
  if (itemsResult.error) throw itemsResult.error

  const groups = new Map<string, PriceBookGroup>(
    (groupsResult.data as GroupRow[]).map((row) => [
      row.id,
      { id: row.id, name: row.name, position: row.position, items: [] },
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
  // here is a placeholder no caller reads (the group section UI in a later
  // task never offers a rename control for `id === null`).
  if (ungroupedItems.length > 0) {
    result.push({ id: null, name: UNGROUPED_NAME, position: 0, items: ungroupedItems })
  }

  const groupsShown = groupsResult.data.length
  const itemsShown = itemsResult.data.length

  return {
    groups: result,
    itemsShown,
    // A null count means the server did not send one at all, not that the
    // table is empty. Falling back to what did arrive keeps the caller from
    // reporting a nonsensical "1000 of 0" truncation.
    itemsTotal: itemsResult.count ?? itemsShown,
    groupsShown,
    groupsTotal: groupsResult.count ?? groupsShown,
  }
}
