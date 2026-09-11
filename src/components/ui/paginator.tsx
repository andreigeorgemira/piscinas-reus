import Link from 'next/link'
import { PageSizeSelect } from './page-size-select'

export const PAGE_SIZES = [10, 25, 50]

const LINK_CLASS =
  'flex h-7 items-center rounded-md border border-line bg-surface px-2.5 text-xs text-ink-soft transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const DEAD_CLASS = 'flex h-7 items-center rounded-md border border-line px-2.5 text-xs text-faint'

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
          <div className="flex items-center gap-1.5">
            {pageHrefs.previous ? (
              <Link href={pageHrefs.previous} className={LINK_CLASS}>
                Anterior
              </Link>
            ) : (
              <span className={DEAD_CLASS}>Anterior</span>
            )}
            <span className="num flex h-7 items-center rounded-md border border-line bg-surface px-2.5 text-xs text-ink-soft">
              {page} / {pageCount}
            </span>
            {pageHrefs.next ? (
              <Link href={pageHrefs.next} className={LINK_CLASS}>
                Siguiente
              </Link>
            ) : (
              <span className={DEAD_CLASS}>Siguiente</span>
            )}
          </div>
        ) : null}
      </div>
    </nav>
  )
}
