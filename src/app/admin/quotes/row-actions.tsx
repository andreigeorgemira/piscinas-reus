'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip } from '@/components/ui/tooltip'
import { formatEuros } from '@/lib/price-book/decimal'
import {
  movesFrom,
  QUOTE_MOVE_LABELS,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from '@/lib/quotes/status'
import { deleteQuote, duplicateQuote, moveQuoteStatus } from './actions'
import { StatusBadge } from './status-badge'

/** What a list row needs to hand to its own controls. */
export type QuoteRowSummary = {
  id: string
  reference: string
  title: string
  status: QuoteStatus
  clientName: string | null
  lineCount: number
  projectReference: string | null
  grandTotal: number
}

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

const ROW_BUTTON_CLASS =
  'flex size-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60'

/**
 * The status, changed where it is read.
 *
 * This used to be a strip of buttons inside the editor, which is the wrong room
 * for it: marking a quote as sent or accepted is bookkeeping about a document
 * somebody has already written, and it is done for one of twenty rows while
 * looking at the list. So the badge is the control -- click it, pick the move --
 * and the editor is left for writing.
 *
 * Which moves exist comes from movesFrom() (src/lib/quotes/status.ts), which
 * mirrors set_quote_status in the database. Two of them ask first, for opposite
 * reasons: accepting creates a project, and returning to draft kills the link the
 * client may be holding.
 */
export function QuoteStatusControl({ quote }: { quote: QuoteRowSummary }) {
  const [confirming, setConfirming] = useState<QuoteStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, startAction] = useTransition()

  function move(status: QuoteStatus) {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', quote.id)
        data.set('status', status)
        const result = await moveQuoteStatus(idleState, data)
        if (result.error) toast.error(result.error)
        else if (status === 'accepted') toast.success(`${quote.reference} aceptado. Proyecto creado.`)
        else if (status === 'draft')
          toast.success(`${quote.reference} vuelve a borrador. El enlace anterior ya no vale.`)
        else
          toast.success(
            `${quote.reference}: ${QUOTE_STATUS_LABELS[status].toLowerCase()}`,
          )
        resolve()
      })
    })
  }

  const moves = movesFrom(quote.status)

  return (
    <>
      {/* relative z-10: the row is one big link, stretched with ::after, and
          these controls have to sit above it to keep their own clicks. */}
      <div className="relative z-10 inline-flex">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={pending}
              aria-label={`Cambiar el estado de ${quote.reference}`}
              className="flex items-center gap-1 rounded-full transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
            >
              <StatusBadge status={quote.status} />
              <svg {...ICON_PROPS} width={11} height={11} className="text-faint">
                <path d="m4.4 6.2 3.6 3.6 3.6-3.6" />
              </svg>
            </button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-56 p-1">
            <p className="px-2 py-1.5 text-2xs text-faint">
              {`Ahora: ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()}`}
            </p>
            {moves.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (status === 'accepted' || status === 'draft') {
                    setConfirming(status)
                    return
                  }
                  void move(status)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <StatusBadge status={status} />
                {QUOTE_MOVE_LABELS[status]}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <ConfirmDialog
        open={confirming === 'accepted'}
        onOpenChange={(value) => setConfirming(value ? 'accepted' : null)}
        tone="normal"
        title={`Marcar ${quote.reference} como aceptado`}
        description={`${quote.clientName ?? 'Sin cliente'} acepta ${formatEuros(quote.grandTotal)}.`}
        risks={[
          'Se crea el proyecto con su propia referencia (P-año-nnnn), a nombre de este cliente.',
          'Sin cliente asignado no se puede aceptar: el proyecto es de alguien.',
        ]}
        confirmLabel="Marcar como aceptado"
        onConfirm={() => move('accepted')}
      />

      <ConfirmDialog
        open={confirming === 'draft'}
        onOpenChange={(value) => setConfirming(value ? 'draft' : null)}
        title={`Volver ${quote.reference} a borrador`}
        description="Se vuelve a poder editar, y a cambio el enlace que tenga el cliente deja de funcionar."
        risks={[
          'El enlace público cambia: el que ya esté enviado no abrirá nada.',
          'Se borran las marcas de enviado y de respuesta.',
          quote.projectReference
            ? `El proyecto ${quote.projectReference} sigue existiendo: reabrir el papeleo no deshace la obra.`
            : 'Habrá que volver a marcarlo como enviado cuando esté listo.',
        ]}
        confirmLabel="Volver a borrador"
        onConfirm={() => move('draft')}
      />
    </>
  )
}

/**
 * What can be done to a quote without opening it: copy it, or get rid of it.
 *
 * Duplicating is the one that earns its place. The next quote is usually the last
 * one with two numbers changed, and doing that by hand meant ticking forty
 * concepts again.
 */
export function QuoteRowActions({ quote }: { quote: QuoteRowSummary }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startAction] = useTransition()

  function runDuplicate() {
    startAction(async () => {
      const data = new FormData()
      data.set('id', quote.id)
      const result = await duplicateQuote(idleState, data)
      if (result.error) toast.error(result.error)
      else toast.success(`Copiado en ${result.reference}`)
    })
  }

  function runDelete() {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', quote.id)
        const result = await deleteQuote(idleState, data)
        if (result.error) toast.error(result.error)
        else toast.error(`${quote.reference} borrado`)
        resolve()
      })
    })
  }

  return (
    <>
      <div className="relative z-10 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
        <Tooltip label="Duplicar">
          <button
            type="button"
            disabled={pending}
            onClick={runDuplicate}
            aria-label={`Duplicar ${quote.reference}`}
            className={ROW_BUTTON_CLASS}
          >
            <svg {...ICON_PROPS}>
              <path d="M5.6 5.6V3.4h7.2v7.2h-2.2" />
              <path d="M3.2 5.6h7.2v7.2H3.2z" />
            </svg>
          </button>
        </Tooltip>

        <Tooltip label="Borrar presupuesto">
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Borrar ${quote.reference}`}
            className={`${ROW_BUTTON_CLASS} hover:border-danger hover:bg-danger-soft hover:text-danger`}
          >
            <svg {...ICON_PROPS}>
              <path d="M2.8 4.2h10.4" />
              <path d="M6.2 4.2V2.8h3.6v1.4" />
              <path d="M4.2 4.2h7.6l-.6 8.2a.8.8 0 0 1-.8.8H5.6a.8.8 0 0 1-.8-.8Z" />
            </svg>
          </button>
        </Tooltip>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Borrar ${quote.reference}`}
        description={`«${quote.title}»${quote.clientName ? `, de ${quote.clientName}` : ''}.`}
        risks={[
          `Se borran sus ${quote.lineCount} ${quote.lineCount === 1 ? 'línea' : 'líneas'}. No se puede deshacer.`,
          'El enlace público deja de funcionar.',
          quote.projectReference
            ? `El proyecto ${quote.projectReference} NO se borra: queda sin presupuesto asociado.`
            : 'El cliente y el tarifario no se tocan.',
        ]}
        confirmLabel="Borrar presupuesto"
        onConfirm={runDelete}
      />
    </>
  )
}
