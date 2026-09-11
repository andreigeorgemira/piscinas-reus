'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

/**
 * The form the search box and every filter control belong to.
 *
 * A constant rather than a useId: the filter fields are rendered by the
 * SERVER component that uses this bar, and a callback handing them a
 * generated id cannot cross that boundary. One action bar per screen, so a
 * fixed id collides with nothing.
 */
export const ACTION_BAR_FORM_ID = 'action-bar-form'

/**
 * The strip a list screen is searched and filtered from.
 *
 * It lives INSIDE the list's own card, above the column headers, rather than
 * as a second bar under the page header: it belongs to the catalogue, not to
 * the chrome, and two stacked full-width bars read as two page headers that
 * failed to agree.
 *
 * It is a single GET form. The filter controls live in a popover, which
 * Radix renders in a portal at the end of <body> -- outside this form -- so
 * they join it through `form={ACTION_BAR_FORM_ID}` rather than by nesting.
 * Submitting navigates, which is what puts the whole query in the URL:
 * linkable, bookmarkable, and working before any JavaScript has loaded.
 */
export function ActionBar({
  action,
  searchName = 'q',
  searchValue,
  searchLabel,
  searchPlaceholder,
  hidden,
  filters,
  filterCount = 0,
  onClearFilters,
  chips,
  children,
}: {
  /** Where the form submits, i.e. the screen itself. */
  action: string
  searchName?: string
  searchValue: string
  searchLabel: string
  searchPlaceholder: string
  /** Query values to carry through the submit, e.g. the page size. */
  hidden?: Record<string, string>
  /** The filter controls. Each needs `form={ACTION_BAR_FORM_ID}`. */
  filters?: ReactNode
  /** How many filters are on, for the badge. */
  filterCount?: number
  /** Where "Quitar filtros" goes. Omitted when nothing is filtered. */
  onClearFilters?: string
  /** One removable chip per filter in force. */
  chips?: ReactNode
  /** Screen actions, right-aligned. */
  children?: ReactNode
}) {
  const formId = ACTION_BAR_FORM_ID
  const router = useRouter()
  const searchParams = useSearchParams()
  const [term, setTerm] = useState(searchValue)
  const [searching, startNavigation] = useTransition()
  const typed = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  /**
   * Searching as you type, a second after you stop.
   *
   * The delay is what makes this a search rather than a request per
   * keystroke: 'gresite' would otherwise be seven round trips, six of them
   * for prefixes nobody wanted. Enter still works -- it submits the form,
   * which carries the filters with it -- and so does the screen with no
   * JavaScript at all.
   *
   * `typed` keeps the timer from firing on first render, when `term` simply
   * mirrors what the URL already says.
   */
  useEffect(() => {
    if (!typed.current) return
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (term.trim()) params.set(searchName, term.trim())
      else params.delete(searchName)
      // A new search is a new result set, so it starts at its first page.
      params.delete('page')
      const query = params.toString()
      startNavigation(() => router.push(query ? `${action}?${query}` : action))
    }, 800)
    return () => clearTimeout(timer)
  }, [term, action, searchName, searchParams, router])

  /**
   * `/` jumps to the search box, the way it does in every tool staff already
   * use. Ignored while they are typing somewhere else, which is what stops
   * it from swallowing a slash in a concept name.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const active = document.activeElement
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      if (typing) return
      event.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function clearSearch() {
    typed.current = true
    setTerm('')
    input.current?.focus()
  }

  return (
    <div className="flex flex-col gap-2 border-b border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <form id={formId} action={action} className="flex items-center">
          {Object.entries(hidden ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <div className="group/search flex h-9 w-96 max-w-full items-center gap-2 rounded-lg border border-line bg-canvas px-3 transition-colors focus-within:border-accent focus-within:bg-surface focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
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
                className="shrink-0 text-faint group-focus-within/search:text-accent"
                aria-hidden="true"
              >
                <circle cx="7.2" cy="7.2" r="4.4" />
                <path d="m10.6 10.6 2.8 2.8" />
              </svg>
            )}

            <input
              ref={input}
              type="search"
              name={searchName}
              // The name is on the input, not on a wrapping <label>: the box
              // is a div now (it holds the icon, the clear button and the
              // shortcut hint), and a label that does not wrap its control
              // names nothing.
              aria-label={searchLabel}
              value={term}
              onChange={(event) => {
                typed.current = true
                setTerm(event.target.value)
              }}
              placeholder={searchPlaceholder}
              // The browser's own clear button would sit beside ours.
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
            />

            {term ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Limpiar la búsqueda"
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            ) : (
              <kbd className="num hidden shrink-0 rounded border border-line bg-surface px-1.5 text-2xs text-faint sm:block">
                /
              </kbd>
            )}
          </div>

          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>

        {filters ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  filterCount > 0
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink-soft hover:bg-surface-hover'
                }`}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.4 3.6h11.2L9.4 8.4v4.2l-2.8 1.4V8.4Z" />
                </svg>
                Filtros
                {filterCount > 0 ? (
                  <span className="num flex size-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-ink">
                    {filterCount}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-80 p-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Filtros</span>
                  {onClearFilters && filterCount > 0 ? (
                    <a href={onClearFilters} className="text-xs text-accent underline">
                      Quitar todos
                    </a>
                  ) : null}
                </div>

                {filters}

                <button
                  type="submit"
                  form={formId}
                  className="flex h-8 items-center justify-center rounded-md border border-ink bg-ink text-xs font-medium text-canvas hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Aplicar filtros
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
      </div>

      {/*
        What is in force, spelled out and removable one at a time. A badge
        saying "3" tells you that something is hidden but not what, and the
        popover it came from has to be opened to find out.
      */}
      {chips ? <div className="flex flex-wrap items-center gap-1.5">{chips}</div> : null}
    </div>
  )
}

/** One filter in force, with the address that lifts it. */
export function FilterChip({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <span className="flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface-sunk pr-1 pl-2.5 text-2xs text-ink-soft">
      <span className="text-faint">{label}:</span>
      {value}
      <a
        href={href}
        aria-label={`Quitar el filtro ${label}`}
        className="flex size-4 items-center justify-center rounded-full text-faint transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      </a>
    </span>
  )
}
