'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { parseImport, type ImportRow } from '@/lib/price-book/csv'
import { itemInputToRow, type ItemInput } from '@/lib/price-book/schema'
import { codedItemPayload } from './coded-item-payload'
import { idleImportState, type ImportState, type PreviewRow } from './import-state'

// Re-exported so callers still read the contract off this module. Only the
// types: a value re-export would be a runtime export of a 'use server' file,
// which is exactly what ./import-state exists to avoid.
export type { ImportState, PreviewRow }

// About 4000 rows at a realistic per-row size -- far past any real
// catalogue, but small enough that parsing it inside one request is not a
// denial-of-service vector.
const MAX_IMPORT_BYTES = 200 * 1024

// PostgREST puts an `.in()` filter in the URL query string -- one
// `code=in.(...)` parameter carrying every value -- so what these two
// constants have to respect is a number of characters in a URL, not a
// number of codes or names. Measured against this project's own local
// gateway: it answers 200 up to about 7.2 KB of URL and 414 from about
// 8.4 KB, and a 414 is a dead end here, since the only thing the screen can
// then say is "no se pudo comprobar el tarifario".
//
//   100 codes x 40 chars (schema.ts's cap) -> 4371 chars, 200
//   150 codes x 40 chars                   -> 6521 chars, 200
//   200 codes x 40 chars                   -> 8671 chars, 414
//    50 names x 80 chars (schema.ts's cap) -> 4227 chars, 200
//    75 names x 80 chars                   -> 6302 chars, 200
//   100 names x 80 chars                   -> 8377 chars, 414
//
// Both sizes are therefore set for the longest value the schema allows, not
// for the short codes this company happens to use today -- supabase/seed.sql
// writes seven-character ones, which is why no test caught the unchunked
// version. They land near 4.3 KB, about half the ceiling. Forty serial
// requests at the 200 KB paste cap above is a fine price for something that
// only runs when staff paste a file.
//
// Still able to overflow: a value made entirely of multi-byte characters.
// An 80-character name of accented letters percent-encodes to 480 URL
// characters, and no fixed count survives that. A realistic Spanish name at
// the cap (about ten accents in eighty characters) measures 4727 chars for
// fifty of them, so it is a pathological input rather than a reachable one,
// and it surfaces as the logged failure below rather than a wrong answer.
//
// 100 and 50 also keep each response inside PostgREST's own row cap
// (max_rows = 1000, supabase/config.toml): `code` and `name` are both
// unique, so a chunk matches at most as many rows as it carries values. No
// chunk can come back silently truncated, which is why these lookups need
// none of the count check listPriceBook does (src/lib/price-book/queries.ts).
const CODE_LOOKUP_CHUNK = 100
const GROUP_LOOKUP_CHUNK = 50

/** Splits values into fixed-size chunks, in order. */
function chunked<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size))
  }
  return chunks
}

/**
 * Reads the pasted text off the form and says whether it is over the size
 * cap. The text is returned either way (even when too large) so the caller
 * can hand it back to the screen instead of losing what was pasted.
 */
function readImportText(formData: FormData): { text: string; tooLarge: boolean } {
  const raw = formData.get('text')
  const text = typeof raw === 'string' ? raw : ''
  const tooLarge = new TextEncoder().encode(text).length > MAX_IMPORT_BYTES
  return { text, tooLarge }
}

const TOO_LARGE_MESSAGE = 'El archivo es demasiado grande. El máximo son 200 KB.'

/**
 * Maps a write's Postgres error to Spanish prose fit for a staff member's
 * screen. See actions.ts (one level up) for why only these two codes are
 * named: `23505` is a unique violation -- reachable here only if two imports
 * race to create the same new group -- and `42501` is an RLS refusal,
 * reachable only if a non-admin bypasses the UI and posts to this action
 * directly, since requireAdmin already turned away everyone else.
 */
function describeWriteError(error: PostgrestError): string {
  switch (error.code) {
    case '23505':
      return 'Otra importación ha creado ese grupo o código a la vez. Vuelve a comprobar el archivo.'
    case '42501':
      return 'No tienes permiso para hacer esto.'
    default:
      console.error('price-book import failed', error)
      return 'No se pudo importar el archivo. Inténtalo de nuevo.'
  }
}

/**
 * Parses the pasted text and marks each row `create` or `update` against
 * what is already in the database, for the preview table. This is a read
 * only step -- nothing is written here, and nothing here is trusted by
 * commitImport below.
 */
export async function previewImport(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const supabase = await requireAdmin()

  const { text, tooLarge } = readImportText(formData)
  if (tooLarge) {
    return { ...idleImportState, text, error: TOO_LARGE_MESSAGE }
  }

  const { rows, issues } = parseImport(text)

  const codes = rows.flatMap((row) => (row.input.code === null ? [] : [row.input.code]))

  const existingCodes = new Set<string>()
  for (const chunk of chunked(codes, CODE_LOOKUP_CHUNK)) {
    const { data, error } = await supabase.from('price_book_items').select('code').in('code', chunk)
    if (error) {
      // The screen is only told the check failed, never why, and a chunked
      // lookup has more ways to fail than a single one -- this log is the
      // only diagnostic anyone will ever get for it.
      console.error('price-book import preview lookup failed', error)
      return {
        ...idleImportState,
        text,
        error: 'No se pudo comprobar el tarifario. Inténtalo de nuevo.',
      }
    }
    for (const row of (data ?? []) as { code: string | null }[]) {
      if (row.code !== null) {
        existingCodes.add(row.code)
      }
    }
  }

  const previewRows: PreviewRow[] = rows.map((row) => ({
    line: row.line,
    groupName: row.groupName,
    code: row.input.code,
    name: row.input.name,
    unit: row.input.unit,
    unitCost: row.input.unitCost,
    unitPrice: row.input.unitPrice,
    action: row.input.code !== null && existingCodes.has(row.input.code) ? 'update' : 'create',
  }))

  return {
    stage: 'preview',
    text,
    rows: previewRows,
    issues,
    created: 0,
    updated: 0,
    groupsCreated: 0,
    error: null,
  }
}

