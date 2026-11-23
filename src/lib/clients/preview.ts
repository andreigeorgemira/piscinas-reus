import type { QuoteStatus } from '@/lib/quotes/status'
import type { Client } from './queries'

/** A client at a glance: the card's dialog, before opening the full page. */
export type ClientPreview = {
  client: Client
  quotes: {
    id: string
    reference: string
    title: string
    status: QuoteStatus
    /** Before VAT, the figure the list and the margin use. */
    total: number
    createdAt: string
  }[]
  /** All of the client's quotes, not only the ones listed. */
  quoteCount: number
  /** What the client has accepted, before VAT. */
  acceptedTotal: number
}
