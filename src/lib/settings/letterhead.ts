/**
 * Who a quote is from, as every document prints it: the PDF, the client's
 * page and the email. Built from public.company_settings
 * (0018_company_settings.sql) -- read directly by staff, or through
 * quote_by_token's `company` by the person holding a link.
 */
export type Letterhead = {
  tradeName: string
  tagline: string | null
  legalName: string | null
  taxId: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  province: string | null
  phone: string | null
  email: string | null
  website: string | null
  quoteFooter: string | null
}

/** The row's columns, as company_letterhead() and a select both name them. */
export type LetterheadRow = {
  trade_name: string
  tagline: string | null
  legal_name: string | null
  tax_id: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  province: string | null
  phone: string | null
  email: string | null
  website: string | null
  quote_footer: string | null
}

export function letterheadFromRow(row: LetterheadRow): Letterhead {
  return {
    tradeName: row.trade_name,
    tagline: row.tagline,
    legalName: row.legal_name,
    taxId: row.tax_id,
    address: row.address,
    postalCode: row.postal_code,
    city: row.city,
    province: row.province,
    phone: row.phone,
    email: row.email,
    website: row.website,
    quoteFooter: row.quote_footer,
  }
}

/**
 * The small print under the trade name, one line per fact, empty lines left
 * out: activity; legal name and tax id; address; phone, email and web.
 */
export function letterheadLines(letterhead: Letterhead): string[] {
  const legal = [letterhead.legalName, letterhead.taxId ? `NIF ${letterhead.taxId}` : null]
    .filter(Boolean)
    .join(' · ')

  const place = [letterhead.postalCode, letterhead.city].filter(Boolean).join(' ')
  const where = [
    letterhead.address,
    [place, letterhead.province && letterhead.province !== letterhead.city ? `(${letterhead.province})` : null]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const contact = [letterhead.phone, letterhead.email, letterhead.website].filter(Boolean).join(' · ')

  return [letterhead.tagline, legal, where, contact].filter((line): line is string => Boolean(line))
}
