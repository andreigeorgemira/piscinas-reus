import { describe, expect, it } from 'vitest'
import { buildQuoteEmail } from './quote-email'

const base = {
  reference: 'Q-2026-0004',
  title: 'Piscina 8x4 con gresite',
  clientName: 'Familia Soler',
  total: 12450.5,
  vatRate: null,
  validUntil: '2026-10-21',
  url: 'https://piscinasreus.example/q/abc123',
  company: {
    tradeName: 'Piscinas Reus',
    tagline: 'Construcción y mantenimiento de piscinas',
    legalName: null,
    taxId: null,
    address: null,
    postalCode: null,
    city: 'Reus',
    province: 'Tarragona',
    phone: null,
    email: null,
    website: null,
    quoteFooter: null,
  },
} as const

describe('the email that carries a quote', () => {
  it('names the quote in the subject, so a reply thread is about one document', () => {
    expect(buildQuoteEmail(base).subject).toBe('Presupuesto Q-2026-0004 · Piscina 8x4 con gresite')
  })

  it('puts the link and the total in both parts', () => {
    const email = buildQuoteEmail(base)

    for (const part of [email.html, email.text]) {
      expect(part).toContain('https://piscinasreus.example/q/abc123')
      expect(part).toContain('12.450,50')
    }
  })

  it('says until when it stands, when there is a date', () => {
    expect(buildQuoteEmail(base).text).toContain('válido hasta el 21/10/2026')

    const undated = buildQuoteEmail({ ...base, validUntil: null })
    expect(undated.text).not.toContain('válido hasta')
  })

  it('carries the office own message when there is one', () => {
    const email = buildQuoteEmail({ ...base, message: 'Te llamo el martes para concretar.' })

    expect(email.text).toContain('Te llamo el martes')
    expect(email.html).toContain('Te llamo el martes')
  })

  it('escapes what the office and the client typed', () => {
    // A client called "Soler & <hijos>" must not close a tag in the HTML part.
    const email = buildQuoteEmail({
      ...base,
      clientName: 'Soler & <hijos>',
      message: '<script>alert(1)</script>',
    })

    expect(email.html).toContain('Soler &amp; &lt;hijos&gt;')
    expect(email.html).not.toContain('<script>')
  })

  it('says whether VAT is in the total', () => {
    expect(buildQuoteEmail(base).text).toContain('(IVA no incluido)')
    const withVat = buildQuoteEmail({ ...base, vatRate: 21, total: 15065.11 })
    expect(withVat.text).toContain('15.065,11')
    expect(withVat.text).toContain('IVA 21\u00a0% incluido')
  })

  it('signs with the company name from the settings, escaped', () => {
    const email = buildQuoteEmail({ ...base, company: { ...base.company, tradeName: 'Piscinas <Reus>' } })
    expect(email.html).toContain('Piscinas &lt;Reus&gt;')
    expect(email.text).toContain('Piscinas <Reus> · Reus')
  })
})
