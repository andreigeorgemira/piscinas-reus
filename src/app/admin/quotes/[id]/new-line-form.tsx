'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { UNIT_LABELS, UNIT_TYPES } from '@/lib/price-book/schema'
import { addFreeLine } from './actions'

/**
 * A line that is not in any catalogue: a one-off, a note with a price, the
 * thing the client asked for on the phone.
 *
 * A disclosure at the foot of the table, the same shape as "Nuevo grupo" in the
 * price book, because it is the same kind of thing: the rare action that must
 * be reachable without taking up room while it is not being used.
 *
 * It does not offer to save the line into the catalogue. That is a different
 * decision, made on a different screen, and a checkbox here would turn every
 * one-off into a catalogue nobody curated.
 */
export function NewLineForm({ quoteId }: { quoteId: string }) {
  const nameId = useId()
  const unitId = useId()
  const quantityId = useId()
  const priceId = useId()
  const costId = useId()
  const [open, setOpen] = useState(false)
  const [fieldsKey, setFieldsKey] = useState(0)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await addFreeLine(previous, formData)
      if (next.error === null) {
        startTransition(() => setFieldsKey((key) => key + 1))
        toast.success('Línea añadida')
      }
      return next
    },
    idleState,
  )

  if (!open) {
    return (
      <div className="border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="text-faint"
            aria-hidden="true"
          >
            <path d="M8 3.4v9.2M3.4 8h9.2" />
          </svg>
          Línea libre
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 border-t border-line px-3 py-2">
      <form
        action={formAction}
        onReset={(event) => event.preventDefault()}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="quote_id" value={quoteId} />

        <label htmlFor={nameId} className="text-xs whitespace-nowrap text-muted">
          Concepto
        </label>
        <input
          key={`name-${fieldsKey}`}
          id={nameId}
          name="name"
          maxLength={200}
          autoFocus
          placeholder="Trabajo a medida"
          className={`${FIELD_CLASS} h-7 w-56`}
        />

        <label htmlFor={unitId} className="text-xs whitespace-nowrap text-muted">
          Ud.
        </label>
        <select id={unitId} name="unit" defaultValue="unit" className={`${FIELD_CLASS} h-7`}>
          {UNIT_TYPES.map((unit) => (
            <option key={unit} value={unit}>
              {UNIT_LABELS[unit]}
            </option>
          ))}
        </select>

        <label htmlFor={quantityId} className="text-xs whitespace-nowrap text-muted">
          Cantidad
        </label>
        <input
          key={`quantity-${fieldsKey}`}
          id={quantityId}
          name="quantity"
          inputMode="decimal"
          defaultValue="1"
          className={`${FIELD_CLASS} num h-7 w-20 text-right`}
        />

        <label htmlFor={priceId} className="text-xs whitespace-nowrap text-muted">
          Precio
        </label>
        <input
          key={`price-${fieldsKey}`}
          id={priceId}
          name="unit_price"
          inputMode="decimal"
          placeholder="0,00"
          className={`${FIELD_CLASS} num h-7 w-24 text-right`}
        />

        <label htmlFor={costId} className="text-xs whitespace-nowrap text-muted">
          Coste
        </label>
        <input
          key={`cost-${fieldsKey}`}
          id={costId}
          name="unit_cost"
          inputMode="decimal"
          placeholder="0,00"
          className={`${FIELD_CLASS} num h-7 w-24 text-right`}
        />

        {/*
          The discount is not on this form: a line being written for the first
          time has a price, and a discount on a price nobody has seen yet is
          just a lower price. It is one click away in the row's own edit mode.
        */}
        <input type="hidden" name="discount_pct" value="0" />

        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
          <input
            type="checkbox"
            name="is_recommended"
            className="size-3.5 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
          Extra opcional
        </label>

        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? 'Añadiendo…' : 'Añadir línea'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={BUTTON_CLASS}>
          Cancelar
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
