import { Tooltip } from '@/components/ui/tooltip'
import { formatEuros } from '@/lib/price-book/decimal'
import type { QuoteTotals as Totals } from '@/lib/quotes/queries'

/**
 * What the quote comes to, along the bottom of the editor.
 *
 * Every figure in one run at the right end, reading left to right the way the
 * arithmetic does -- base, extras, cost, margin, total -- and the total last and
 * largest. Split across the bar, with base on one side and the total on the
 * other, it read as two unrelated groups of numbers.
 *
 * Cost and margin sit behind a thin rule with an info mark rather than a label:
 * the two of them are the only figures here a client never sees, which is worth
 * being able to check and not worth a word of chrome on every screen.
 *
 * Every figure is computed by the quote_totals view (0005_quote_totals.sql),
 * never stored and never added up here: the PDF, the client's page and this bar
 * read the same arithmetic, so they cannot disagree. Coste and Margen appear on
 * no screen a client can reach, and what keeps them there is the database -- the
 * client-facing views omit the columns -- not this component.
 */
export function QuoteTotalsBar({ totals, summary }: { totals: Totals; summary: string }) {
  return (
    <footer className="flex h-16 shrink-0 items-center gap-6 border-t border-line bg-surface px-6">
      {/* What the bar is counting, at the end the numbers leave free. */}
      <span className="num mr-auto text-xs text-muted">{summary}</span>

      <Figure label="Base" value={formatEuros(totals.baseTotal)} />

      {totals.recommendedTotal > 0 ? (
        <Figure
          label="Extras opcionales"
          value={formatEuros(totals.recommendedTotal)}
          tone="muted"
          note="Fuera del total hasta que el cliente los marque"
        />
      ) : null}

      {totals.selectedExtrasTotal > 0 ? (
        <Figure label="Extras marcados" value={formatEuros(totals.selectedExtrasTotal)} />
      ) : null}

      <div className="flex items-center gap-4 border-l border-line pl-6">
        <Figure label="Coste" value={formatEuros(totals.costTotal)} tone="muted" />
        <Figure
          label="Margen"
          value={formatEuros(totals.margin)}
          tone={totals.margin < 0 ? 'danger' : 'success'}
        />
        <Tooltip label="El coste y el margen no salen en el PDF ni en el enlace del cliente.">
          <span
            tabIndex={0}
            role="note"
            aria-label="El coste y el margen no salen en el PDF ni en el enlace del cliente."
            className="flex size-4 shrink-0 cursor-default items-center justify-center rounded-full border border-line text-[9px] font-semibold text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            i
          </span>
        </Tooltip>
      </div>

      <div className="flex h-11 items-center gap-3 rounded-lg border border-line bg-surface-sunk px-4">
        <span className="text-xs font-medium text-ink-soft">Total</span>
        <span className="num text-xl font-semibold -tracking-[0.02em]">
          {formatEuros(totals.grandTotal)}
        </span>
      </div>
    </footer>
  )
}

function Figure({
  label,
  value,
  tone = 'plain',
  note,
}: {
  label: string
  value: string
  tone?: 'plain' | 'muted' | 'success' | 'danger'
  note?: string
}) {
  const colour =
    tone === 'muted'
      ? 'text-muted'
      : tone === 'success'
        ? 'text-success'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-ink'

  return (
    <div className="flex flex-col">
      <span className="text-2xs font-medium tracking-[0.05em] text-faint uppercase">{label}</span>
      <span className={`num text-sm font-medium ${colour}`}>{value}</span>
      {note ? <span className="text-[10px] text-faint">{note}</span> : null}
    </div>
  )
}
