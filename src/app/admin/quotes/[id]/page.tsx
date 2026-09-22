import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/app/admin/page-header'
import { StatusBadge } from '@/app/admin/quotes/status-badge'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listClientOptions } from '@/lib/clients/queries'
import { getBookCatalogue, listPriceBooks } from '@/lib/price-book/queries'
import { buildBoard } from '@/lib/quotes/board'
import { getQuote } from '@/lib/quotes/queries'
import { isEditable } from '@/lib/quotes/status'
import { GroupCard } from './group-card'
import { QuoteActions } from './quote-actions'
import { QuoteDetailsButton } from './quote-details'
import { QuoteTotalsBar } from './quote-totals'

export const metadata: Metadata = { title: 'Presupuesto' }

/**
 * How many concepts a book may hold before its groups arrive folded.
 *
 * Same threshold and same reasoning as the price book's own screen: past this,
 * mounting every row costs more than it gives, and a folded group is a one-line
 * summary of itself. Groups the quote already uses open regardless -- they are
 * the quote.
 */
const FOLD_ABOVE = 300

/** Reads a query value that may legally arrive repeated (`?q=a&q=b`). */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/**
 * The presupuestador: one table that is the price book and the quote at once.
 *
 * Chosen from the mockups on 2026-09-21 over a search-and-add editor: staff did
 * not want to look a concept up and then find it again on a second list. So the
 * catalogue is the screen, a ticked concept is a line, and the quantity is typed
 * in the row that offered it. src/lib/quotes/board.ts holds the model and the
 * three things that make it survive a real quote (a concept twice, lines the
 * book cannot explain, and the catalogue's order as the document's order).
 *
 * Nothing here decides who may read or write any of it: RLS does
 * (0003_rls_policies.sql), requireAdmin only turns a caller RLS would empty into
 * a redirect, and the freeze on a sent quote is a trigger
 * (0009_quote_immutability.sql). `editable` below only stops the screen from
 * offering controls whose save the database would refuse.
 */
