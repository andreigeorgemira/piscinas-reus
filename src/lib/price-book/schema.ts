import { z } from 'zod'
import { hasMoreThanTwoDecimals, parseDecimal } from './decimal'

// Must match the `unit_type` enum in supabase/migrations/0001_core_schema.sql,
// in order -- this array is the single source of truth callers rely on
// (e.g. building a <select>), so a mismatch here silently desyncs the form
// from what the database will accept.
export const UNIT_TYPES = ['m2', 'ml', 'unit', 'hour', 'kg', 'lot'] as const

export type UnitType = (typeof UNIT_TYPES)[number]

export const UNIT_LABELS: Record<UnitType, string> = {
  m2: 'm²',
  ml: 'ml',
  unit: 'ud.',
  hour: 'hora',
  kg: 'kg',
  lot: 'partida',
}

// The largest amount `numeric(12,2)` can hold: 10 integer digits + 2 decimals.
const MAX_MONEY = 9_999_999.99

/**
 * Money arrives as a string (that's what a form posts) typed the Spanish way,
 * and leaves as a number. Rejecting rather than rounding a third decimal is
 * deliberate: silently rounding would charge a different amount than what
 * was typed with nothing on screen saying so (see decimal.ts).
 */
function moneyField(label: string) {
  return z
    .string({ error: `El ${label} es obligatorio.` })
    .transform((raw, ctx) => {
      const parsed = parseDecimal(raw)
      if (parsed === null) {
        ctx.addIssue({ code: 'custom', message: `El ${label} no es un número válido.` })
        return z.NEVER
      }
      if (hasMoreThanTwoDecimals(parsed)) {
        ctx.addIssue({
          code: 'custom',
          message: `El ${label} no puede tener más de dos decimales.`,
        })
        return z.NEVER
      }
      return parsed
    })
    .pipe(
      z
        .number()
        .min(0, `El ${label} no puede ser negativo.`)
        .max(MAX_MONEY, `El ${label} es demasiado grande.`),
    )
}

// Optional text: '' and whitespace-only both collapse to null, never ''.
// price_book_items.code carries a unique index, and Postgres treats every
// NULL as distinct -- so codeless items coexist, where empty strings on a
// second row would collide on that index.
function optionalText(maxLength: number, message: string) {
  return z
    .string()
    .trim()
    .max(maxLength, message)
    .transform((v) => (v === '' ? null : v))
}

export const groupInputSchema = z.object({
  name: z
    .string({ error: 'El nombre del grupo es obligatorio.' })
    .trim()
    .min(1, 'El nombre del grupo es obligatorio.')
    .max(80, 'El nombre del grupo no puede superar los 80 caracteres.'),
  position: z.coerce
    .number({ error: 'La posición no es válida.' })
    .int('La posición debe ser un número entero.')
    .min(0, 'La posición no puede ser negativa.')
    .max(9999, 'La posición es demasiado grande.'),
})

export const itemInputSchema = z.object({
  groupId: z
    .union([z.literal(''), z.null(), z.uuid('El grupo no es válido.')])
    .transform((v) => (v === '' ? null : v)),
  code: optionalText(40, 'El código no puede superar los 40 caracteres.').nullable(),
  name: z
    .string({ error: 'El nombre es obligatorio.' })
    .trim()
    .min(1, 'El nombre es obligatorio.')
    .max(200, 'El nombre no puede superar los 200 caracteres.'),
  description: optionalText(2000, 'La descripción no puede superar los 2000 caracteres.')
    .nullable(),
  unit: z.enum(UNIT_TYPES, 'La unidad no es válida.'),
  unitCost: moneyField('coste'),
  unitPrice: moneyField('precio'),
  isActive: z.boolean(),
})

export type ItemInput = z.infer<typeof itemInputSchema>

export function groupInputFromForm(formData: FormData): unknown {
  return {
    name: formData.get('name'),
    position: formData.get('position'),
  }
}

export function itemInputFromForm(formData: FormData): unknown {
  return {
    groupId: formData.get('group_id'),
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description'),
    unit: formData.get('unit'),
    unitCost: formData.get('unit_cost'),
    unitPrice: formData.get('unit_price'),
    // An unchecked checkbox posts nothing at all, so formData.get returns
    // null rather than 'off' -- absence must read as false.
    isActive: formData.get('is_active') === 'on',
  }
}

export function itemInputToRow(input: ItemInput) {
  return {
    group_id: input.groupId,
    code: input.code,
    name: input.name,
    description: input.description,
    unit: input.unit,
    unit_cost: input.unitCost,
    unit_price: input.unitPrice,
    is_active: input.isActive,
  }
}

/** The first validation message, for surfacing a single error to the form. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Datos no válidos.'
}
