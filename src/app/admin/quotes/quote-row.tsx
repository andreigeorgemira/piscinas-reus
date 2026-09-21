import Link from 'next/link'
import { formatEuros } from '@/lib/price-book/decimal'
import type { QuoteListRow } from '@/lib/quotes/queries'
import { StatusBadge } from './status-badge'

const CELL_CLASS = 'border-b border-line-soft px-3 py-2.5 align-middle'

/** A date as Spain writes it, short. */
function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = value.slice(0, 10).split('-')
  return `${date[2]}/${date[1]}/${date[0]}`
}

/**
 * One quote in the list.
 *
 * A server component, unlike the client and price-book rows: nothing in it is
 * interactive. Everything a quote can have done to it happens on its own screen,
 * where the lines are visible -- sending a quote from a list, without seeing what
 * is on it, is how the wrong figure reaches a client.
 */
export function QuoteRow({ quote }: { quote: QuoteListRow }) {
  return (
    <tr className="group/row relative transition-colors hover:bg-surface-hover">
      <td className={CELL_CLASS}>
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/admin/quotes/${quote.id}`}
            className="num w-fit font-medium outline-none group-hover/row:text-accent after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
          >
            {quote.reference}
          </Link>
          <span className="truncate text-xs text-muted" title={quote.title}>
            {quote.title}
          </span>
        </div>
      </td>
      <td className={CELL_CLASS}>
        <span className="block truncate" title={quote.clientName}>
          {quote.clientName}
        </span>
      </td>
      <td className={CELL_CLASS}>
        <StatusBadge status={quote.status} />
        {quote.projectReference ? (
          <span className="num block pt-0.5 text-2xs text-faint">{quote.projectReference}</span>
        ) : null}
      </td>
      <td className={`${CELL_CLASS} num text-muted`}>{formatDate(quote.createdAt)}</td>
      <td className={`${CELL_CLASS} num text-muted`}>{formatDate(quote.validUntil)}</td>
      <td className={`${CELL_CLASS} num text-right font-medium`}>
        {formatEuros(quote.totals.grandTotal)}
      </td>
      <td className={`${CELL_CLASS} num text-right text-faint`}>
        {formatEuros(quote.totals.margin)}
      </td>
    </tr>
  )
}
