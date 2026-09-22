import { describe, expect, it } from 'vitest'
import {
  quoteInputFromForm,
  quoteInputSchema,
  quoteItemInputFromForm,
  quoteItemInputSchema,
  quoteItemInputToRow,
} from './schema'

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.append(name, value)
  return data
}

const CLIENT_ID = '3f1c9b2e-0a44-4c8d-8f2b-6f0d7a5e1b90'

const validQuote = {
  client_id: CLIENT_ID,
  title: 'Piscina 8x4 con gresite',
  start_date_planned: '2026-04-01',
  valid_until: '2026-03-15',
  client_notes: 'Pago en tres plazos.',
  internal_notes: 'Ojo con el acceso de la máquina.',
}

const validLine = {
  name: 'Gresite azul',
  description: 'Colocado con junta fina',
  unit: 'm2',
  quantity: '12,125',
  unit_cost: '18,40',
  unit_price: '32,50',
  discount_pct: '5',
}

describe('the quote form', () => {
  it('reads a filled-in form', () => {
    const parsed = quoteInputSchema.safeParse(quoteInputFromForm(form(validQuote)))

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toEqual({
      clientId: CLIENT_ID,
      title: 'Piscina 8x4 con gresite',
      startDatePlanned: '2026-04-01',
      validUntil: '2026-03-15',
      clientNotes: 'Pago en tres plazos.',
      internalNotes: 'Ojo con el acceso de la máquina.',
    })
  })

  it('takes a quote with no dates and no notes', () => {
    const parsed = quoteInputSchema.safeParse(
      quoteInputFromForm(form({ client_id: CLIENT_ID, title: 'Sin fechas' })),
    )

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toMatchObject({
      startDatePlanned: null,
      validUntil: null,
      clientNotes: null,
      internalNotes: null,
    })
  })

  it('takes a quote with no client at all', () => {
    // A price is quoted over the phone before anybody has taken a name down
    // (0014_quote_without_client.sql). The empty select posts '', which has to
    // become null rather than a validation error.
    const parsed = quoteInputSchema.safeParse(
      quoteInputFromForm(form({ client_id: '', title: 'Llamada de la mañana' })),
    )

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.clientId).toBeNull()
  })

  it('refuses a client that is not a uuid', () => {
    const parsed = quoteInputSchema.safeParse(
      quoteInputFromForm(form({ ...validQuote, client_id: 'soler' })),
    )

    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error.issues[0]?.message).toBe('El cliente no es válido.')
  })

  it('refuses a date that is not a date', () => {
    const parsed = quoteInputSchema.safeParse(
      quoteInputFromForm(form({ ...validQuote, valid_until: '15/03/2026' })),
    )

    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error.issues[0]?.message).toContain('no es una fecha válida')
  })
})

describe('a quote line', () => {
  it('reads what the row posts, Spanish decimals included', () => {
    const parsed = quoteItemInputSchema.safeParse(quoteItemInputFromForm(form(validLine)))

    expect(parsed.success).toBe(true)
    expect(parsed.success && quoteItemInputToRow(parsed.data)).toEqual({
      name: 'Gresite azul',
      description: 'Colocado con junta fina',
      unit: 'm2',
      quantity: 12.125,
      unit_cost: 18.4,
      unit_price: 32.5,
      discount_pct: 5,
      is_recommended: false,
    })
  })

  it('reads the recommended tick, and its absence', () => {
    const on = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(form({ ...validLine, is_recommended: 'on' })),
    )
    expect(on.success && on.data.isRecommended).toBe(true)

    const off = quoteItemInputSchema.safeParse(quoteItemInputFromForm(form(validLine)))
    expect(off.success && off.data.isRecommended).toBe(false)
  })

  it('allows three decimals in a quantity and refuses a fourth', () => {
    const three = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(form({ ...validLine, quantity: '12,125' })),
    )
    expect(three.success).toBe(true)

    const four = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(form({ ...validLine, quantity: '12,1255' })),
    )
    expect(four.success).toBe(false)
    expect(!four.success && four.error.issues[0]?.message).toBe(
      'La cantidad no puede tener más de tres decimales.',
    )
  })

  it('refuses a third decimal in a price, the way the price book does', () => {
    const parsed = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(form({ ...validLine, unit_price: '32,555' })),
    )

    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error.issues[0]?.message).toBe(
      'El precio no puede tener más de dos decimales.',
    )
  })

  it('accepts a quantity of zero, for a line not measured yet', () => {
    const parsed = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(form({ ...validLine, quantity: '0' })),
    )

    expect(parsed.success).toBe(true)
  })

  it('refuses a negative quantity and a discount over 100', () => {
    const negative = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(form({ ...validLine, quantity: '-1' })),
    )
    expect(negative.success).toBe(false)
    expect(!negative.success && negative.error.issues[0]?.message).toBe(
      'La cantidad no puede ser negativa.',
    )

    const tooMuch = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(form({ ...validLine, discount_pct: '120' })),
    )
    expect(tooMuch.success).toBe(false)
    expect(!tooMuch.success && tooMuch.error.issues[0]?.message).toBe(
      'El descuento no puede pasar del 100%.',
    )
  })
})

describe('a line with boxes left empty', () => {
  it('reads a blank cost, price and discount as zero', () => {
    // The free-line form at the foot of the editor posts an empty cost every
    // time somebody writes a one-off during a phone call, and a line at no
    // charge is a real thing to quote.
    const parsed = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(
        form({ name: 'Incluido', unit: 'unit', quantity: '1', unit_cost: '', unit_price: '', discount_pct: '' }),
      ),
    )

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toMatchObject({
      unitCost: 0,
      unitPrice: 0,
      discountPct: 0,
    })
  })

  it('still refuses a figure that is typed wrong rather than left out', () => {
    const parsed = quoteItemInputSchema.safeParse(
      quoteItemInputFromForm(form({ ...validLine, unit_price: 'ochenta' })),
    )

    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error.issues[0]?.message).toBe(
      'El precio no es un número válido.',
    )
  })
})
