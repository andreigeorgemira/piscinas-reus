import Link from 'next/link'
import { formatEuros } from '@/lib/price-book/decimal'
import type { QuoteListRow } from '@/lib/quotes/queries'
import { publicQuoteUrl } from '@/lib/quotes/public'
import { QuoteMenu } from './quote-menu'
import { QuoteStatusControl, type QuoteRowSummary } from './row-actions'

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
 * The row is a place you can act from, not only a link to somewhere you can act:
 * the status is changed here (the badge is the control), and the two things worth
 * doing without opening the quote -- copying it, binning it -- live in the last
 * cell. Writing the quote is still the editor's job; deciding what happened to a
 * document you already wrote is this screen's.
 */
export function QuoteRow({ quote }: { quote: QuoteListRow }) {
  const summary: QuoteRowSummary = {
    id: quote.id,
    reference: quote.reference,
    title: quote.title,
    status: quote.status,
    clientName: quote.clientName,
    lineCount: quote.lineCount,
    projectReference: quote.projectReference,
    grandTotal: quote.totals.grandTotal,
  }

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
        {quote.clientName ? (
          <span className="block truncate" title={quote.clientName}>
            {quote.clientName}
          </span>
        ) : (
          /* A quote written before anybody took a name down. Said out loud, so
             the empty cell is not read as a name the screen lost. */
          <span className="text-xs text-faint italic">Sin cliente</span>
        )}
      </td>
      <td className={CELL_CLASS}>
        <QuoteStatusControl quote={summary} />
        {quote.projectReference ? (
          <span className="num block pt-0.5 text-2xs text-faint">{quote.projectReference}</span>
        ) : null}
      </td>
      <td className={`${CELL_CLASS} num text-right ${quote.lineCount === 0 ? 'text-faint' : 'text-muted'}`}>
        {quote.lineCount}
      </td>
      <td className={`${CELL_CLASS} num text-muted`}>{formatDate(quote.createdAt)}</td>
      <td className={`${CELL_CLASS} num text-muted`}>{formatDate(quote.validUntil)}</td>
      <td className={`${CELL_CLASS} num text-right font-medium`}>
        {formatEuros(quote.totals.grandTotal)}
      </td>
      <td className={`${CELL_CLASS} num text-right text-faint`}>
        {formatEuros(quote.totals.margin)}
      </td>
      <td className={CELL_CLASS}>
        {/* relative z-10: the row is one stretched link, and the menu has to
            keep its own clicks. */}
        <div className="relative z-10 flex justify-end opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
          <QuoteMenu
            quote={{
              id: quote.id,
              reference: quote.reference,
              title: quote.title,
              status: quote.status,
              clientName: quote.clientName,
              clientEmail: quote.clientEmail,
              publicUrl: publicQuoteUrl(quote.accessToken),
              lineCount: quote.lineCount,
              projectReference: quote.projectReference,
            }}
          />
        </div>
      </td>
    </tr>
  )
}
