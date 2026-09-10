'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { parseImport, type ImportRow } from '@/lib/price-book/csv'
import { itemInputToRow, type ItemInput } from '@/lib/price-book/schema'
import { idleImportState, type ImportState, type PreviewRow } from './import-state'

// Re-exported so callers still read the contract off this module. Only the
// types: a value re-export would be a runtime export of a 'use server' file,
// which is exactly what ./import-state exists to avoid.
export type { ImportState, PreviewRow }

// About 4000 rows at a realistic per-row size -- far past any real
// catalogue, but small enough that parsing it inside one request is not a
// denial-of-service vector.
const MAX_IMPORT_BYTES = 200 * 1024

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

  let existingCodes = new Set<string>()
  if (codes.length > 0) {
    const { data, error } = await supabase.from('price_book_items').select('code').in('code', codes)
    if (error) {
      return {
        ...idleImportState,
        text,
        error: 'No se pudo comprobar el tarifario. Inténtalo de nuevo.',
      }
    }
    existingCodes = new Set(
      ((data ?? []) as { code: string | null }[]).flatMap((row) => (row.code === null ? [] : [row.code])),
    )
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

  const { data: existing, error: selectError } = await supabase
    .from('price_book_groups')
    .select('id, name')
    .in('name', groupNames)

  if (selectError) {
    return { error: describeWriteError(selectError) }
  }

  for (const group of (existing ?? []) as { id: string; name: string }[]) {
    groupIdByName.set(group.name, group.id)
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
 * than the action guessing at a match.
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

  const { rows, issues } = parseImport(text)

  const resolved = await resolveGroupIds(supabase, rows)
  if ('error' in resolved) {
    return { ...idleImportState, text, issues, error: resolved.error }
  }
  const { groupIdByName, groupsCreated } = resolved

  const codedRows: ReturnType<typeof itemInputToRow>[] = []
  const codelessRows: ReturnType<typeof itemInputToRow>[] = []

  for (const row of rows) {
    const groupId = row.groupName === null ? null : groupIdByName.get(row.groupName) ?? null
    const input: ItemInput = { ...row.input, groupId }
    const record = itemInputToRow(input)
    if (input.code === null) {
      codelessRows.push(record)
    } else {
      codedRows.push(record)
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
