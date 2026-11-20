import { describe, expect, it } from 'vitest'
import { letterheadLines, type Letterhead } from './letterhead'
import { companySettingsSchema, firstIssue } from './schema'

const base = {
  tradeName: 'Piscinas Reus',
  tagline: '',
  legalName: '',
  taxId: '',
  address: '',
  postalCode: '',
  city: '',
  province: '',
  phone: '',
  email: '',
  website: '',
  defaultVatRate: '21',
  quoteFooter: '',
}

describe('companySettingsSchema', () => {
  it('turns blank boxes into nulls and reads the VAT default', () => {
    const parsed = companySettingsSchema.parse(base)
    expect(parsed).toMatchObject({ tradeName: 'Piscinas Reus', legalName: null, taxId: null, defaultVatRate: 21 })
  })

  it('normalises a tax id typed with spaces, dots and dashes', () => {
    expect(companySettingsSchema.parse({ ...base, taxId: 'b-43.123 456' }).taxId).toBe('B43123456')
    expect(companySettingsSchema.parse({ ...base, taxId: 'es b43123456' }).taxId).toBe('ESB43123456')
  })

  it('refuses a tax id that is not nine characters', () => {
    const result = companySettingsSchema.safeParse({ ...base, taxId: 'B4312' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstIssue(result.error)).toBe('El NIF/CIF debe tener nueve letras y cifras.')
  })

  it('requires a trade name and accepts "no VAT" as the default', () => {
    expect(companySettingsSchema.safeParse({ ...base, tradeName: '  ' }).success).toBe(false)
    expect(companySettingsSchema.parse({ ...base, defaultVatRate: 'none' }).defaultVatRate).toBeNull()
  })

  it('checks the postal code and the email only when they are filled in', () => {
    expect(companySettingsSchema.safeParse({ ...base, postalCode: '4320' }).success).toBe(false)
    expect(companySettingsSchema.safeParse({ ...base, email: 'no-es-un-correo' }).success).toBe(false)
    expect(companySettingsSchema.parse({ ...base, postalCode: '43201', email: 'hola@piscinas.test' })).toMatchObject({
      postalCode: '43201',
      email: 'hola@piscinas.test',
    })
  })
})

describe('letterheadLines', () => {
  const full: Letterhead = {
    tradeName: 'Piscinas Reus',
    tagline: 'Construcción y mantenimiento de piscinas',
    legalName: 'Piscinas Reus S.L.',
    taxId: 'B43123456',
    address: 'Carrer Major 1',
    postalCode: '43201',
    city: 'Reus',
    province: 'Tarragona',
    phone: '977 000 000',
    email: 'hola@piscinas.test',
    website: null,
    quoteFooter: null,
  }

  it('prints one line per fact', () => {
    expect(letterheadLines(full)).toEqual([
      'Construcción y mantenimiento de piscinas',
      'Piscinas Reus S.L. · NIF B43123456',
      'Carrer Major 1, 43201 Reus (Tarragona)',
      '977 000 000 · hola@piscinas.test',
    ])
  })

  it('leaves out what is not filled in', () => {
    expect(
      letterheadLines({ ...full, legalName: null, taxId: null, address: null, postalCode: null, phone: null, email: null }),
    ).toEqual(['Construcción y mantenimiento de piscinas', 'Reus (Tarragona)'])
  })
})