/**
 * Resolves every group name the rows mention to an id, creating any group
 * that does not already exist. Names are unique, so a second run of the same
 * file reuses the group it made the first time instead of making a
 * near-duplicate.
 */
async function resolveGroupIds(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  rows: ImportRow[],
): Promise<{ groupIdByName: Map<string, string>; groupsCreated: number } | { error: string }> {
  const groupNames = [...new Set(rows.flatMap((row) => (row.groupName === null ? [] : [row.groupName])))]

  const groupIdByName = new Map<string, string>()
  if (groupNames.length === 0) {
    return { groupIdByName, groupsCreated: 0 }
  }

  // Chunked for the same reason previewImport's code lookup is: every name
  // travels in the URL. Until that lookup was chunked this one was hidden
  // behind it, because a file big enough to overflow here overflowed there
  // first and never reached the commit. Now a file can preview cleanly, so
  // this has to hold on its own -- failing at write time, after the staff
  // member has read a preview and pressed Importar, is the worse of the two
  // failures.
  for (const chunk of chunked(groupNames, GROUP_LOOKUP_CHUNK)) {
    const { data: existing, error: selectError } = await supabase
      .from('price_book_groups')
      .select('id, name')
      .in('name', chunk)

    if (selectError) {
      return { error: describeWriteError(selectError) }
    }

    for (const group of (existing ?? []) as { id: string; name: string }[]) {
      groupIdByName.set(group.name, group.id)
    }
  }

  const missingNames = groupNames.filter((name) => !groupIdByName.has(name))
  if (missingNames.length === 0) {
    return { groupIdByName, groupsCreated: 0 }
  }

  const { data: created, error: insertError } = await supabase
    .from('price_book_groups')
    .insert(missingNames.map((name) => ({ name })))
    .select('id, name')

  if (insertError) {
    return { error: describeWriteError(insertError) }
  }

  const createdGroups = (created ?? []) as { id: string; name: string }[]
  for (const group of createdGroups) {
    groupIdByName.set(group.name, group.id)
  }

  return { groupIdByName, groupsCreated: createdGroups.length }
}

/**
 * Writes the import. Re-parses the text rather than trusting the preview
 * the caller claims to confirm: this is a POST endpoint, and the body is
 * whatever the caller sends, whether or not previewImport ever ran over it.
 *
 * Coded rows are upserted on `code` -- that is what makes a corrected file
 * safe to re-run, since it lands on the same row instead of duplicating it.
 * Codeless rows have no identity to match on, so they are always inserted
 * and will duplicate on a second run; the screen warns about this rather
 * than the action guessing at a match. Codeless rows are always brand new,
 * so they keep every field itemInputToRow produces -- there is nothing
 * existing for them to overwrite.
 */
export async function commitImport(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const supabase = await requireAdmin()

  const { text, tooLarge } = readImportText(formData)
  if (tooLarge) {
    return { ...idleImportState, text, error: TOO_LARGE_MESSAGE }
  }

  const { rows, issues, columns } = parseImport(text)

  const resolved = await resolveGroupIds(supabase, rows)
  if ('error' in resolved) {
    return { ...idleImportState, text, issues, error: resolved.error }
  }
  const { groupIdByName, groupsCreated } = resolved

  const codedRows: Record<string, unknown>[] = []
  const codelessRows: ReturnType<typeof itemInputToRow>[] = []

  for (const row of rows) {
    const groupId = row.groupName === null ? null : groupIdByName.get(row.groupName) ?? null
    const input: ItemInput = { ...row.input, groupId }
    if (input.code === null) {
      codelessRows.push(itemInputToRow(input))
    } else {
      codedRows.push(codedItemPayload(input, columns.description))
    }
  }

  if (codedRows.length > 0) {
    const { error } = await supabase.from('price_book_items').upsert(codedRows, { onConflict: 'code' })
    if (error) {
      return { ...idleImportState, text, issues, error: describeWriteError(error) }
    }
  }

  if (codelessRows.length > 0) {
    const { error } = await supabase.from('price_book_items').insert(codelessRows)
    if (error) {
      // The coded upsert above is a separate statement that has already
      // committed -- these two writes are not one transaction. Revalidating
      // before returning the failure stops /admin/price-book from serving a
      // cached page missing rows this import really did write.
      revalidatePath('/admin/price-book')
      return { ...idleImportState, text, issues, error: describeWriteError(error) }
    }
  }

  revalidatePath('/admin/price-book')

  return {
    stage: 'done',
    text: '',
    rows: [],
    issues,
    created: codelessRows.length,
    updated: codedRows.length,
    groupsCreated,
    error: null,
  }
}
