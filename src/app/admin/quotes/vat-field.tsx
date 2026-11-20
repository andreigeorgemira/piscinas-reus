'use client'

import { useId } from 'react'
import { VAT_RATE_CHOICES, vatChoiceLabel } from '@/lib/vat'

const FIELD_CLASS =
  'h-9 w-full rounded-md border bg-surface pr-8 pl-2.5 text-right text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-70'

/** How a rate is written back into the box: '21', '10,5', or '' for none. */
function boxValue(rate: number | null): string {
  return rate === null ? '' : String(rate).replace('.', ',')
}

/**
 * The VAT a quote is charged at, typed: any percentage from 0 to 100, or the
 * box left empty for a document with no VAT ("IVA no incluido").
 *
 * The usual Spanish rates are suggested as the box is focused, but nothing
 * limits it to them -- a rate the office needs is a rate it can type.
 * src/lib/vat.ts reads it back (and accepts a trailing '%').
 */
export function VatField({
  defaultRate,
  error,
  disabled,
  label = 'IVA',
  hint,
  name = 'vat_rate',
}: {
  defaultRate: number | null
  /** The field it posts: a quote's `vat_rate`, or the settings' `default_vat_rate`. */
  name?: string
  error?: string
  disabled?: boolean
  label?: string
  hint?: string
}) {
  const id = useId()
  const listId = `${id}-rates`
  const note = hint ?? 'Déjalo vacío para un presupuesto sin IVA («IVA no incluido»).'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <div className="relative w-32">
        <input
          id={id}
          name={name}
          defaultValue={boxValue(defaultRate)}
          inputMode="decimal"
          autoComplete="off"
          list={listId}
          placeholder="Sin IVA"
          maxLength={6}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-note`}
          className={`${FIELD_CLASS} ${error ? 'border-danger' : 'border-line'}`}
        />
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted">
          %
        </span>
      </div>
      <datalist id={listId}>
        {VAT_RATE_CHOICES.map((rate) => (
          <option key={rate} value={boxValue(rate)} label={vatChoiceLabel(rate)} />
        ))}
      </datalist>
      <p id={`${id}-note`} className={`text-2xs ${error ? 'text-danger' : 'text-faint'}`}>
        {error ?? note}
      </p>
    </div>
  )
}
