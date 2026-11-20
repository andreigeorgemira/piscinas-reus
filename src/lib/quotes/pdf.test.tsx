// @vitest-environment node
import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import type { Letterhead } from '@/lib/settings/letterhead'
import { fromQuoteDetail, QuoteDocument, type QuoteDocumentData } from './pdf'
import type { QuoteDetail, QuoteItem } from './queries'

/**
 * The PDF is rendered by a route, so what is worth testing here is that the
 * document itself renders at all -- @react-pdf fails on an unsupported style or
 * a bad image by throwing, and a quote that cannot be printed is discovered by
 * a client otherwise -- and that the admin's adapter groups the lines the way
 * the document expects.
 *
 * Node environment, stated at the top: the renderer lays the page out with Node
 * APIs and does not run under jsdom.
 */

const company: Letterhead = {
  tradeName: 'Piscinas Reus',
  tagline: 'Construcción y mantenimiento de piscinas',
  legalName: 'Piscinas Reus S.L.',
  taxId: 'B43123456',
  address: 'Carrer Major 1',
  postalCode: '43201',
  city: 'Reus',
  province: 'Tarragona',
  phone: null,
  email: null,
  website: null,
  quoteFooter: 'Las cantidades pueden ajustarse tras el replanteo.',
}

const base: QuoteDocumentData = {
  reference: 'Q-2026-0100',
  title: 'Piscina 8x4 con gresite',
  company,
  issuedOn: '2026-09-22',
  validUntil: '2026-10-22',
  startDatePlanned: '2026-04-01',
  clientNotes: 'Pago en tres plazos.',
  client: {
    fullName: 'Familia Soler',
    address: 'Camí de la Pedrera 12',
    city: 'Reus',
    postalCode: '43201',
  },
  groups: [
    {
      name: 'Revestimiento',
      display: 'detailed',
      subtotal: 2405,
      items: [
        {
          name: 'Gresite 2,5x2,5',
          description: 'Incluye material',
          quantity: 74,
          unit: 'm2',
          unitPrice: 32.5,
          discountPct: 0,
          lineTotal: 2405,
        },
      ],
    },
  ],
  extras: [
    {
      name: 'Clorador salino',
      description: null,
      quantity: 1,
      unit: 'unit',
      unitPrice: 980,
      discountPct: 0,
      lineTotal: 980,
      selected: true,
    },
  ],
  baseTotal: 2405,
  selectedExtrasTotal: 980,
  grandTotal: 3385,
  vatRate: null,
  vatTotal: 0,
  totalWithVat: 3385,
  signature: null,
  draft: false,
}

