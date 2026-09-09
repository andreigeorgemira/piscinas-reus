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
export async function listPriceBook(supabase: SupabaseClient): Promise<PriceBookGroup[]> {
  const [groupsResult, itemsResult] = await Promise.all([
    supabase
      .from('price_book_groups')
      .select('id, name, position')
      .order('position')
      .order('name'),
    supabase
      .from('price_book_items')
      .select('id, group_id, code, name, description, unit, unit_cost, unit_price, is_active')
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

  return result
}
