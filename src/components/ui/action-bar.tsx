'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Tooltip } from './tooltip'

/**
 * The strip above a list: search on the left, filters beside it, screen
 * actions on the right. One component so every list screen in the app looks
 * and behaves the same way.
 *
 * It is a single GET form. The filter controls live in a popover, which
 * Radix renders in a portal at the end of <body> -- outside this form -- so
 * they join it through `form={formId}` rather than by nesting. Submitting
 * navigates, which is what puts the whole query in the URL: linkable,
 * bookmarkable, and working before any JavaScript has loaded.
 */
/**
 * The form the search box and every filter control belong to.
 *
 * A constant rather than a useId: the filter fields are rendered by the
 * SERVER component that uses this bar, and a callback handing them a
 * generated id cannot cross that boundary. One action bar per screen, so a
 * fixed id collides with nothing.
 */
export const ACTION_BAR_FORM_ID = 'action-bar-form'

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
  /** Screen actions, right-aligned. */
  children?: ReactNode
}) {
  const formId = ACTION_BAR_FORM_ID
  const router = useRouter()
  const searchParams = useSearchParams()
  const [term, setTerm] = useState(searchValue)
  const [, startNavigation] = useTransition()
  const typed = useRef(false)

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

  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface px-5 py-2.5">
      <form id={formId} action={action} className="flex items-center gap-2">
        {Object.entries(hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        <label className="flex h-8 w-80 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 focus-within:border-accent">
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
          <span className="sr-only">{searchLabel}</span>
          <input
            type="search"
            name={searchName}
            value={term}
            onChange={(event) => {
              typed.current = true
              setTerm(event.target.value)
            }}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-xs outline-none placeholder:text-faint"
          />
        </label>
        <button type="submit" className="sr-only">
          Buscar
        </button>
      </form>

      {filters ? (
        <Popover>
          <Tooltip label="Filtrar">
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Filtrar"
                className={`relative flex size-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  filterCount > 0
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-muted hover:bg-surface-hover hover:text-ink'
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
                {filterCount > 0 ? (
                  <span className="num absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-ink">
                    {filterCount}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
          </Tooltip>

          <PopoverContent align="start" className="w-80 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Filtros</span>
                {onClearFilters && filterCount > 0 ? (
                  <a href={onClearFilters} className="text-xs text-accent underline">
                    Quitar filtros
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
  )
}
