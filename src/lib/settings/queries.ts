import type { SupabaseClient } from '@supabase/supabase-js'
import { letterheadFromRow, type Letterhead, type LetterheadRow } from './letterhead'

/** Everything on the settings screen: the letterhead and the VAT default. */
export type CompanySettings = Letterhead & {
  /** The rate a new quote starts with. Null: new quotes carry no VAT. */
  defaultVatRate: number | null
}

const SETTINGS_SELECT =
  'trade_name, tagline, legal_name, tax_id, address, postal_code, city, province, phone, email, website, quote_footer, default_vat_rate'

/**
 * The one row of public.company_settings, for staff.
 *
 * Throws when it cannot be read: the migration creates the row and nothing can
 * delete it, so its absence is a broken deployment, not a state to render.
 */
export async function getCompanySettings(supabase: SupabaseClient): Promise<CompanySettings> {
  const { data, error } = await supabase
    .from('company_settings')
    .select(SETTINGS_SELECT)
    .eq('id', true)
    .single()

  if (error) throw error

  const row = data as LetterheadRow & { default_vat_rate: number | string | null }
  return {
    ...letterheadFromRow(row),
    defaultVatRate: row.default_vat_rate === null ? null : Number(row.default_vat_rate),
  }
}