describe('the printed quote', () => {
  it('renders to a PDF', async () => {
    const buffer = await renderToBuffer(<QuoteDocument quote={base} />)

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('renders a signed one, image included', async () => {
    // A 1×1 PNG: enough for the renderer to place an image, which is the part
    // that throws when the data URL is wrong.
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    const buffer = await renderToBuffer(
      <QuoteDocument
        quote={{
          ...base,
          signature: { name: 'Marta Soler', at: '2026-09-22T10:00:00Z', image: png },
        }}
      />,
    )

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('renders VAT, a discount and groups shown without prices', async () => {
    const buffer = await renderToBuffer(
      <QuoteDocument
        quote={{
          ...base,
          vatRate: 21,
          vatTotal: 710.85,
          totalWithVat: 4095.85,
          groups: [
            { ...base.groups[0]!, display: 'no_prices', items: [{ ...base.groups[0]!.items[0]!, unitPrice: null, discountPct: null, lineTotal: null }] },
            { name: 'Obra civil', display: 'total_only', subtotal: 9000, items: [] },
          ],
          extras: [{ ...base.extras[0]!, discountPct: 10, lineTotal: 882 }],
        }}
      />,
    )
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('renders a draft, and one with no client', async () => {
    const buffer = await renderToBuffer(
      <QuoteDocument quote={{ ...base, draft: true, client: null, extras: [] }} />,
    )

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

function line(overrides: Partial<QuoteItem> & { id: string }): QuoteItem {
  return {
    priceBookItemId: null,
    priceBookCode: null,
    groupName: 'Estructura',
    name: 'Línea',
    description: null,
    unit: 'unit',
    quantity: 1,
    unitCost: 0,
    unitPrice: 100,
    discountPct: 0,
    isRecommended: false,
    clientSelected: false,
    position: 1,
    createdAt: '2026-09-22T10:00:00Z',
    ...overrides,
  }
}

describe('the office adapter', () => {
  const quote = {
    id: 'q1',
    reference: 'Q-2026-0101',
    title: 'Con dos grupos',
    status: 'draft',
    startDatePlanned: null,
    validUntil: null,
    clientNotes: null,
    internalNotes: 'No sale de aquí',
    accessToken: 'token',
    sentAt: null,
    respondedAt: null,
    signedName: null,
    signedAt: null,
    rejectionReason: null,
    vatRate: null,
    groups: [],
    createdAt: '2026-09-22T09:00:00Z',
    client: null,
    project: null,
    items: [
      line({ id: 'a', groupName: 'Estructura', position: 1, quantity: 2, unitPrice: 100 }),
      line({ id: 'b', groupName: 'Revestimiento', position: 2, quantity: 1, unitPrice: 50 }),
      line({ id: 'c', groupName: 'Estructura', position: 3, quantity: 1, unitPrice: 25 }),
      line({ id: 'x', groupName: 'Depuración', position: 4, unitPrice: 980, isRecommended: true }),
    ],
    totals: {
      baseTotal: 275,
      recommendedTotal: 980,
      selectedExtrasTotal: 0,
      grandTotal: 275,
      costTotal: 0,
      margin: 275,
    },
  } as unknown as QuoteDetail

  it('keeps the lines in their groups and in position order', () => {
    const document = fromQuoteDetail(quote, company)

    expect(document.groups.map((group) => group.name)).toEqual(['Estructura', 'Revestimiento'])
    // A group that comes back later keeps its lines together rather than
    // starting a second section of the same name.
    expect(document.groups[0]!.items.map((item) => item.lineTotal)).toEqual([200, 25])
    expect(document.groups[0]!.subtotal).toBe(225)
  })

  it('takes the optional extras out of the groups', () => {
    const document = fromQuoteDetail(quote, company)

    expect(document.extras).toHaveLength(1)
    expect(document.groups.some((group) => group.name === 'Depuración')).toBe(false)
  })

  it('bands a draft and never carries the internal notes', () => {
    const document = fromQuoteDetail(quote, company)

    expect(document.draft).toBe(true)
    expect(JSON.stringify(document)).not.toContain('No sale de aquí')
  })

  it('applies a discount the way the database does', () => {
    const discounted = {
      ...quote,
      items: [line({ id: 'd', quantity: 10, unitPrice: 100, discountPct: 10 })],
    } as unknown as QuoteDetail

    expect(fromQuoteDetail(discounted, company).groups[0]!.items[0]!.lineTotal).toBe(900)
  })

  it('hides the prices of a group the way the client is shown it', () => {
    const presented = {
      ...quote,
      groups: [{ name: 'Estructura', position: 1, display: 'no_prices' }],
    } as unknown as QuoteDetail

    const estructura = fromQuoteDetail(presented, company).groups[0]!
    expect(estructura.display).toBe('no_prices')
    expect(estructura.subtotal).toBe(225)
    expect(estructura.items.every((item) => item.unitPrice === null && item.lineTotal === null)).toBe(true)
  })

  it('signs only an accepted quote', () => {
    const signedButReopened = { ...quote, status: 'sent', signedName: 'Marta Soler' } as unknown as QuoteDetail
    expect(fromQuoteDetail(signedButReopened, company).signature).toBeNull()

    const accepted = { ...quote, status: 'accepted', signedName: 'Marta Soler', signedAt: '2026-09-22T10:00:00Z' } as unknown as QuoteDetail
    expect(fromQuoteDetail(accepted, company).signature).toEqual({
      name: 'Marta Soler',
      at: '2026-09-22T10:00:00Z',
      image: null,
    })
  })
})
