import { roundMoney } from '@/lib/money'

/**
 * What one line comes to.
 *
 * This is public.quote_item_total (supabase/migrations/0005_quote_totals.sql)
 * written again in TypeScript, and the duplication is deliberate and narrow:
 * the database is the authority for every total anyone is charged (the
 * quote_totals view, the PDF, the client's screen), while a table of lines has
 * to print a figure per row as it renders, before any of those aggregates come
 * back. Asking the server for one number per row would be a query per row.
 *
 * The arithmetic must match exactly, including WHERE the rounding happens:
 * per line, before anything is summed -- the way a person adds up an invoice
 * on paper. Rounding the sum instead differs by a cent often enough to be
 * noticed, and a screen that disagrees with the PDF by a cent is a screen
 * nobody trusts again.
 */
export function lineTotal(line: {
  quantity: number
  unitPrice: number
  discountPct: number
}): number {
  return roundMoney(line.quantity * line.unitPrice * (1 - line.discountPct / 100))
}

/** What a line costs the company: quantity times cost, admin-only. */
export function lineCost(line: { quantity: number; unitCost: number }): number {
  return roundMoney(line.quantity * line.unitCost)
}
