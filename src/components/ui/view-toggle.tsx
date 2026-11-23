import Link from 'next/link'

export type ListView = 'cards' | 'table'

/** The `vista` search param as a view: cards unless the table was asked for. */
export function readListView(value: string | string[] | undefined): ListView {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'tabla' ? 'table' : 'cards'
}

const ICONS: Record<ListView, string> = {
  cards: 'M2.6 2.6h4.4v4.4H2.6ZM9 2.6h4.4v4.4H9ZM2.6 9h4.4v4.4H2.6ZM9 9h4.4v4.4H9Z',
  table: 'M2.6 3.4h10.8M2.6 6.5h10.8M2.6 9.6h10.8M2.6 12.7h10.8',
}

const LABELS: Record<ListView, string> = { cards: 'Tarjetas', table: 'Tabla' }

/**
 * Cards or a table, as two links: the choice is in the address, so it survives
 * a reload and can be bookmarked, and works before any JavaScript has loaded.
 */
export function ViewToggle({ current, hrefs }: { current: ListView; hrefs: Record<ListView, string> }) {
  return (
    <div role="group" aria-label="Vista" className="flex shrink-0 rounded-lg bg-surface-sunk p-0.5">
      {(['cards', 'table'] as const).map((view) => {
        const on = view === current
        return (
          <Link
            key={view}
            href={hrefs[view]}
            aria-current={on ? 'true' : undefined}
            title={LABELS[view]}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-[background-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
              on ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-muted hover:text-ink'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS[view]} />
            </svg>
            <span className="hidden sm:inline">{LABELS[view]}</span>
            <span className="sr-only sm:hidden">{LABELS[view]}</span>
          </Link>
        )
      })}
    </div>
  )
}
