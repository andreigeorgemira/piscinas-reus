'use client'

import { startTransition, useActionState, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { DANGER_ICON_BUTTON_CLASS, ICON_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { formatEuros } from '@/lib/price-book/decimal'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { formatQuantity } from '@/lib/quotes/quantity'
import type { QuoteItem } from '@/lib/quotes/queries'
import { lineCost, lineTotal } from '@/lib/quotes/totals'
import { deleteLine, moveLine, updateLine } from './actions'
import { CELL_CLASS, LineFields, QUOTE_LINE_COLUMN_COUNT } from './line-fields'

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/**
 * One line of a quote: read mode, and an edit mode in the same cells.
 *
 * The same arrangement as the price book's ItemRow, deliberately. A quote is
 * mostly typing quantities, so always-open inputs on the numeric columns were
 * tempting -- but then two mechanisms live in one table (fields you type into,
 * and text you have to open first), and the row that behaves differently from
 * every other row in the app is the one people mistrust.
 *
 * `editable` is false for a quote that has left draft. The refusal is a trigger
 * (0009_quote_immutability.sql); this only stops the screen from offering a
 * control whose save would be refused.
 */
export function LineRow({
  line,
  quoteId,
  editable,
  isFirst,
  isLast,
}: {
  line: QuoteItem
  quoteId: string
  editable: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [, startAction] = useTransition()

  const formId = `line-${line.id}`

  const [state, saveAction, saving] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await updateLine(previous, formData)
      if (next.error === null) {
        startTransition(() => setEditing(false))
        toast.success('Línea guardada')
      }
      return next
    },
    idleState,
  )

  function runDelete() {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', line.id)
        data.set('quote_id', quoteId)
        const result = await deleteLine(idleState, data)
        if (result.error) toast.error(result.error)
        else toast.error(`Línea «${line.name}» borrada`)
        resolve()
      })
    })
  }

  function move(direction: 'up' | 'down') {
    startAction(async () => {
      const data = new FormData()
      data.set('id', line.id)
      data.set('quote_id', quoteId)
      data.set('direction', direction)
      const result = await moveLine(idleState, data)
      if (result.error) toast.error(result.error)
    })
  }

  if (editing) {
    return (
      <>
        <tr className="bg-surface-hover">
          <LineFields formId={formId} line={line} />
          <td className={CELL_CLASS}>
            {/*
              The form lives here, in a cell, and the fields join it by id.
              A <form> between <tr> and <td> is hoisted out of the table.
            */}
            <form
              id={formId}
              action={saveAction}
              onReset={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(false)
              }}
              className="flex items-center justify-end gap-1"
            >
              <input type="hidden" name="id" value={line.id} />
              <input type="hidden" name="quote_id" value={quoteId} />
              <button
                type="submit"
                disabled={saving}
                aria-label="Guardar la línea"
                className={ICON_BUTTON_CLASS}
              >
                <svg {...ICON_PROPS} strokeWidth={2}>
                  <path d="m3.2 8.4 3.2 3.2 6.4-6.8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Cancelar"
                className={ICON_BUTTON_CLASS}
              >
                <svg {...ICON_PROPS} strokeWidth={2}>
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </form>
          </td>
        </tr>
        {state.error ? (
          <tr className="bg-surface-hover">
            <td colSpan={QUOTE_LINE_COLUMN_COUNT} className="border-b border-line-soft px-3 pb-2">
              <p role="alert" className="text-xs text-danger">
                {state.error}
              </p>
            </td>
          </tr>
        ) : null}
      </>
    )
  }

  const total = lineTotal(line)

  return (
    <>
      <tr className="group/row transition-colors hover:bg-surface-hover">
        <td className={CELL_CLASS}>
          {editable ? (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
              {/*
                Two buttons instead of dragging. They are keyboard-reachable,
                they need no new dependency, and a quote line almost never
                travels far. moveLine renumbers the whole quote, so an order
                written before this screen existed repairs itself on the first
                move.
              */}
              <button
                type="button"
                onClick={() => move('up')}
                disabled={isFirst}
                aria-label={`Subir ${line.name}`}
                className="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:invisible"
              >
                <svg {...ICON_PROPS} width={12} height={12} strokeWidth={1.8}>
                  <path d="M8 12.4V4.2M4.6 7.2 8 3.8l3.4 3.4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => move('down')}
                disabled={isLast}
                aria-label={`Bajar ${line.name}`}
                className="flex size-5 items-center justify-center rounded text-faint transition-colors hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:invisible"
              >
                <svg {...ICON_PROPS} width={12} height={12} strokeWidth={1.8}>
                  <path d="M8 3.6v8.2M4.6 8.8 8 12.2l3.4-3.4" />
                </svg>
              </button>
            </div>
          ) : null}
        </td>
        <td className={CELL_CLASS}>
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium" title={line.name}>
                {line.name}
              </span>
              {line.isRecommended ? (
                <span className="inline-flex h-4 shrink-0 items-center rounded-full border border-accent/40 bg-accent-soft px-1.5 text-[10px] font-medium text-accent">
                  Opcional
                </span>
              ) : null}
            </div>
            {line.description ? (
              <span className="truncate text-xs text-muted" title={line.description}>
                {line.description}
              </span>
            ) : null}
            {line.groupName ? (
              <span className="truncate text-2xs text-faint">{line.groupName}</span>
            ) : null}
          </div>
        </td>
        <td className={`${CELL_CLASS} text-xs text-muted`}>{UNIT_LABELS[line.unit]}</td>
        <td className={`${CELL_CLASS} num text-right font-medium`}>
          {formatQuantity(line.quantity)}
        </td>
        <td className={`${CELL_CLASS} num text-right`}>{formatEuros(line.unitPrice)}</td>
        <td className={`${CELL_CLASS} num text-right text-muted`}>
          {line.discountPct === 0 ? '—' : `${formatQuantity(line.discountPct)}%`}
        </td>
        <td
          className={`${CELL_CLASS} num text-right font-medium ${line.isRecommended ? 'text-muted' : ''}`}
        >
          {formatEuros(total)}
        </td>
        <td className={`${CELL_CLASS} num text-right text-faint`}>
          {formatEuros(lineCost(line))}
        </td>
        <td className={CELL_CLASS}>
          {editable ? (
            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
              <Tooltip label="Editar la línea">
                <button
                  type="button"
                  aria-label={`Editar ${line.name}`}
                  onClick={() => setEditing(true)}
                  className={ICON_BUTTON_CLASS}
                >
                  <svg {...ICON_PROPS}>
                    <path d="M11.2 2.6a1.6 1.6 0 0 1 2.2 2.2L5.6 12.6l-3 .8.8-3Z" />
                  </svg>
                </button>
              </Tooltip>
              <Tooltip label="Quitar la línea">
                <button
                  type="button"
                  aria-label={`Quitar ${line.name}`}
                  onClick={() => setConfirmingDelete(true)}
                  className={DANGER_ICON_BUTTON_CLASS}
                >
                  <svg {...ICON_PROPS}>
                    <path d="M2.8 4.2h10.4" />
                    <path d="M6.2 4.2V2.8h3.6v1.4" />
                    <path d="M4.2 4.2h7.6l-.6 8.2a.8.8 0 0 1-.8.8H5.6a.8.8 0 0 1-.8-.8Z" />
                  </svg>
                </button>
              </Tooltip>
            </div>
          ) : null}
        </td>
      </tr>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Quitar «${line.name}»`}
        description={`Son ${formatEuros(total)} menos en el presupuesto.`}
        risks={['No se puede deshacer. El concepto sigue en el tarifario: lo que se va es esta línea.']}
        confirmLabel="Quitar línea"
        onConfirm={runDelete}
      />
    </>
  )
}
