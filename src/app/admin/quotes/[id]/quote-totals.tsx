import { formatEuros } from '@/lib/price-book/decimal'
import type { QuoteTotals as Totals } from '@/lib/quotes/queries'

/**
 * What the quote comes to, along the bottom of the editor.
 *
 * A bar rather than a card in a rail: the table owns the width on this screen,
 * and the total is the one number somebody glances at between every two edits,
 * so it sits where the eye already is -- under the last row, always on screen,
 * never scrolled away.
 *
 * Every figure is computed by the quote_totals view (0005_quote_totals.sql),
 * never stored and never added up here: the PDF, the client's page and this bar
 * read the same arithmetic, so they cannot disagree. Coste and Margen appear on
 * no screen a client can reach, and what keeps them there is the database -- the
 * client-facing views omit the columns -- not this component.
 */
export function QuoteTotalsBar({ totals }: { totals: Totals }) {
  return (
    <footer className="flex h-16 shrink-0 items-center gap-7 border-t border-line bg-surface px-6">
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

      <Figure label="Coste" value={formatEuros(totals.costTotal)} tone="muted" />
      <Figure
        label="Margen"
        value={formatEuros(totals.margin)}
        tone={totals.margin < 0 ? 'danger' : 'success'}
      />

      <div className="ml-auto flex h-11 items-center gap-3 rounded-lg border border-line bg-surface-sunk px-4">
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
