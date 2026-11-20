import { z } from 'zod'
import { formatPercent, hasMoreThanTwoDecimals, parseDecimal } from '@/lib/price-book/decimal'

/**
 * VAT as a quote carries it: a percentage, or null for "no VAT on this
 * document" (0018_company_settings.sql, 0019_quote_vat_and_presentation.sql).
 *
 * The arithmetic lives in the database (public.vat_amount, the quote_totals
 * view, quote_by_token); this module only names the choices and reads them
 * from a form.
 */

/** The rates Spain charges, the general one first. */
export const VAT_RATE_CHOICES = [21, 10, 4, 0] as const

/** The form value for "no VAT on this document". */
export const NO_VAT = 'none'

/** "21 %", "10 %", "4 %", "0 %", in the Spanish way of writing a percentage. */
export function formatVatRate(rate: number): string {
  return formatPercent(rate)
}

/** What a select offers for a rate, and what the document says. */
export function vatChoiceLabel(rate: number | null): string {
  if (rate === null) return 'Sin IVA (IVA no incluido)'
  if (rate === 21) return 'IVA 21 % (general)'
  if (rate === 10) return 'IVA 10 % (reducido)'
  if (rate === 4) return 'IVA 4 % (superreducido)'
  if (rate === 0) return 'IVA 0 % (exento)'
  return `IVA ${formatVatRate(rate)}`
}

/**
 * A VAT rate from a form: 'none' (or nothing) is null, anything else a
 * percentage between 0 and 100 with at most two decimals.
 */
export const vatRateField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((raw, ctx) => {
    if (raw === null || raw === undefined) return null
    // A trailing '%' is how people write a rate; it is not part of the number.
    const trimmed = raw.trim().replace(/\s*%$/, '')
    if (trimmed === '' || trimmed === NO_VAT) return null
    const parsed = parseDecimal(trimmed)
    if (parsed === null || hasMoreThanTwoDecimals(parsed) || parsed < 0 || parsed > 100) {
      ctx.addIssue({ code: 'custom', message: 'El tipo de IVA no es válido.' })
      return z.NEVER
    }
    return parsed
  })
