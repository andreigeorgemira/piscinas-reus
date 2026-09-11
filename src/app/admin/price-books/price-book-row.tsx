'use client'

import Link from 'next/link'
import { startTransition, useActionState, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { idleState, type ActionState } from '@/app/admin/price-book/action-state'
import {
  DANGER_ICON_BUTTON_CLASS,
  FIELD_CLASS,
  ICON_BUTTON_CLASS,
} from '@/app/admin/price-book/ui'
import type { PriceBook } from '@/lib/price-book/queries'
import { deletePriceBook, updatePriceBook } from './actions'

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

const CELL_CLASS = 'border-b border-line-soft px-3 py-2.5 align-middle'

/**
 * One catalogue in the list.
 *
 * Renaming happens in the row, like everything else in this app: the name
 * and the description turn into fields where they stand, and the rest of the
 * table does not move.
 */
export function PriceBookRow({ book }: { book: PriceBook }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [, startAction] = useTransition()
  const editButton = useRef<HTMLButtonElement>(null)

  const [state, saveAction, saving] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await updatePriceBook(previous, formData)
      if (next.error === null) {
        startTransition(() => setEditing(false))
        toast.success('Tarifario guardado')
      }
      return next
    },
    idleState,
  )

  function runDelete() {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', book.id)
        const result = await deletePriceBook(idleState, data)
        if (result.error) toast.error(result.error)
        else toast.error(`Tarifario «${book.name}» borrado`)
        resolve()
      })
    })
  }

  if (editing) {
    return (
      <tr className="bg-canvas">
        <td className={CELL_CLASS} colSpan={2}>
          <form
            id={`book-${book.id}`}
            action={saveAction}
            onReset={(event) => event.preventDefault()}
            className="flex flex-col gap-1.5"
          >
            <input type="hidden" name="id" value={book.id} />
            <input
              name="name"
              aria-label="Nombre del tarifario"
              defaultValue={book.name}
              maxLength={80}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(false)
              }}
              className={`${FIELD_CLASS} w-full max-w-sm font-medium`}
            />
            <input
              name="description"
              aria-label="Descripción del tarifario"
              defaultValue={book.description ?? ''}
              maxLength={300}
              placeholder="Para qué sirve este tarifario"
              className={`${FIELD_CLASS} w-full max-w-lg text-xs`}
            />
            {state.error ? (
              <p role="alert" className="text-xs text-danger">
                {state.error}
              </p>
            ) : null}
          </form>
        </td>
        <td className={`${CELL_CLASS} num text-right text-muted`}>{book.groupCount}</td>
        <td className={`${CELL_CLASS} num text-right text-muted`}>{book.itemCount}</td>
        <td className={CELL_CLASS}>
          <div className="flex items-center justify-end gap-1">
            <button
              type="submit"
              form={`book-${book.id}`}
              disabled={saving}
              aria-label="Guardar el tarifario"
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
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr className="group/row transition-colors hover:bg-surface-hover">
        <td className={CELL_CLASS} colSpan={2}>
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/admin/price-books/${book.id}`}
              className="w-fit font-medium hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {book.name}
            </Link>
            {book.description ? (
              <span className="truncate text-xs text-faint" title={book.description}>
                {book.description}
              </span>
            ) : null}
          </div>
        </td>
        <td className={`${CELL_CLASS} num text-right text-muted`}>{book.groupCount}</td>
        <td className={`${CELL_CLASS} num text-right font-medium`}>{book.itemCount}</td>
        <td className={CELL_CLASS}>
          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
            <Tooltip label="Renombrar">
              <button
                ref={editButton}
                type="button"
                aria-label={`Renombrar ${book.name}`}
                onClick={() => setEditing(true)}
                className={ICON_BUTTON_CLASS}
              >
                <svg {...ICON_PROPS}>
                  <path d="M11.2 2.6a1.6 1.6 0 0 1 2.2 2.2L5.6 12.6l-3 .8.8-3Z" />
                </svg>
              </button>
            </Tooltip>
            <Tooltip label="Borrar tarifario">
              <button
                type="button"
                aria-label={`Borrar ${book.name}`}
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
        </td>
      </tr>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Borrar el tarifario «${book.name}»`}
        description="Se va el catálogo entero, no solo el nombre."
        risks={[
          `Se borran sus ${book.groupCount} grupos y sus ${book.itemCount} conceptos. No se puede deshacer.`,
          'Los presupuestos ya hechos no cambian: cada línea guardó su nombre, su unidad y su precio cuando se escribió.',
          'Lo que pierden esos presupuestos es el enlace con el catálogo, igual que cuando se borra un concepto suelto.',
        ]}
        confirmLabel="Borrar tarifario"
        onConfirm={runDelete}
      />
    </>
  )
}
