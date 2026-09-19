'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import type { ActionState } from '@/app/admin/price-book/action-state'
import { requireAdmin } from '@/lib/auth/require-admin'

export type { ActionState }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DUPLICATE_NAME = 'Ya existe un tarifario con ese nombre.'
const INVALID_ID = 'El tarifario no es válido.'

const bookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio.')
    .max(80, 'El nombre no puede pasar de 80 caracteres.'),
  description: z.string().trim().max(300, 'La descripción no puede pasar de 300 caracteres.'),
})

function readId(formData: FormData, field: string): string | null {
  const raw = formData.get(field)
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}

function describeWriteError(error: PostgrestError): string {
  switch (error.code) {
    case '23505':
      return DUPLICATE_NAME
    case '42501':
      return 'No tienes permiso para hacer esto.'
    default:
      console.error('price book write failed', error)
      return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
  }
}

function readInput(formData: FormData) {
  return bookSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
  })
}

export async function createPriceBook(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const parsed = readInput(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  // New books go to the end of the list. Position is not a field staff fill
  // in: the order of two or three catalogues is not worth a number on a form.
  const { data: last } = await supabase
    .from('price_books')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('price_books').insert({
    name: parsed.data.name,
    description: parsed.data.description === '' ? null : parsed.data.description,
    position: (last?.position ?? 0) + 1,
  })

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidatePath('/admin/price-books')
  return { error: null }
}

export async function updatePriceBook(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readId(formData, 'id')
  if (id === null) {
    return { error: INVALID_ID }
  }

  const parsed = readInput(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const { error } = await supabase
    .from('price_books')
    .update({
      name: parsed.data.name,
      description: parsed.data.description === '' ? null : parsed.data.description,
    })
    .eq('id', id)

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidatePath('/admin/price-books')
  revalidatePath(`/admin/price-books/${id}`)
  return { error: null }
}

/**
 * Deletes a book and, with it, every group and concept inside it: the
 * foreign keys added in 0012_price_books.sql cascade.
 *
 * Quotes are untouched. quote_items copied every name, unit and price it
 * needed when the line was written (0001_core_schema.sql), so a quote
 * written from this book still shows the client exactly what it showed them
 * -- it only loses the pointer back to a catalogue that no longer exists.
 * The confirmation dialog says so, because from the screen the two are
 * indistinguishable.
 */
export async function deletePriceBook(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readId(formData, 'id')
  if (id === null) {
    return { error: INVALID_ID }
  }

  const { error } = await supabase.from('price_books').delete().eq('id', id)

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidatePath('/admin/price-books')
  return { error: null }
}
