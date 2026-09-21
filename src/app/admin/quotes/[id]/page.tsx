import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/app/admin/page-header'
import { StatusBadge } from '@/app/admin/quotes/status-badge'
import { DataTable, TableEmpty } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listClientOptions } from '@/lib/clients/queries'
import { listPriceBooks } from '@/lib/price-book/queries'
import { getQuote } from '@/lib/quotes/queries'
import { isEditable } from '@/lib/quotes/status'
import { ConceptSearch } from './concept-search'
import { QUOTE_LINE_COLUMNS } from './line-fields'
import { LineRow } from './line-row'
import { NewLineForm } from './new-line-form'
import { QuoteActions } from './quote-actions'
import { QuoteDetails } from './quote-details'
import { QuoteTotals } from './quote-totals'

export const metadata: Metadata = { title: 'Presupuesto' }

/**
 * The presupuestador: the screen the company will spend its day in.
 *
 * Shape: the lines fill the screen, and everything that is not a line lives in
 * a column on the right. The catalogue search is the table's own toolbar rather
 * than a separate panel, because adding a line and reading the lines are one
 * task -- the search is how this table is typed into.
 *
 * Nothing here decides who may read or write any of it. RLS does
 * (0003_rls_policies.sql), requireAdmin only turns a caller RLS would empty
 * into a redirect, and the freeze on a sent quote is a trigger
 * (0009_quote_immutability.sql). `editable` below only stops the screen from
 * offering controls whose save the database would refuse.
 */
export default async function QuoteEditorPage({ params }: PageProps<'/admin/quotes/[id]'>) {
  const { id } = await params

  const supabase = await requireAdmin()

  const quote = await getQuote(supabase, id)
  if (!quote) {
    notFound()
  }

  const editable = isEditable(quote.status)

  // Both lists are small and read on every open: the books for the search
  // selector, the clients for moving a quote to the right one. Together in one
  // round trip rather than one after the other.
  const [books, clients] = await Promise.all([
    listPriceBooks(supabase),
    listClientOptions(supabase),
  ])

  return (
    <>
      <PageHeader
        title={quote.reference}
        meta={
          <span className="flex items-center gap-2">
            <StatusBadge status={quote.status} />
            <span className="max-w-[28rem] truncate">{quote.title}</span>
            {quote.project ? (
              <span className="num text-faint">Proyecto {quote.project.reference}</span>
            ) : null}
          </span>
        }
      >
        <Link
          href="/admin/quotes"
          className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9.8 3.6 5.4 8l4.4 4.4" />
          </svg>
          Presupuestos
        </Link>
        <QuoteActions quote={quote} />
      </PageHeader>

      <div className="flex min-h-0 flex-1 gap-5 p-5">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DataTable
            columns={QUOTE_LINE_COLUMNS}
            toolbar={
              <ConceptSearch
                quoteId={quote.id}
                books={books.map((book) => ({ id: book.id, name: book.name }))}
                frozen={!editable}
              />
            }
            empty={
              quote.items.length === 0 ? (
                <TableEmpty
                  message={
                    editable
                      ? 'Este presupuesto todavía no tiene líneas. Busca un concepto arriba, o escribe una línea libre abajo.'
                      : 'Este presupuesto no tiene líneas.'
                  }
                  icon={
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3.4 2.6h9.2v10.8H3.4Z" />
                      <path d="M5.6 5.8h4.8M5.6 8h4.8M5.6 10.2h2.8" />
                    </svg>
                  }
                />
              ) : undefined
            }
            footer={editable ? <NewLineForm quoteId={quote.id} /> : undefined}
          >
            <tbody>
              {quote.items.map((line, index) => (
                <LineRow
                  key={line.id}
                  line={line}
                  quoteId={quote.id}
                  editable={editable}
                  isFirst={index === 0}
                  isLast={index === quote.items.length - 1}
                />
              ))}
            </tbody>
          </DataTable>
        </div>

        {/*
          The panel scrolls on its own, so a long set of notes never pushes the
          totals off a laptop screen. Named, because the sidebar is a
          complementary region too and "the aside" would otherwise be ambiguous
          to anything navigating by region -- a screen reader included.
        */}
        <aside
          aria-label="Resumen del presupuesto"
          className="flex w-[21rem] shrink-0 flex-col gap-4 overflow-y-auto"
        >
          <QuoteTotals totals={quote.totals} />
          <QuoteDetails quote={quote} clients={clients} editable={editable} />
        </aside>
      </div>
    </>
  )
}
