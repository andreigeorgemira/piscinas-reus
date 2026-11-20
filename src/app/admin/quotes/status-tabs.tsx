import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { QUOTE_STATUS_LABELS, QUOTE_STATUSES, type QuoteStatus } from '@/lib/quotes/status'

/** How many quotes each status holds, counted without reading a row. */
export async function countQuotesByStatus(
  supabase: SupabaseClient,
): Promise<Record<QuoteStatus | 'all', number>> {
  const counts = await Promise.all(
    QUOTE_STATUSES.map((status) =>
      supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
        .then(({ count }) => count ?? 0),
    ),
  )
  const byStatus = Object.fromEntries(QUOTE_STATUSES.map((status, index) => [status, counts[index]!])) as Record<
    QuoteStatus,
    number
  >
  return { ...byStatus, all: counts.reduce((sum, count) => sum + count, 0) }
}

const DOT: Record<QuoteStatus, string> = {
  draft: 'bg-faint',
  sent: 'bg-accent',
  accepted: 'bg-success',
  rejected: 'bg-danger',
}

/**
 * The status filter as tabs over the list, with how many each holds: the one
 * filter used every day, one click away instead of inside a popover.
 */
export function StatusTabs({
  current,
  counts,
  hrefFor,
}: {
  current: QuoteStatus | ''
  counts: Record<QuoteStatus | 'all', number>
  hrefFor: (status: QuoteStatus | '') => string
}) {
  const tabs: { status: QuoteStatus | ''; label: string; count: number }[] = [
    { status: '', label: 'Todos', count: counts.all },
    ...QUOTE_STATUSES.map((status) => ({ status, label: QUOTE_STATUS_LABELS[status], count: counts[status] })),
  ]

  return (
    <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const on = tab.status === current
        return (
          <Link
            key={tab.label}
            href={hrefFor(tab.status)}
            aria-current={on ? 'page' : undefined}
            className={`flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
              on ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-muted hover:bg-surface/70 hover:text-ink'
            }`}
          >
            {tab.status ? <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[tab.status]}`} /> : null}
            {tab.label}
            <span className={`num rounded-full px-1.5 text-2xs ${on ? 'bg-accent-soft text-accent' : 'bg-surface-sunk text-faint'}`}>
              {tab.count}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
