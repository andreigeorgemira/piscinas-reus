'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { PostgrestError } from '@supabase/supabase-js'
import type { ActionState } from '@/app/admin/action-state'
import { readUuid } from '@/app/admin/form-values'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  fieldIssues,
  firstIssue,
  quoteInputFromForm,
  quoteInputSchema,
  quoteInputToRow,
} from '@/lib/quotes/schema'
import { isEditable, QUOTE_STATUSES, type QuoteStatus } from '@/lib/quotes/status'

export type { ActionState }

const INVALID_ID = 'El presupuesto no es válido.'

/**
 * A database refusal, in words a staff member can act on.
 *
 * P0001 is this schema's own voice: both guard_quote_item_edit
 * (0009_quote_immutability.sql) and set_quote_status
 * (0013_quote_lifecycle.sql) raise it, and its message is written for a
 * developer reading a log. The screen says what to do about it instead, and
 * the original goes to the log where that wording belongs.
 */
function describeWriteError(error: PostgrestError, fallback: string): string {
  switch (error.code) {
    case 'P0001':
      console.error('quote write refused by the database', error)
      return fallback
    case '23503':
      return 'El cliente ya no existe.'
    case '22008':
    case '22007':
      return 'Alguna fecha no es válida.'
    case '42501':
      return 'No tienes permiso para hacer esto.'
    default:
      console.error('quote write failed', error)
      return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
  }
}

/**
 * Opens a quote and goes to it.
 *
 * The reference and the access token are not passed: the database allocates
 * both (0013_quote_lifecycle.sql). Neither is the status -- a new quote is a
 * draft by the column's own default, and there is no screen from which
 * creating something already sent would make sense.
 *
 * It redirects instead of returning, because there is nothing to say: the
 * quote that was just created is the next screen. redirect() throws the
 * NEXT_REDIRECT control flow error, so nothing after it runs
 * (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md).
 */
export async function createQuote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const parsed = quoteInputSchema.safeParse(quoteInputFromForm(formData))
  if (!parsed.success) {
    // Field by field, so the dialog can mark the box that is wrong instead of
    // printing one sentence over six inputs and clearing them all.
    return { error: firstIssue(parsed.error), fields: fieldIssues(parsed.error) }
  }

  const { data, error } = await supabase
    .from('quotes')
    .insert(quoteInputToRow(parsed.data))
    .select('id')
    .single()

  if (error) {
    return { error: describeWriteError(error, 'No se pudo crear el presupuesto.') }
  }

  revalidatePath('/admin/quotes')
  if (parsed.data.clientId) {
    revalidatePath(`/admin/clients/${parsed.data.clientId}`)
  }
  redirect(`/admin/quotes/${data!.id}`)
}

/**
 * The quote's own fields: client, title, dates, notes. Not its lines.
 *
 * Refused unless the quote is a draft, and the check is here rather than in the
 * database -- which is worth being explicit about, because it is the one rule on
 * this screen that is NOT enforced by Postgres. The lines of a sent quote are
 * frozen by a trigger (0009_quote_immutability.sql); its title, its client and
 * the notes the PDF prints are not, so a POST straight at this endpoint could
 * change what a client is reading while they read it. The panel hides the Editar
 * button in the same case, but a hidden button is not a rule.
 *
 * A trigger on public.quotes is the better home for this, and it is a narrow
 * one to write: it has to let set_quote_status through, since that function
 * updates status, sent_at, responded_at and access_token on a quote that is by
 * definition not a draft. Left for the migration that can be tested on its own
 * rather than bundled into this screen.
 */
export async function updateQuote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  if (id === null) {
    return { error: INVALID_ID }
  }

  const parsed = quoteInputSchema.safeParse(quoteInputFromForm(formData))
  if (!parsed.success) {
    return { error: firstIssue(parsed.error), fields: fieldIssues(parsed.error) }
  }

  const { data: current, error: readError } = await supabase
    .from('quotes')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (readError) {
    return { error: describeWriteError(readError, 'No se pudo leer el presupuesto.') }
  }
  // Not found and not visible are the same answer on purpose: RLS is what
  // hides another caller's quote, and saying which it was would say whether
  // the id exists.
  if (!current) {
    return { error: INVALID_ID }
  }
  if (!isEditable(current.status as QuoteStatus)) {
    return {
      error:
        'Este presupuesto ya no es un borrador. Vuelve a borrador antes de cambiar sus datos.',
    }
  }

  const { error } = await supabase.from('quotes').update(quoteInputToRow(parsed.data)).eq('id', id)

  if (error) {
    return { error: describeWriteError(error, 'No se pudo guardar el presupuesto.') }
  }

  revalidatePath('/admin/quotes')
  revalidatePath(`/admin/quotes/${id}`)
  return { error: null }
}

/**
 * Moves a quote between statuses.
 *
 * Every side effect belongs to set_quote_status in the database: stamping
 * sent_at, creating the project on acceptance, rotating the access token on the
 * way back to draft. This function only says which move was asked for.
 */
export async function moveQuoteStatus(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  if (id === null) {
    return { error: INVALID_ID }
  }

  const status = formData.get('status')
  if (typeof status !== 'string' || !(QUOTE_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Ese estado no existe.' }
  }

  const { error } = await supabase.rpc('set_quote_status', {
    p_quote_id: id,
    p_status: status as QuoteStatus,
  })

  if (error) {
    // The one P0001 from set_quote_status worth its own sentence: accepting is
    // where a quote becomes a project, and a project belongs to somebody
    // (0014_quote_without_client.sql).
    if (error.message.includes('has no client')) {
      return {
        error:
          'Asigna un cliente antes de aceptarlo: al aceptar nace el proyecto, y un proyecto es de alguien.',
      }
    }
    return {
      error: describeWriteError(error, 'Ese cambio de estado no es posible desde el estado actual.'),
    }
  }

  revalidatePath('/admin/quotes')
  revalidatePath(`/admin/quotes/${id}`)
  return { error: null }
}

/**
 * Deletes a quote and every line on it: `quote_items.quote_id` cascades
 * (0001_core_schema.sql).
 *
 * Legal even once sent, and deliberately so -- the guard in 0009 lets the
 * cascade through because destroying the record is honest where silently
 * editing a figure a client is reading is not. What it does not do is retire
 * the access token: the link simply stops resolving, and the token is freed for
 * a later quote to be given. That is worth knowing but not worth preventing --
 * an old link resolving to a different quote's numbers would need the token to
 * be reused, and new_access_token() draws from 244 random bits.
 */
export async function deleteQuote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  if (id === null) {
    return { error: INVALID_ID }
  }

  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) {
    return { error: describeWriteError(error, 'No se pudo borrar el presupuesto.') }
  }

  revalidatePath('/admin/quotes')
  redirect('/admin/quotes')
}
