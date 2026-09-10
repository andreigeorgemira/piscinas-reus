import { itemInputToRow, type ItemInput } from '@/lib/price-book/schema'

/**
 * Builds the row commitImport upserts for a coded item.
 *
 * The coded-row write is an upsert, which replaces the whole row -- so it
 * must never carry a value the file cannot actually express, or a matched
 * row silently loses whatever that value was doing before the import.
 *
 * `is_active` is dropped entirely: the CSV column contract has no `activo`
 * column (see parseImport in src/lib/price-book/csv.ts), so a coded row's
 * `isActive` is always the placeholder `true` it was parsed with, never a
 * real answer. Omitting the key leaves a new row on the schema default (also
 * `true`) and leaves a matched row's own Retirar/Reactivar state alone -- a
 * retired item named in an import file stays retired.
 *
 * `description` is included only when the file's header actually had a
 * `descripcion` column (`hasDescriptionColumn`, from parseImport's
 * `columns.description`). A missing column and a blank cell mean different
 * things: the schema already collapses a blank cell to `null`, and if that
 * were always written, a file with no description column at all would clear
 * every matched item's description on every re-run. Column presence is
 * checked once per file (not per row) because every object in one upsert
 * array must carry the same keys -- PostgREST builds a single INSERT from
 * the array's shape.
 *
 * `itemInputToRow` itself is not touched: `createItem`/`updateItem` (in the
 * parent actions.ts) need the whole row, so this builds the coded payload by
 * omitting keys from what it returns instead.
 *
 * This lives in its own plain module, not inside actions.ts, purely so it
 * can be unit-tested directly: a 'use server' file may only export async
 * functions (see import-state.ts), and this is neither.
 */
export function codedItemPayload(
  input: ItemInput,
  hasDescriptionColumn: boolean,
): Record<string, unknown> {
  const row = itemInputToRow(input)
  const payload: Record<string, unknown> = {
    group_id: row.group_id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    unit_cost: row.unit_cost,
    unit_price: row.unit_price,
  }
  if (hasDescriptionColumn) {
    payload.description = row.description
  }
  return payload
}
