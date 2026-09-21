'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { formatEuros } from '@/lib/price-book/decimal'
import type { ConceptMatch } from '@/lib/price-book/queries'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { addCatalogueLine, searchCatalogue } from './actions'

/** A price book, as this panel's selector lists them. */
export type BookOption = { id: string; name: string }

const FIELD_CLASS =
  'h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/**
 * The search that turns the catalogue into quote lines.
 *
 * Why a Server Action behind a debounced input rather than a `?q=` navigation:
 * a quote is assembled by adding forty lines in a row, and a navigation per
 * search resets the scroll position and the focus every time. 200 ms is long
 * enough that 'gresite' is one request rather than seven, and short enough that
 * it feels like the list is filtering rather than loading.
 *
 * The book selector is the whole answer to having more than one price book
 * (0012_price_books.sql): a quote is not tied to a book, so a job that needs an
 * obra line and a mantenimiento line takes both. The selection is remembered
 * for as long as the editor is open -- not stored on the quote, because the
 * next quote from the same screen is usually for the same trade, and that is a
 * session-shaped memory rather than a fact about the document.
 */
export function ConceptSearch({
  quoteId,
  books,
  frozen,
}: {
  quoteId: string
  books: BookOption[]
  /** True when the quote has left draft: the panel then explains rather than adds. */
  frozen: boolean
}) {
  const searchId = useId()
  const bookId = useId()
  const [book, setBook] = useState(books[0]?.id ?? '')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<ConceptMatch[]>([])
  const [open, setOpen] = useState(false)
  const [asExtra, setAsExtra] = useState(false)
  const [searching, startSearch] = useTransition()
  const [adding, startAdd] = useTransition()
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  /**
   * Searching as you type, a fifth of a second after you stop.
   *
   * It runs on mount too, with an empty term, so the panel opens showing the
   * head of the book rather than nothing: an empty panel reads as "found
   * nothing" when in fact nothing was asked.
   */
  useEffect(() => {
    if (frozen || book === '') return
    const timer = setTimeout(() => {
      startSearch(async () => {
        try {
          setResults(await searchCatalogue(book, term))
        } catch (error) {
          console.error('catalogue search failed', error)
          toast.error('No se pudo buscar en el tarifario.')
        }
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [book, term, frozen])

  /** A click outside closes the results, the way every combo box does. */
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!panel.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function add(concept: ConceptMatch) {
    startAdd(async () => {
      const data = new FormData()
      data.set('quote_id', quoteId)
      data.set('concept_id', concept.id)
      if (asExtra) data.set('is_recommended', 'on')
      const result = await addCatalogueLine(idleState, data)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`«${concept.name}» añadido`)
      // The panel stays open and the caret stays in the box: a quote is
      // assembled by adding several lines in a row, and closing after each one
      // would mean reopening and retyping.
      input.current?.focus()
    })
  }

  if (frozen) {
    return (
      <div className="border-b border-line bg-surface px-3 py-2.5">
        <p className="text-xs text-muted">
          Las líneas están congeladas mientras el presupuesto no sea un borrador.
        </p>
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="border-b border-line bg-surface px-3 py-2.5">
        <p className="text-xs text-muted">
          No hay ningún tarifario todavía.{' '}
          <Link href="/admin/price-books" className="text-accent underline">
            Crea uno
          </Link>{' '}
          para poder añadir conceptos, o escribe una línea libre aquí abajo.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 border-b border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={bookId} className="sr-only">
          Tarifario
        </label>
        <select
          id={bookId}
          value={book}
          onChange={(event) => {
            setBook(event.target.value)
            setOpen(true)
          }}
          className={`${FIELD_CLASS} cursor-pointer`}
        >
          {books.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

        <div className="relative flex-1" ref={panel}>
          <label htmlFor={searchId} className="sr-only">
            Buscar conceptos en el tarifario
          </label>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-canvas px-3 transition-colors focus-within:border-accent focus-within:bg-surface focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
            {searching ? (
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="shrink-0 animate-spin text-accent"
                aria-hidden="true"
              >
                <path d="M8 1.8a6.2 6.2 0 1 0 6.2 6.2" />
              </svg>
            ) : (
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
            )}
            <input
              ref={input}
              id={searchId}
              type="search"
              value={term}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setTerm(event.target.value)
                setOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
                // Enter adds the first match, which is what the keyboard
                // expects of a list of results you have just narrowed.
                if (event.key === 'Enter' && results[0]) {
                  event.preventDefault()
                  add(results[0])
                }
              }}
              placeholder="Buscar un concepto para añadirlo"
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          {open ? (
            <div className="absolute top-full left-0 z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop">
              {results.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted">
                  {searching
                    ? 'Buscando…'
                    : term === ''
                      ? 'Este tarifario no tiene conceptos activos.'
                      : 'Ningún concepto coincide.'}
                </p>
              ) : (
                <ul>
                  {results.map((concept) => (
                    <li key={concept.id}>
                      <button
                        type="button"
                        disabled={adding}
                        onClick={() => add(concept)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            {concept.code ? (
                              <span className="num shrink-0 font-mono text-2xs text-faint">
                                {concept.code}
                              </span>
                            ) : null}
                            <span className="truncate text-sm">{concept.name}</span>
                          </span>
                          {concept.groupName ? (
                            <span className="block truncate text-2xs text-faint">
                              {concept.groupName}
                            </span>
                          ) : null}
                        </span>
                        <span className="num shrink-0 text-xs text-muted">
                          {formatEuros(concept.unitPrice)}
                          <span className="text-faint">{` / ${UNIT_LABELS[concept.unit]}`}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
          <input
            type="checkbox"
            checked={asExtra}
            onChange={(event) => setAsExtra(event.target.checked)}
            className="size-3.5 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
          Añadir como extra opcional
        </label>
      </div>
    </div>
  )
}
