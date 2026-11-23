import { describe, expect, it } from 'vitest'
import { toQuotePreview } from './preview'
import type { QuoteDetail, QuoteItem } from './queries'

function line(overrides: Partial<QuoteItem> & { id: string }): QuoteItem {
  return {
    priceBookItemId: null,
    priceBookCode: null,
    groupName: 'Obra',
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
    createdAt: '2026-11-20T10:00:00Z',
    ...overrides,
  }
}

const quote = {
  id: 'q1',
  reference: 'Q-2026-0001',
  title: 'Baño completo',
  status: 'rejected',
  startDatePlanned: null,
  validUntil: '2026-12-31',
  clientNotes: null,
  internalNotes: 'interno',
  accessToken: 'token',
  sentAt: '2026-11-20T10:00:00Z',
  respondedAt: null,
  signedName: 'Firmó antes',
  signedAt: null,
  rejectionReason: 'Caro',
  vatRate: 21,
  groups: [{ name: 'Acabados', position: 1, display: 'no_prices' }],
  createdAt: '2026-11-19T10:00:00Z',
  client: { id: 'c1', fullName: 'Laura', email: 'l@x.es', phone: null, address: null, city: 'Reus', postalCode: null },
  project: null,
  items: [
    line({ id: 'a', groupName: 'Obra', position: 1, quantity: 2, unitPrice: 100 }),
    line({ id: 'b', groupName: 'Acabados', position: 2, unitPrice: 50 }),
    line({ id: 'c', groupName: 'Obra', position: 3, unitPrice: 25, discountPct: 10 }),
    line({ id: 'x', groupName: 'Obra', position: 4, unitPrice: 300, isRecommended: true, clientSelected: true }),
  ],
  totals: {
    baseTotal: 272.5,
    recommendedTotal: 300,
    selectedExtrasTotal: 300,
    grandTotal: 572.5,
    costTotal: 0,
    margin: 572.5,
    vatRate: 21,
    vatTotal: 120.23,
    totalWithVat: 692.73,
  },
} as unknown as QuoteDetail

describe('toQuotePreview', () => {
  it('lists the groups in the order the document prints them, with their subtotals', () => {
    const preview = toQuotePreview(quote)
    expect(preview.groups).toEqual([
      { name: 'Acabados', display: 'no_prices', lineCount: 1, subtotal: 50 },
      { name: 'Obra', display: 'detailed', lineCount: 2, subtotal: 222.5 },
    ])
  })

  it('keeps the extras apart, with what the client chose', () => {
    expect(toQuotePreview(quote).extras).toEqual([{ name: 'Línea', total: 300, selected: true }])
  })

  it('shows the answer that belongs to the status, and no other', () => {
    const preview = toQuotePreview(quote)
    expect(preview.rejectionReason).toBe('Caro')
    expect(preview.signedName).toBeNull()
  })

  it('carries the totals with VAT and never the internal notes', () => {
    const preview = toQuotePreview(quote)
    expect(preview.totals).toMatchObject({ grand: 572.5, vatRate: 21, withVat: 692.73 })
    expect(JSON.stringify(preview)).not.toContain('interno')
  })
})
