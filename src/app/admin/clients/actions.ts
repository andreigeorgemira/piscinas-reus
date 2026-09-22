'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError } from '@supabase/supabase-js'
import type { ActionState } from '@/app/admin/action-state'
import { readUuid } from '@/app/admin/form-values'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  clientInputFromForm,
  clientInputSchema,
  clientInputToRow,
  fieldIssues,
  firstIssue,
} from '@/lib/clients/schema'

export type { ActionState }

/**
 * What the client form answers with.
 *
 * `created` rides back because of where this form is opened from: a dialog on
 * top of the quote dialog, whose whole point is that the client it just created
 * ends up selected without anybody visiting the clients screen. An edit leaves
 * it absent -- the caller already had the client.
 */
export type ClientFormState = ActionState & {
  created?: { id: string; fullName: string }
}

const INVALID_ID = 'El cliente no es válido.'

/**
 * Turns a database refusal into something a staff member can act on.
 *
 * The two that matter here are worth naming rather than logging: a duplicate
 * email is the same client entered twice, which is the single most likely way
 * this form fails, and a 23503 on delete is the `on delete restrict` on
 * quotes.client_id (0001_core_schema.sql) saying the client has paperwork.
 */
function describeWriteError(error: PostgrestError): string {
  switch (error.code) {
    case '23505':
      return 'Ya hay un cliente con ese correo.'
    case '23503':
      return 'Este cliente tiene presupuestos. Bórralos primero o deja el cliente como está.'
    case '42501':
      return 'No tienes permiso para hacer esto.'
    default:
      console.error('client write failed', error)
      return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
  }
}

export async function createClient(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const supabase = await requireAdmin()

  const parsed = clientInputSchema.safeParse(clientInputFromForm(formData))
  if (!parsed.success) {
    return { error: firstIssue(parsed.error), fields: fieldIssues(parsed.error) }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(clientInputToRow(parsed.data))
    .select('id, full_name')
    .single()

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidatePath('/admin/clients')
  return { error: null, created: { id: data!.id, fullName: data!.full_name } }
}

export async function updateClient(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  if (id === null) {
    return { error: INVALID_ID }
  }

  const parsed = clientInputSchema.safeParse(clientInputFromForm(formData))
  if (!parsed.success) {
    return { error: firstIssue(parsed.error), fields: fieldIssues(parsed.error) }
  }

  const { error } = await supabase
    .from('clients')
    .update(clientInputToRow(parsed.data))
    .eq('id', id)

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidatePath('/admin/clients')
  revalidatePath(`/admin/clients/${id}`)
  // The client's name is printed on every quote row that belongs to them.
  revalidatePath('/admin/quotes')
  return { error: null }
}

/**
 * Deletes a client who has no paperwork.
 *
 * `quotes.client_id` is `on delete restrict`, so a client with a single quote
 * cannot be deleted and the database says so -- which is the behaviour the
 * business wants: the quote is the record of what was offered, and a client
 * row disappearing under it would leave a quote nobody can attribute.
 *
 * The portal account, if there is one, survives: `clients.user_id` is
 * `on delete set null` in the other direction and auth.users is not touched
 * here.
 */
export async function deleteClient(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  if (id === null) {
    return { error: INVALID_ID }
  }

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidatePath('/admin/clients')
  return { error: null }
}
