import { z } from 'zod'
import { fieldIssues, firstIssue } from '@/lib/price-book/schema'
import { vatRateField } from '@/lib/vat'

export { fieldIssues, firstIssue }

/**
 * The company settings form (/admin/settings): what a Server Action may
 * believe about it. Lengths match the check constraints in
 * 0018_company_settings.sql, so a value that passes here is a value the column
 * holds.
 */

function optionalText(maxLength: number, message: string) {
  return z
    .union([z.string(), z.null()])
    .transform((v) => (v ?? '').trim())
    .pipe(z.string().max(maxLength, message))
    .transform((v) => (v === '' ? null : v))
}

/**
 * NIF, NIE or CIF: nine letters and digits once spaces, dots and dashes are
 * gone, optionally behind the "ES" an intra-EU VAT number carries. The control
 * character is not checked -- a mistyped one is caught by whoever reads the
 * document, and a wrong refusal of a valid number blocks the whole form.
 */
const taxIdField = z
  .union([z.string(), z.null()])
  .transform((v) => (v ?? '').replace(/[\s.-]/g, '').toUpperCase())
  .pipe(
    z.union([
      z.literal(''),
      z.string().regex(/^(ES)?[A-Z0-9]{9}$/, 'El NIF/CIF debe tener nueve letras y cifras.'),
    ]),
  )
  .transform((v) => (v === '' ? null : v))

const postalCodeField = z
  .union([z.string(), z.null()])
  .transform((v) => (v ?? '').trim())
  .pipe(z.union([z.literal(''), z.string().regex(/^\d{5}$/, 'El código postal debe tener cinco cifras.')]))
  .transform((v) => (v === '' ? null : v))

const emailField = z
  .union([z.string(), z.null()])
  .transform((v) => (v ?? '').trim())
  .pipe(z.union([z.literal(''), z.email('El correo no es válido.').max(200, 'El correo es demasiado largo.')]))
  .transform((v) => (v === '' ? null : v))

export const companySettingsSchema = z.object({
  tradeName: z
    .string({ error: 'El nombre comercial es obligatorio.' })
    .trim()
    .min(1, 'El nombre comercial es obligatorio.')
    .max(120, 'El nombre comercial no puede superar los 120 caracteres.'),
  tagline: optionalText(200, 'La actividad no puede superar los 200 caracteres.'),
  legalName: optionalText(200, 'La razón social no puede superar los 200 caracteres.'),
  taxId: taxIdField,
  address: optionalText(200, 'La dirección no puede superar los 200 caracteres.'),
  postalCode: postalCodeField,
  city: optionalText(120, 'La localidad no puede superar los 120 caracteres.'),
  province: optionalText(120, 'La provincia no puede superar los 120 caracteres.'),
  phone: optionalText(40, 'El teléfono no puede superar los 40 caracteres.'),
  email: emailField,
  website: optionalText(200, 'La web no puede superar los 200 caracteres.'),
  defaultVatRate: vatRateField,
  quoteFooter: optionalText(600, 'El pie del presupuesto no puede superar los 600 caracteres.'),
})

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>

export function companySettingsFromForm(formData: FormData): unknown {
  return {
    tradeName: formData.get('trade_name'),
    tagline: formData.get('tagline'),
    legalName: formData.get('legal_name'),
    taxId: formData.get('tax_id'),
    address: formData.get('address'),
    postalCode: formData.get('postal_code'),
    city: formData.get('city'),
    province: formData.get('province'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    website: formData.get('website'),
    defaultVatRate: formData.get('default_vat_rate'),
    quoteFooter: formData.get('quote_footer'),
  }
}

export function companySettingsToRow(input: CompanySettingsInput) {
  return {
    trade_name: input.tradeName,
    tagline: input.tagline,
    legal_name: input.legalName,
    tax_id: input.taxId,
    address: input.address,
    postal_code: input.postalCode,
    city: input.city,
    province: input.province,
    phone: input.phone,
    email: input.email,
    website: input.website,
    default_vat_rate: input.defaultVatRate,
    quote_footer: input.quoteFooter,
  }
}
