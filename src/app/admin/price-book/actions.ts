'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { firstIssue, groupInputFromForm, groupInputSchema } from '@/lib/price-book/schema'

export type ActionState = { error: string | null }

export const idleState: ActionState = { error: null }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Spelled out once so a create and a rename can never drift onto slightly
// different wording for the same constraint violation.
const DUPLICATE_GROUP_NAME = 'Ya existe un grupo con ese nombre.'
const INVALID_GROUP_ID = 'El grupo no es válido.'

/**
 * A form field that names a row (`id`, later `group_id`) is attacker
 * controlled and reaches a `.eq()` filter, never a parameterised query on its
 * own. Postgres would reject a malformed uuid anyway, but that rejection is
 * the driver's own text -- rejecting the shape here keeps every caller past
 * this point working with a value that can only ever match zero or one row.
 */
function readId(formData: FormData, field: string): string | null {
  const raw = formData.get(field)
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}

/**
 * Maps a write's Postgres error to Spanish prose fit for a staff member's
 * screen. Only the codes this screen can actually provoke are named:
 * `23505` (unique violation - the caller says which constraint, since the
 * same code fires for a duplicate group name, a duplicate item code, and
 * later constraints this file doesn't know about yet) and `42501`
 * (RLS/permission refusal - reachable only if a non-admin bypasses the UI
 * and posts to the action directly, since requireAdmin already turned away
 * everyone else). Anything else is logged for the developer and shown as a
 * generic message, because the driver's own text names constraints and
 * columns that belong in a log, not on a staff member's screen.
 */
function describeWriteError(error: PostgrestError, duplicate: string): string {
  switch (error.code) {
    case '23505':
      return duplicate
    case '42501':
      return 'No tienes permiso para hacer esto.'
    default:
      console.error('price-book write failed', error)
      return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
  }
}

export async function createGroup(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const parsed = groupInputSchema.safeParse(groupInputFromForm(formData))
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) }
  }

  const { error } = await supabase.from('price_book_groups').insert({
    name: parsed.data.name,
    position: parsed.data.position,
  })

  if (error) {
    return { error: describeWriteError(error, DUPLICATE_GROUP_NAME) }
  }

  revalidatePath('/admin/price-book')
  return idleState
}

export async function updateGroup(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readId(formData, 'id')
  if (id === null) {
    return { error: INVALID_GROUP_ID }
  }

  const parsed = groupInputSchema.safeParse(groupInputFromForm(formData))
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) }
  }

  const { error } = await supabase
    .from('price_book_groups')
    .update({ name: parsed.data.name, position: parsed.data.position })
    .eq('id', id)

  if (error) {
    return { error: describeWriteError(error, DUPLICATE_GROUP_NAME) }
  }

  revalidatePath('/admin/price-book')
  return idleState
}

/**
 * Deleting a group never deletes its prices: `price_book_items.group_id` is
 * `on delete set null` (migration 0001_core_schema.sql), so every item that
 * belonged to this group simply reappears under the synthetic "Sin grupo"
 * bucket the next time the catalogue is listed. That is why this action is
 * safe to offer without a cascading confirmation -- there is no data loss to
 * warn about beyond the grouping itself, which the confirmation dialog in
 * the client component still surfaces so staff aren't surprised by items
 * moving.
 */
export async function deleteGroup(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readId(formData, 'id')
  if (id === null) {
    return { error: INVALID_GROUP_ID }
  }

  const { error } = await supabase.from('price_book_groups').delete().eq('id', id)

  if (error) {
    return { error: describeWriteError(error, DUPLICATE_GROUP_NAME) }
  }

  revalidatePath('/admin/price-book')
  return idleState
}
