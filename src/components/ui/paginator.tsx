import Link from 'next/link'
import { PageSizeSelect } from './page-size-select'

export const PAGE_SIZES = [10, 25, 50]

const ARROW_CLASS =
  'flex size-7 items-center justify-center rounded-md border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const ARROW_DEAD_CLASS =
  'flex size-7 items-center justify-center rounded-md border border-transparent text-faint/50'

function Arrow({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'previous' ? <path d="M9.8 3.6 5.4 8l4.4 4.4" /> : <path d="M6.2 3.6 10.6 8l-4.4 4.4" />}
    </svg>
  )
}

/**
 * The pager every list screen uses: what is on screen, how many there are,
 * how many fit on a page, and the way to the next one.
 *
 * Links rather than buttons, because a page of a list is a place: it can be
 * opened in a new tab, bookmarked and sent to someone. The dead ends at the
 * first and last page are spans, not disabled links -- a disabled link is
 * not a thing HTML has.
 */
export function Paginator({
  page,
  pageCount,
  pageSize,
  shown,
  total,
  noun,
  pageHrefs,
  sizeHrefs,
}: {
  page: number
  pageCount: number
  pageSize: number
  shown: number
  total: number
  /** Plural noun for the count, e.g. 'conceptos'. */
  noun: string
  /** Addresses for the previous and next page; null at either end. */
  pageHrefs: { previous: string | null; next: string | null }
  /** Every page size on offer with the address that selects it. */
  sizeHrefs: { size: number; href: string }[]
}) {
  return (
    <nav
      aria-label={`Páginas de ${noun}`}
      className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-sunk px-3 py-2"
    >
      <span className="text-xs text-muted">
        Mostrando <span className="num">{shown}</span> de <span className="num">{total}</span>{' '}
        {noun}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <PageSizeSelect value={pageSize} options={sizeHrefs} />

        {pageCount > 1 ? (
          <div className="flex items-center gap-1">
            {pageHrefs.previous ? (
              <Link
                href={pageHrefs.previous}
                aria-label="Página anterior"
                className={ARROW_CLASS}
              >
                <Arrow direction="previous" />
              </Link>
            ) : (
              <span className={ARROW_DEAD_CLASS} aria-hidden="true">
                <Arrow direction="previous" />
              </span>
            )}

            {/* Plain text, not a bordered box: it reports the position, it
                is not somewhere to type one. */}
            <span className="num px-1.5 text-2xs text-muted">
              {page} / {pageCount}
            </span>

            {pageHrefs.next ? (
              <Link href={pageHrefs.next} aria-label="Página siguiente" className={ARROW_CLASS}>
                <Arrow direction="next" />
              </Link>
            ) : (
              <span className={ARROW_DEAD_CLASS} aria-hidden="true">
                <Arrow direction="next" />
              </span>
            )}
          </div>
        ) : null}
      </div>
    </nav>
  )
}
