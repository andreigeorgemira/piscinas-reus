import { formatEuros } from '@/lib/price-book/decimal'
import type { QuoteTotals as Totals } from '@/lib/quotes/queries'

/**
 * What the quote comes to, as the office reads it.
 *
 * Every figure here is computed by the quote_totals view
 * (0005_quote_totals.sql), never stored and never added up on this screen: the
 * PDF, the client's page and this panel all read the same arithmetic, so they
 * cannot disagree.
 *
 * Coste and Margen are on this panel and on no screen a client can reach. What
 * keeps them there is the database -- the client-facing views omit the columns
 * entirely -- not this component.
 */
export function QuoteTotals({ totals }: { totals: Totals }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-card">
      <h2 className="text-sm font-semibold">Totales</h2>

      <dl className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-muted">Base</dt>
          <dd className="num text-sm">{formatEuros(totals.baseTotal)}</dd>
        </div>

        {totals.recommendedTotal > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-muted">
              Extras opcionales
              <span className="block text-2xs text-faint">
                Fuera del total hasta que el cliente los marque
              </span>
            </dt>
            <dd className="num text-sm text-muted">{formatEuros(totals.recommendedTotal)}</dd>
          </div>
        ) : null}

        {totals.selectedExtrasTotal > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-muted">Extras marcados</dt>
            <dd className="num text-sm">{formatEuros(totals.selectedExtrasTotal)}</dd>
          </div>
        ) : null}

        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2">
          <dt className="text-sm font-semibold">Total</dt>
          <dd className="num text-base font-semibold">{formatEuros(totals.grandTotal)}</dd>
        </div>

        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line-soft pt-2">
          <dt className="text-xs text-faint">Coste</dt>
          <dd className="num text-xs text-faint">{formatEuros(totals.costTotal)}</dd>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-faint">Margen</dt>
          <dd
            className={`num text-xs ${totals.margin < 0 ? 'font-medium text-danger' : 'text-faint'}`}
          >
            {formatEuros(totals.margin)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
