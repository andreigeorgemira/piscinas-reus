'use client'

import { useRouter } from 'next/navigation'
import { useId, useTransition } from 'react'

/** A price book the editor can be pointed at, with the address that does it. */
export type BookOption = { id: string; name: string; href: string }

/**
 * Which price book the editor is ticking through.
 *
 * A select rather than one button per book. Two books fit as a row of tabs and
 * a hundred do not, and a catalogue per trade is exactly the kind of list that
 * grows: maintenance, new builds, a supplier's, last year's. A select is the
 * same control at two books and at a hundred.
 *
 * It navigates rather than filtering in place, because each book is an address:
 * the editor is server-rendered and the book rides in the query string, so the
 * screen somebody is looking at can be sent to somebody else.
 */
export function BookSelect({ books, value }: { books: BookOption[]; value: string }) {
  const id = useId()
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <span className="sr-only">Tarifario</span>
      <select
        id={id}
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = books.find((book) => book.id === event.target.value)
          if (next) start(() => router.push(next.href))
        }}
        className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-xs text-ink-soft transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {books.map((book) => (
          <option key={book.id} value={book.id}>
            {book.name}
          </option>
        ))}
      </select>
    </label>
  )
}
