'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatEuros } from '@/lib/price-book/decimal'
import {
  movesFrom,
  QUOTE_MOVE_LABELS,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from '@/lib/quotes/status'
import { moveQuoteStatus } from './actions'
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
