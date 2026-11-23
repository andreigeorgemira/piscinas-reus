import { roundMoney } from '@/lib/money'
import { documentSections, presentationOrder, UNGROUPED_LABEL, type GroupDisplay } from './presentation'
import type { QuoteDetail } from './queries'
import type { QuoteStatus } from './status'
import { lineTotal } from './totals'

/**
 * A quote at a glance: what the preview dialog on the list shows before
 * anybody opens the editor. Plain data, so it can travel from a Server Action
 * to the browser.
 */
export type QuotePreview = {
  id: string
  reference: string
  title: string
  status: QuoteStatus
  client: { id: string; fullName: string; email: string; phone: string | null; city: string | null } | null
  createdAt: string
  sentAt: string | null
  validUntil: string | null
  startDatePlanned: string | null
  projectReference: string | null
  signedName: string | null
  rejectionReason: string | null
  /** The document's groups, in the order it prints them. */
  groups: { name: string; display: GroupDisplay; lineCount: number; subtotal: number }[]
  extras: { name: string; total: number; selected: boolean }[]
  totals: {
    base: number
    selectedExtras: number
    grand: number
    vatRate: number | null
    vat: number
    withVat: number
    cost: number
    margin: number
  }
  lineCount: number
}

export function toQuotePreview(quote: QuoteDetail): QuotePreview {
  const ordered = presentationOrder(
    [...quote.items].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)),
    quote.groups,
  )

  return {
    id: quote.id,
    reference: quote.reference,
    title: quote.title,
    status: quote.status,
    client: quote.client
      ? {
          id: quote.client.id,
          fullName: quote.client.fullName,
          email: quote.client.email,
          phone: quote.client.phone,
          city: quote.client.city,
        }
      : null,
    createdAt: quote.createdAt,
    sentAt: quote.sentAt,
    validUntil: quote.validUntil,
    startDatePlanned: quote.startDatePlanned,
    projectReference: quote.project?.reference ?? null,
    signedName: quote.status === 'accepted' ? quote.signedName : null,
    rejectionReason: quote.status === 'rejected' ? quote.rejectionReason : null,
    groups: documentSections(ordered, quote.groups).map((section) => ({
      name: section.groupName ?? UNGROUPED_LABEL,
      display: section.display,
      lineCount: section.lines.length,
      subtotal: roundMoney(section.lines.reduce((sum, line) => sum + lineTotal(line), 0)),
    })),
    extras: ordered
      .filter((item) => item.isRecommended)
      .map((item) => ({ name: item.name, total: lineTotal(item), selected: item.clientSelected })),
    totals: {
      base: quote.totals.baseTotal,
      selectedExtras: quote.totals.selectedExtrasTotal,
      grand: quote.totals.grandTotal,
      vatRate: quote.totals.vatRate,
      vat: quote.totals.vatTotal,
      withVat: quote.totals.totalWithVat,
      cost: quote.totals.costTotal,
      margin: quote.totals.margin,
    },
    lineCount: quote.items.length,
  }
}
