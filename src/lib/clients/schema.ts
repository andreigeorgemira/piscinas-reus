import { z } from 'zod'
import { fieldIssues, firstIssue } from '@/lib/price-book/schema'

export { fieldIssues, firstIssue }

/**
 * What the client form is allowed to write.
 *
 * `clients.email` is `citext not null unique` (0001_core_schema.sql), so two
 * spellings of the same address are the same client as far as the database is
 * concerned -- which is what makes the email the handle staff look a client up
 * by, and what makes a duplicate a 23505 the action words as a sentence rather
 * than a validation error this schema could catch.
 */

/** Optional free text: '' and whitespace both become null, never ''. */
function optionalText(maxLength: number, message: string) {
  return z
    .string()
    .trim()
    .max(maxLength, message)
    .transform((v) => (v === '' ? null : v))
    .nullable()
}

export const clientInputSchema = z.object({
  fullName: z
    .string({ error: 'El nombre es obligatorio.' })
    .trim()
    .min(1, 'El nombre es obligatorio.')
    .max(120, 'El nombre no puede superar los 120 caracteres.'),
  email: z
    .string({ error: 'El correo es obligatorio.' })
    .trim()
    .min(1, 'El correo es obligatorio.')
    .max(254, 'El correo no puede superar los 254 caracteres.')
    .pipe(z.email('El correo no es válido.')),
  phone: optionalText(30, 'El teléfono no puede superar los 30 caracteres.'),
  address: optionalText(200, 'La dirección no puede superar los 200 caracteres.'),
  city: optionalText(80, 'La localidad no puede superar los 80 caracteres.'),
  // Five digits, the Spanish format, and only when filled in. The company
  // builds pools in one province; a postal code that is not five digits is a
  // typo, and the field is where staff look to tell two jobs in the same
  // street apart.
  postalCode: z
    .union([
      z.literal(''),
      z.null(),
      z.string().trim().regex(/^\d{5}$/, 'El código postal debe tener cinco cifras.'),
    ])
    .transform((v) => (v === '' ? null : v)),
  notes: optionalText(4000, 'Las notas no pueden superar los 4000 caracteres.'),
})

export type ClientInput = z.infer<typeof clientInputSchema>

export function clientInputFromForm(formData: FormData): unknown {
  return {
    fullName: formData.get('full_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    city: formData.get('city'),
    postalCode: formData.get('postal_code'),
    notes: formData.get('notes'),
  }
}

export function clientInputToRow(input: ClientInput) {
  return {
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    address: input.address,
    city: input.city,
    postal_code: input.postalCode,
    notes: input.notes,
  }
}