export default async function QuoteEditorPage({
  params,
  searchParams,
}: PageProps<'/admin/quotes/[id]'>) {
  const { id } = await params
  const search = await searchParams

  const supabase = await requireAdmin()

  const quote = await getQuote(supabase, id)
  if (!quote) {
    notFound()
  }

  const editable = isEditable(quote.status)

  const [books, clients] = await Promise.all([listPriceBooks(supabase), listClientOptions(supabase)])

  const requestedBook = firstValue(search.book)
  const book = books.find((candidate) => candidate.id === requestedBook) ?? books[0] ?? null

  const query = {
    book: book?.id ?? '',
    q: firstValue(search.q).trim(),
    chosen: firstValue(search.chosen) === '1',
  }

  const base = `/admin/quotes/${id}`

  /** This screen's address with part of the query changed. Defaults stay out. */
  function href(changes: Partial<typeof query> = {}): string {
    const next = { ...query, ...changes }
    const params = new URLSearchParams()
    // The book rides in the URL even when it is the first one: the address of a
    // quote being written from the maintenance book is worth sending to someone.
    if (next.book && next.book !== books[0]?.id) params.set('book', next.book)
    if (next.q) params.set('q', next.q)
    if (next.chosen) params.set('chosen', '1')
    const queryString = params.toString()
    return queryString ? `${base}?${queryString}` : base
  }

  const catalogue = book
    ? await getBookCatalogue(supabase, book.id)
    : { groups: [], conceptCount: 0, capped: false }

  const board = buildBoard({ groups: catalogue.groups }, quote.items, {
    search: query.q,
    onlyChosen: query.chosen,
  })

  const filtering = query.q !== '' || query.chosen

  return (
    <>
      <PageHeader
        title={quote.reference}
        meta={
          <span className="flex items-center gap-2">
            <StatusBadge status={quote.status} />
            <span className="max-w-[22rem] truncate text-ink-soft">{quote.title}</span>
            {quote.client ? (
              <Link
                href={`/admin/clients/${quote.client.id}`}
                className="truncate text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {quote.client.fullName}
              </Link>
            ) : (
              /* Said out loud rather than left blank: this quote can be written
                 and sent, and only acceptance will ask for a name. */
              <span className="text-faint italic">Sin cliente</span>
            )}
            {quote.validUntil ? (
              <span className="num text-faint">{`válido hasta ${quote.validUntil.split('-').reverse().join('/')}`}</span>
            ) : null}
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
        <QuoteDetailsButton quote={quote} clients={clients} editable={editable} />
        <QuoteActions quote={quote} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-6 py-2.5">
        {/* A GET form, so the filter is in the address: linkable, and working
            before any JavaScript has loaded. */}
        <form action={base} className="flex items-center gap-2">
          {query.book && query.book !== books[0]?.id ? (
            <input type="hidden" name="book" value={query.book} />
          ) : null}
          {query.chosen ? <input type="hidden" name="chosen" value="1" /> : null}
          <div className="flex h-9 w-80 items-center gap-2 rounded-lg border border-line bg-canvas px-3 focus-within:border-accent focus-within:bg-surface focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="shrink-0 text-faint"
              aria-hidden="true"
            >
              <circle cx="7.2" cy="7.2" r="4.4" />
              <path d="m10.6 10.6 2.8 2.8" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={query.q}
              aria-label="Filtrar el tarifario y las líneas"
              placeholder="Filtrar por concepto o código"
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <button type="submit" className="sr-only">
            Filtrar
          </button>
        </form>

        <div className="flex overflow-hidden rounded-lg border border-line">
          <Link
            href={href({ chosen: false })}
            aria-current={query.chosen ? undefined : 'true'}
            className={`flex h-9 items-center px-3 text-xs transition-colors ${
              query.chosen
                ? 'bg-surface text-muted hover:bg-surface-hover'
                : 'bg-ink font-medium text-canvas'
            }`}
          >
            Todo el tarifario
          </Link>
          <Link
            href={href({ chosen: true })}
            aria-current={query.chosen ? 'true' : undefined}
            className={`flex h-9 items-center px-3 text-xs transition-colors ${
              query.chosen
                ? 'bg-ink font-medium text-canvas'
                : 'bg-surface text-muted hover:bg-surface-hover'
            }`}
          >
            Solo el presupuesto
          </Link>
        </div>

        {/*
          One link per book, not a select: the editor is server-rendered and a
          book is a place -- an address worth sending to someone. With one book
          there is nothing to choose, so nothing is shown.
        */}
        {books.length > 1 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-medium tracking-[0.05em] text-faint uppercase">
              Tarifario
            </span>
            {books.map((candidate) => (
              <Link
                key={candidate.id}
                href={href({ book: candidate.id })}
                aria-current={candidate.id === book?.id ? 'true' : undefined}
                className={`flex h-9 items-center rounded-lg border px-3 text-xs transition-colors ${
                  candidate.id === book?.id
                    ? 'border-accent/40 bg-accent-soft font-medium text-accent'
                    : 'border-line bg-surface text-muted hover:bg-surface-hover'
                }`}
              >
                {candidate.name}
              </Link>
            ))}
          </div>
        ) : null}

        <span className="num ml-auto text-xs text-muted">
          {`${board.lineCount} ${board.lineCount === 1 ? 'línea' : 'líneas'} en ${board.sectionsWithLines} ${board.sectionsWithLines === 1 ? 'grupo' : 'grupos'}`}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {catalogue.capped ? (
          <p className="mb-3 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
            Este tarifario tiene {catalogue.conceptCount} conceptos y la pantalla muestra los
            primeros 1000. Filtra para llegar al resto; las líneas que ya tiene el presupuesto se
            siguen viendo todas.
          </p>
        ) : null}

        {board.sections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface px-5 py-16 text-center">
            <span className="text-faint">
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
            </span>
            <p className="text-sm text-muted">
              {books.length === 0
                ? 'No hay ningún tarifario todavía.'
                : filtering
                  ? 'Nada coincide con el filtro.'
                  : 'Este tarifario está vacío.'}
            </p>
            {books.length === 0 ? (
              <Link href="/admin/price-books" className="text-xs text-accent underline">
                Crear el primer tarifario
              </Link>
            ) : filtering ? (
              <Link href={href({ q: '', chosen: false })} className="text-xs text-accent underline">
                Ver el tarifario entero
              </Link>
            ) : (
              <Link
                href={`/admin/price-books/${book?.id ?? ''}`}
                className="text-xs text-accent underline"
              >
                Añadir conceptos a {book?.name}
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {board.sections.map((section) => (
              <GroupCard
                key={section.key}
                quoteId={quote.id}
                section={section}
                editable={editable}
                startOpen={filtering || section.lineCount > 0 || board.conceptCount <= FOLD_ABOVE}
              />
            ))}
          </div>
        )}
      </div>

      <QuoteTotalsBar totals={quote.totals} />
    </>
  )
}
