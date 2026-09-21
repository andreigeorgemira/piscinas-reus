import { z } from 'zod'
import { parseDecimal } from '@/lib/price-book/decimal'
import { firstIssue, moneyField, UNIT_TYPES } from '@/lib/price-book/schema'
import { hasMoreThanThreeDecimals } from './quantity'

export { firstIssue }

/**
 * What a Server Action is allowed to believe about a quote and its lines.
 *
 * A Server Action is a POST endpoint anyone can call with any body
 * (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md,
 * the warning under "What are Server Functions?"), so nothing in a FormData is
 * trustworthy. Authorization is RLS's job; this is the shape and range check
 * that stops a valid admin from writing a quote the column cannot hold or the
 * client cannot read.
 */

// A business ceiling, not a column limit: numeric(12,3) holds nine integer
// digits. Nothing on a pool is quoted in a million of anything, so a figure
// this large is a stray digit rather than a measurement.
const MAX_QUANTITY = 999_999.999

/** Optional free text: '' and whitespace both become null, never ''. */
function optionalText(maxLength: number, message: string) {
  return z
    .string()
    .trim()
    .max(maxLength, message)
    .transform((v) => (v === '' ? null : v))
    .nullable()
}

/**
 * A date as `<input type="date">` posts it, or null when the field is empty.
 *
 * The shape is checked rather than the calendar: '2026-02-31' passes here and
 * is refused by Postgres with 22008, which the action turns into a sentence.
 * Re-implementing the calendar in zod to move that message two layers earlier
 * would be a second definition of what a date is.
 */
function dateField(label: string) {
  return z
    .union([z.literal(''), z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} no es una fecha válida.`)])
    .transform((v) => (v === '' ? null : v))
}

/**
 * Quantities take three decimals where money takes two: tiling is measured to
 * the millimetre of a cut (see src/lib/quotes/quantity.ts). Rejecting a fourth
 * rather than rounding it follows the same reasoning as prices -- the number
 * typed must be the number charged.
 */
const quantityField = z
  .string({ error: 'La cantidad es obligatoria.' })
  .transform((raw, ctx) => {
    const parsed = parseDecimal(raw)
    if (parsed === null) {
      ctx.addIssue({ code: 'custom', message: 'La cantidad no es un número válido.' })
      return z.NEVER
    }
    if (hasMoreThanThreeDecimals(parsed)) {
      ctx.addIssue({ code: 'custom', message: 'La cantidad no puede tener más de tres decimales.' })
      return z.NEVER
    }
    return parsed
  })
  .pipe(
    z
      .number()
      // The check constraint on the column says `quantity >= 0`
      // (0001_core_schema.sql). Zero is legal on purpose: a line priced but
      // not yet measured sits at 0 while the rest of the quote is written.
      .min(0, 'La cantidad no puede ser negativa.')
      .max(MAX_QUANTITY, 'La cantidad es demasiado grande.'),
  )

/**
 * A price or a cost, where leaving the box empty means zero.
 *
 * The price book refuses a blank figure, and rightly: a catalogue entry with no
 * price is an entry nobody finished. A quote line is different. A one-off line
 * written during a phone call often has no known cost yet, and a line at no
 * charge -- included, thrown in, already paid for -- is a real thing to quote.
 * Both are typed as an empty box, and both mean zero.
 *
 * Only a BLANK box means zero. 'abc' is still refused, so a mistyped figure
 * cannot slip through as nothing.
 */
function moneyOrZero(label: string) {
  return z
    .string({ error: `El ${label} es obligatorio.` })
    .transform((raw) => (raw.trim() === '' ? '0' : raw))
    .pipe(moneyField(label))
}

const discountField = z
  .string({ error: 'El descuento es obligatorio.' })
  .transform((raw) => (raw.trim() === '' ? '0' : raw))
  .transform((raw, ctx) => {
    const parsed = parseDecimal(raw)
    if (parsed === null) {
      ctx.addIssue({ code: 'custom', message: 'El descuento no es un número válido.' })
      return z.NEVER
    }
    return parsed
  })
  .pipe(
    z
      .number()
      .min(0, 'El descuento no puede ser negativo.')
      .max(100, 'El descuento no puede pasar del 100%.'),
  )

/** The quote itself: who it is for, what it is called, and its dates. */
export const quoteInputSchema = z.object({
  clientId: z.uuid('El cliente no es válido.'),
  title: z
    .string({ error: 'El título es obligatorio.' })
    .trim()
    .min(1, 'El título es obligatorio.')
    .max(200, 'El título no puede superar los 200 caracteres.'),
  startDatePlanned: dateField('La fecha de inicio'),
  validUntil: dateField('La validez'),
  // Shown to the client on the PDF, so it holds the terms and conditions.
  clientNotes: optionalText(4000, 'Las notas para el cliente no pueden superar los 4000 caracteres.'),
  // Never leaves the admin zone (spec, section 7). The column is admin-only
  // and the client-facing view omits it (0004_client_views.sql).
  internalNotes: optionalText(4000, 'Las notas internas no pueden superar los 4000 caracteres.'),
})

export type QuoteInput = z.infer<typeof quoteInputSchema>

/**
 * One line. Every descriptive and monetary field is a snapshot rather than a
 * reference (spec, section 7): editing the price book must never rewrite a
 * quote already sent, so the line carries its own copy of all of it and this
 * schema validates that copy.
 */
export const quoteItemInputSchema = z.object({
  name: z
    .string({ error: 'El concepto es obligatorio.' })
    .trim()
    .min(1, 'El concepto es obligatorio.')
    .max(200, 'El concepto no puede superar los 200 caracteres.'),
  description: optionalText(2000, 'La descripción no puede superar los 2000 caracteres.'),
  unit: z.enum(UNIT_TYPES, 'La unidad no es válida.'),
  quantity: quantityField,
  unitCost: moneyOrZero('coste'),
  unitPrice: moneyOrZero('precio'),
  discountPct: discountField,
  isRecommended: z.boolean(),
})

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>

export function quoteInputFromForm(formData: FormData): unknown {
  return {
    clientId: formData.get('client_id'),
    title: formData.get('title'),
    startDatePlanned: formData.get('start_date_planned'),
    validUntil: formData.get('valid_until'),
    clientNotes: formData.get('client_notes'),
    internalNotes: formData.get('internal_notes'),
  }
}

export function quoteItemInputFromForm(formData: FormData): unknown {
  return {
    name: formData.get('name'),
    description: formData.get('description'),
    unit: formData.get('unit'),
    quantity: formData.get('quantity'),
    unitCost: formData.get('unit_cost'),
    unitPrice: formData.get('unit_price'),
    discountPct: formData.get('discount_pct'),
    // An unchecked checkbox posts nothing at all, so `get` returns null
    // rather than 'off' -- absence must read as false.
    isRecommended: formData.get('is_recommended') === 'on',
  }
}

export function quoteInputToRow(input: QuoteInput) {
  return {
    client_id: input.clientId,
    title: input.title,
    start_date_planned: input.startDatePlanned,
    valid_until: input.validUntil,
    client_notes: input.clientNotes,
    internal_notes: input.internalNotes,
  }
}

export function quoteItemInputToRow(input: QuoteItemInput) {
  return {
    name: input.name,
    description: input.description,
    unit: input.unit,
    quantity: input.quantity,
    unit_cost: input.unitCost,
    unit_price: input.unitPrice,
    discount_pct: input.discountPct,
    is_recommended: input.isRecommended,
  }
}
