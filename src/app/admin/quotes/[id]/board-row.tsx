'use client'

import { useActionState, useOptimistic, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { formatEuros, formatMoney } from '@/lib/price-book/decimal'
import { UNIT_LABELS, UNIT_TYPES } from '@/lib/price-book/schema'
import type { BoardConcept } from '@/lib/quotes/board'
import { formatQuantity } from '@/lib/quotes/quantity'
import type { QuoteItem } from '@/lib/quotes/queries'
import { lineTotal } from '@/lib/quotes/totals'
import { deleteLine, duplicateLine, setLineKind, toggleConcept, updateLine } from './actions'
import {
  CELL_CLASS,
  NAME_INPUT_CLASS,
  NUMBER_FIELD_CLASS,
  NUMBER_INPUT_CLASS,
  ROW_ICON_BUTTON_CLASS,
} from './board-ui'

const ICON_PROPS = {
  width: 13,
  height: 13,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/**
 * One row of the board: a concept of the catalogue, a second line for that
 * concept, or a line this book cannot explain.
 *
 * The three share a row because they are the same row to a person reading the
 * quote -- what differs is what owns the text. A concept row prints the
 * catalogue's name and cannot be renamed here (renaming belongs to the price
 * book); a copy or a free line owns its name and is typed into.
 *
 * Every number saves on its own, on blur or on Enter, with no Guardar button.
 * That is what makes this table feel like a table: an edit mode would mean
 * opening a row to change a quantity, which is the single most common thing
 * anybody does on this screen. The whole row posts each time, hidden fields
 * included -- an update that wrote one field would still have to validate the
 * rest, and a checkbox left out of a form clears it.
 */
export function BoardRow({
  quoteId,
  concept,
  line,
  kind,
  conceptLineCount,
  editable,
}: {
  quoteId: string
  /** Absent on a free line: there is no catalogue behind it. */
  concept?: BoardConcept
  /** Absent on a concept the quote does not use. */
  line: QuoteItem | null
  kind: 'concept' | 'extra' | 'loose'
  /** How many lines this concept has on the quote, for the untick warning. */
  conceptLineCount?: number
  editable: boolean
}) {
  const [confirmingUntick, setConfirmingUntick] = useState(false)
  const [pending, startAction] = useTransition()
  const formId = line ? `line-${line.id}` : `concept-${concept?.id}`
  const lastSaved = useRef<string>('')

  const [state, saveAction, saving] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await updateLine(previous, formData)
      if (next.error) toast.error(next.error)
      return next
    },
    idleState,
  )

  const name = line?.name ?? concept?.name ?? ''
  const unit = line?.unit ?? concept?.unit ?? 'unit'
  const chosen = line !== null
  const optional = line?.isRecommended === true

  /**
   * The tick flips before the server has answered.
   *
   * Without this the checkbox is a controlled input whose state only changes
   * once the action has written the line and the page has revalidated -- two
   * hundred milliseconds in which the box a person just clicked is still empty,
   * which reads as a click that did not land. useOptimistic drops the guess by
   * itself when the real value arrives with the next render.
   */
  const [optimisticChosen, setOptimisticChosen] = useOptimistic(chosen)

  /** The same, for the optional flag: a tick has to land when it is clicked. */
  const [optimisticOptional, setOptimisticOptional] = useOptimistic(optional)

  /**
   * Saves only when something actually changed.
   *
   * A blur fires when the caret leaves a field the person only looked at, and a
   * write per look would be a write per row per pass over the table.
   */
  function saveIfChanged(form: HTMLFormElement | null) {
    if (!form) return
    const snapshot = new URLSearchParams(new FormData(form) as unknown as string[][]).toString()
    if (snapshot === lastSaved.current) return
    lastSaved.current = snapshot
    form.requestSubmit()
  }

  function runToggle() {
    startAction(async () => {
      setOptimisticChosen(!chosen)
      const data = new FormData()
      data.set('quote_id', quoteId)
      data.set('concept_id', concept!.id)
      const result = await toggleConcept(idleState, data)
      if (result.error) toast.error(result.error)
    })
  }

  function runKind(nextKind: 'base' | 'optional') {
    startAction(async () => {
      setOptimisticOptional(nextKind === 'optional')
      const data = new FormData()
      data.set('quote_id', quoteId)
      data.set('id', line!.id)
      data.set('kind', nextKind)
      const result = await setLineKind(idleState, data)
      if (result.error) toast.error(result.error)
    })
  }

  function runDuplicate() {
    startAction(async () => {
      const data = new FormData()
      data.set('quote_id', quoteId)
      data.set('id', line!.id)
      const result = await duplicateLine(idleState, data)
      if (result.error) toast.error(result.error)
      else toast.success('Línea duplicada. Cámbiale el nombre para distinguirla.')
    })
  }

  function runDelete() {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('quote_id', quoteId)
        data.set('id', line!.id)
        const result = await deleteLine(idleState, data)
        if (result.error) toast.error(result.error)
        resolve()
      })
    })
  }

  const total = line ? lineTotal(line) : 0
  const busy = pending || saving

  return (
    <>
      <tr
        className={`group/row transition-colors ${chosen ? 'bg-accent-soft/40' : 'hover:bg-surface-hover'} ${busy ? 'opacity-70' : ''}`}
      >
        {/* The blue edge is what says "this row is on the quote" from across
            the table, with the checkbox as the thing that changes it. */}
        <td className={`${CELL_CLASS} ${chosen ? 'shadow-[inset_2px_0_0_var(--accent)]' : ''}`}>
          {kind === 'concept' ? (
            <input
              type="checkbox"
              checked={optimisticChosen}
              disabled={!editable}
              onChange={() => {
                if (chosen && (conceptLineCount ?? 1) > 1) {
                  setConfirmingUntick(true)
                  return
                }
                runToggle()
              }}
              aria-label={`${optimisticChosen ? 'Quitar' : 'Añadir'} ${name}`}
              className="size-4 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-4 items-center justify-center rounded-[3px] bg-accent text-accent-ink"
            >
              <svg {...ICON_PROPS} width={10} height={10} strokeWidth={2.4}>
                <path d="m3.6 8.4 3 3 5.8-6.4" />
              </svg>
            </span>
          )}
        </td>

        <td className={`${CELL_CLASS} num h-10 text-2xs text-faint`}>{concept?.code ?? '—'}</td>

        <td className={CELL_CLASS}>
          <div className="flex min-w-0 items-center gap-2">
            {kind === 'concept' ? (
              <span
                className={`truncate text-sm ${chosen ? 'font-medium text-ink' : 'text-ink-soft'}`}
                title={name}
              >
                {name}
              </span>
            ) : (
              <input
                form={formId}
                name="name"
                defaultValue={name}
                maxLength={200}
                disabled={!editable}
                onBlur={(event) => saveIfChanged(event.currentTarget.form)}
                aria-label={`Nombre de la línea ${name}`}
                className={NAME_INPUT_CLASS}
              />
            )}

            {kind === 'extra' ? (
              <span className="shrink-0 rounded-full border border-line bg-surface-sunk px-1.5 text-[10px] text-muted">
                copia
              </span>
            ) : null}
            {kind === 'loose' ? (
              <span className="shrink-0 rounded-full border border-dashed border-line px-1.5 text-[10px] text-muted">
                línea libre
              </span>
            ) : null}
            {/*
              No unit here. Whoever writes a quote knows how excavation is
              measured, and the column repeated it on every row for nobody; a
              ticked row shows it inside the quantity field, where it is also
              changed.
            */}
          </div>
        </td>

        <td className={`${CELL_CLASS} text-right`}>
          {chosen ? (
            <label className={`${NUMBER_FIELD_CLASS} relative pr-1`}>
              <span className="sr-only">{`Cantidad de ${name}`}</span>
              <input
                form={formId}
                name="quantity"
                inputMode="decimal"
                defaultValue={formatQuantity(line.quantity)}
                disabled={!editable}
                onBlur={(event) => saveIfChanged(event.currentTarget.form)}
                className={`${NUMBER_INPUT_CLASS} w-12 font-medium`}
              />
              {/*
                The unit belongs to THIS line, not to the catalogue: quote_items
                copies it (0001_core_schema.sql), so changing it here prices one
                job in hours without touching the tariff everyone else quotes
                from. Bare, with no border of its own, so the pair reads as one
                measurement rather than two controls.
              */}
              <select
                form={formId}
                name="unit"
                defaultValue={unit}
                disabled={!editable}
                onChange={(event) => saveIfChanged(event.currentTarget.form)}
                aria-label={`Unidad de ${name}`}
                className="num cursor-pointer appearance-none bg-transparent text-2xs text-muted outline-none focus-visible:text-ink disabled:cursor-default"
              >
                {UNIT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {UNIT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="num text-xs text-faint">—</span>
          )}
        </td>

        <td className={`${CELL_CLASS} text-right`}>
          {chosen ? (
            <label className={NUMBER_FIELD_CLASS}>
              <span className="sr-only">{`Precio de ${name}`}</span>
              <input
                form={formId}
                name="unit_price"
                inputMode="decimal"
                defaultValue={formatMoney(line.unitPrice)}
                disabled={!editable}
                onBlur={(event) => saveIfChanged(event.currentTarget.form)}
                className={`${NUMBER_INPUT_CLASS} w-16`}
              />
              <span aria-hidden="true" className="text-2xs text-faint">
                €
              </span>
            </label>
          ) : (
            <span className="num text-xs text-muted">
              {concept ? formatEuros(concept.unitPrice) : '—'}
            </span>
          )}
        </td>

        <td className={`${CELL_CLASS} text-right`}>
          {chosen ? (
            <label
              className={`${NUMBER_FIELD_CLASS} ${line.discountPct > 0 ? 'border-warn/40 bg-warn-soft' : ''}`}
            >
              <span className="sr-only">{`Descuento de ${name}`}</span>
              {/*
                Blank rather than '0' when there is no discount: a column of
                zeros is a column that says nothing, and the schema reads an
                empty box as zero.
              */}
              <input
                form={formId}
                name="discount_pct"
                inputMode="decimal"
                defaultValue={line.discountPct > 0 ? formatQuantity(line.discountPct) : ''}
                placeholder="0"
                disabled={!editable}
                onBlur={(event) => saveIfChanged(event.currentTarget.form)}
                className={`${NUMBER_INPUT_CLASS} w-8 ${line.discountPct > 0 ? 'text-warn' : 'text-muted'}`}
              />
              <span aria-hidden="true" className="text-2xs text-faint">
                %
              </span>
            </label>
          ) : null}
        </td>

        <td
          className={`${CELL_CLASS} num text-right text-sm ${chosen ? 'font-medium' : ''} ${optional ? 'text-muted' : 'text-ink'}`}
        >
          {chosen ? formatEuros(total) : ''}
        </td>

        <td className={`${CELL_CLASS} text-center`}>
          {chosen ? (
            /*
              One checkbox, at the end of the row, in place of the Base |
              Opcional switch that used to sit in the middle of it. Everything a
              quote carries is part of the price; an extra is the exception, and
              an exception is a box you tick, not a state you pick between two
              named halves.
            */
            <label className="inline-flex items-center justify-center">
              <span className="sr-only">{`Marcar ${name} como extra opcional`}</span>
              <input
                type="checkbox"
                checked={optimisticOptional}
                disabled={!editable}
                onChange={(event) => runKind(event.target.checked ? 'optional' : 'base')}
                className="size-4 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              />
            </label>
          ) : null}
        </td>

        <td className={CELL_CLASS}>
          {/*
            The form lives in a cell and the fields above join it by id: a
            <form> between <tr> and <td> is hoisted out of the table by the
            HTML parser, taking its inputs with it.
          */}
          <form
            id={formId}
            action={saveAction}
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.currentTarget.reset()
            }}
            className="flex items-center justify-end gap-0.5"
          >
            {line ? (
              <>
                <input type="hidden" name="id" value={line.id} />
                <input type="hidden" name="quote_id" value={quoteId} />
                <input type="hidden" name="unit_cost" value={formatMoney(line.unitCost)} />
                <input type="hidden" name="description" value={line.description ?? ''} />
                {/* An unchecked checkbox posts nothing, so the flag rides as a
                    hidden field: without it every save would turn an optional
                    extra back into part of the price. */}
                {optional ? <input type="hidden" name="is_recommended" value="on" /> : null}
                {kind === 'concept' ? <input type="hidden" name="name" value={name} /> : null}

                {editable ? (
                  <>
                    <Tooltip label="Duplicar la línea">
                      <button
                        type="button"
                        onClick={runDuplicate}
                        disabled={busy}
                        aria-label={`Duplicar ${name}`}
                        className={`${ROW_ICON_BUTTON_CLASS} opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100`}
                      >
                        <svg {...ICON_PROPS}>
                          <path d="M5.6 5.6V3.4h7.2v7.2h-2.2" />
                          <path d="M3.2 5.6h7.2v7.2H3.2z" />
                        </svg>
                      </button>
                    </Tooltip>

                    {kind === 'concept' ? null : (
                      <Tooltip label="Quitar la línea">
                        <button
                          type="button"
                          onClick={runDelete}
                          disabled={busy}
                          aria-label={`Quitar ${name}`}
                          className={`${ROW_ICON_BUTTON_CLASS} opacity-0 hover:text-danger group-hover/row:opacity-100 focus-visible:opacity-100`}
                        >
                          <svg {...ICON_PROPS}>
                            <path d="M2.8 4.2h10.4" />
                            <path d="M6.2 4.2V2.8h3.6v1.4" />
                            <path d="M4.2 4.2h7.6l-.6 8.2a.8.8 0 0 1-.8.8H5.6a.8.8 0 0 1-.8-.8Z" />
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                  </>
                ) : null}

                <button type="submit" className="sr-only">
                  Guardar la línea
                </button>
              </>
            ) : null}
          </form>
        </td>
      </tr>

      {state.error ? (
        <tr className="bg-danger-soft">
          <td colSpan={9} className="border-b border-line-soft px-3 py-1.5">
            <p role="alert" className="text-xs text-danger">
              {state.error}
            </p>
          </td>
        </tr>
      ) : null}

      <ConfirmDialog
        open={confirmingUntick}
        onOpenChange={setConfirmingUntick}
        title={`Quitar «${name}» del presupuesto`}
        description={`Este concepto tiene ${conceptLineCount} líneas en el presupuesto.`}
        risks={[
          'Se quitan todas, copias incluidas: la casilla dice si el concepto está o no en el presupuesto.',
          'Si solo quieres quitar una, bórrala con la papelera de su fila.',
        ]}
        confirmLabel="Quitar todas"
        onConfirm={runToggle}
      />
    </>
  )
}
