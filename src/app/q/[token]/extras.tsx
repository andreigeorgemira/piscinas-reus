'use client'

import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { formatEuros } from '@/lib/price-book/decimal'
import { formatQuantity } from '@/lib/quotes/quantity'
import type { PublicQuoteItem } from '@/lib/quotes/public'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { toggleExtra } from './actions'

/**
 * The extras the client chooses, and the only thing on this page they can
 * change.
 *
 * Every tick is a write: `client_selected` on that line, which the trigger in
 * 0009_quote_immutability.sql allows on a recommended line of a sent quote and
 * on nothing else. The total underneath moves with it, so the decision and its
 * price are never a screen apart.
 *
 * Optimistic, because the person doing this is deciding how much to spend and a
 * checkbox that lags reads as one that did not register.
 */
export function Extras({
  token,
  extras,
  editable,
}: {
  token: string
  extras: PublicQuoteItem[]
  /** False once the quote has been answered: it is then a record, not a form. */
  editable: boolean
}) {
  const [chosen, setChosen] = useOptimistic(
    new Set(extras.filter((extra) => extra.clientSelected).map((extra) => extra.id)),
  )
  const [, startAction] = useTransition()

  function toggle(item: PublicQuoteItem, selected: boolean) {
    startAction(async () => {
      setChosen((current) => {
        const next = new Set(current)
        if (selected) next.add(item.id)
        else next.delete(item.id)
        return next
      })

      const data = new FormData()
      data.set('token', token)
      data.set('item_id', item.id)
      if (selected) data.set('selected', 'on')

      const result = await toggleExtra(idleState, data)
      if (result.error) toast.error(result.error)
    })
  }

  const total = extras
    .filter((extra) => chosen.has(extra.id))
    .reduce((sum, extra) => sum + extra.lineTotal, 0)

  return (
    <section className="rounded-xl border border-accent/30 bg-accent-soft/60 p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">Extras opcionales</h2>
        {editable ? (
          <p className="text-xs text-accent">
            Marca los que quieras: el total de abajo se actualiza solo.
          </p>
        ) : (
          <p className="text-xs text-muted">Esto es lo que quedó marcado.</p>
        )}
      </div>

      <ul className="pt-2">
        {extras.map((extra) => {
          const selected = chosen.has(extra.id)
          return (
            <li key={extra.id} className="border-b border-accent/15 last:border-0">
              <label
                className={`flex items-center gap-3 py-2.5 ${editable ? 'cursor-pointer' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={!editable}
                  onChange={(event) => toggle(extra, event.target.checked)}
                  aria-label={`Añadir ${extra.name} al presupuesto`}
                  className="size-[18px] shrink-0 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${selected ? 'font-medium' : ''}`}>
                    {extra.name}
                  </span>
                  <span className="num block text-2xs text-muted">
                    {`${formatQuantity(extra.quantity)} ${UNIT_LABELS[extra.unit]} × ${formatEuros(extra.unitPrice)}`}
                    {extra.groupName ? ` · ${extra.groupName}` : ''}
                  </span>
                </span>
                <span
                  className={`num shrink-0 text-sm ${selected ? 'font-medium text-ink' : 'text-muted'}`}
                >
                  {formatEuros(extra.lineTotal)}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <p className="flex items-baseline justify-between pt-3 text-xs text-muted">
        {chosen.size === 0
          ? 'Ningún extra marcado'
          : chosen.size === 1
            ? '1 extra marcado'
            : `${chosen.size} extras marcados`}
        <span className="num text-sm font-medium text-accent">{formatEuros(total)}</span>
      </p>
    </section>
  )
}
