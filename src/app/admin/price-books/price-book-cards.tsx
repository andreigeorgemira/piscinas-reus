import Link from 'next/link'
import { plural } from '@/lib/plural'
import type { PriceBook } from '@/lib/price-book/queries'

/**
 * The price books as cards. A book is opened to be worked on, so the whole card
 * is the way in; renaming and deleting stay in the table view, where each row
 * carries its own controls.
 */
export function PriceBookCards({ books }: { books: PriceBook[] }) {
  return (
    <>
      {books.map((book) => (
        <li key={book.id}>
          <Link
            href={`/admin/price-books/${book.id}`}
            className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-faint/70 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.4 1.9H3.1a1.2 1.2 0 0 0-1.2 1.2v5.3c0 .3.1.6.4.8l5.6 5.6a1.2 1.2 0 0 0 1.7 0l4.5-4.5a1.2 1.2 0 0 0 0-1.7L8.5 3a1.2 1.2 0 0 0-.1-1.1Z" />
                  <circle cx="5.2" cy="5.2" r="1" />
                </svg>
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="truncate text-sm font-semibold text-ink">{book.name}</h3>
                <p className="line-clamp-2 text-xs text-muted">{book.description ?? 'Sin descripción'}</p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-3 text-xs">
              <span className="text-ink-soft">
                {plural(book.groupCount, 'grupo', 'grupos')} · {plural(book.itemCount, 'concepto', 'conceptos')}
              </span>
              <span aria-hidden="true" className="flex items-center gap-1 font-medium text-accent">
                Abrir
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3.6 10.4 8 6 12.4" />
                </svg>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </>
  )
}
