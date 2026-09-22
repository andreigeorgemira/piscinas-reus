'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import type { ActionState } from '@/app/admin/action-state'
import { isPngDataUrl } from '@/lib/quotes/signature'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type { ActionState }

/**
 * What the person holding the link can do, and nothing else.
 *
 * Every action here runs as `anon`: the visitor has no session and none is
 * created. The token in the form is the whole credential, and what it unlocks
 * is decided by the four functions in 0015_public_quote_link.sql, not here --
 * this module reads the form, calls one of them, and turns a refusal into a
 * sentence in Spanish.
 *
 * The token is never trusted as an identifier of anything: it is passed
 * straight through to the function, which is the only thing that knows which
 * row (if any) it names.
 */

const NOT_OPEN =
  'Este presupuesto ya no está abierto. Si crees que es un error, escríbenos y te mandamos uno nuevo.'

function readToken(formData: FormData): string | null {
  const raw = formData.get('token')
  // Long enough to be one of ours (32 bytes base64url is 43 characters) and
  // short enough not to be somebody probing with a paragraph.
  if (typeof raw !== 'string' || raw.length < 20 || raw.length > 200) return null
  return raw
}

/** Ticks or unticks one optional extra. */
export async function toggleExtra(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = readToken(formData)
  const itemId = formData.get('item_id')
  const selected = formData.get('selected') === 'on'

  if (token === null || typeof itemId !== 'string') {
    return { error: NOT_OPEN }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('set_quote_extra_by_token', {
    p_token: token,
    p_item_id: itemId,
    p_selected: selected,
  })

  if (error) {
    console.error('public extra toggle failed', error)
    return { error: 'No se pudo guardar. Vuelve a intentarlo.' }
  }
  if (data !== true) {
    return { error: NOT_OPEN }
  }

  revalidatePath(`/q/${token}`)
  return { error: null }
}

/**
 * Accepting: the signature, and the move that turns a quote into work.
 *
 * The user agent goes with it. It is not identification and is not treated as
 * any: it is the one detail that tells the office "signed from a phone in the
 * garden" rather than nothing at all, months later, if anybody asks what
 * happened.
 */
export async function acceptQuote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = readToken(formData)
  if (token === null) {
    return { error: NOT_OPEN }
  }

  const name = String(formData.get('name') ?? '').trim()
  if (name === '') {
    return { error: 'Escribe tu nombre para firmar.' }
  }

  const signature = String(formData.get('signature') ?? '')
  // Checked to the byte, not by its prefix: a value that only looks like a PNG
  // makes the PDF renderer hang rather than fail (src/lib/quotes/signature.ts).
  // Dropped rather than refused, so a slow phone cannot lose an acceptance over
  // a drawing.
  const image = isPngDataUrl(signature, 280_000) ? signature : null

  const userAgent = (await headers()).get('user-agent') ?? ''

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('accept_quote_by_token', {
    p_token: token,
    p_name: name,
    p_signature: image,
    p_user_agent: userAgent,
  })

  if (error) {
    if (error.message.includes('has no client')) {
      return {
        error:
          'Falta un dato en el presupuesto y no podemos cerrarlo desde aquí. Escríbenos y lo arreglamos en un momento.',
      }
    }
    if (error.message.includes('not open for signing')) {
      return { error: NOT_OPEN }
    }
    console.error('public acceptance failed', error)
    return { error: 'No se pudo firmar. Vuelve a intentarlo.' }
  }

  revalidatePath(`/q/${token}`)
  return { error: null }
}

/** The other answer, with room to say why. */
export async function rejectQuote(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = readToken(formData)
  if (token === null) {
    return { error: NOT_OPEN }
  }

  const reason = String(formData.get('reason') ?? '').trim()

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('reject_quote_by_token', {
    p_token: token,
    p_reason: reason === '' ? null : reason,
  })

  if (error) {
    console.error('public rejection failed', error)
    return { error: 'No se pudo enviar la respuesta. Vuelve a intentarlo.' }
  }
  if (data !== true) {
    return { error: NOT_OPEN }
  }

  revalidatePath(`/q/${token}`)
  return { error: null }
}
