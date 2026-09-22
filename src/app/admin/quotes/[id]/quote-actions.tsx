'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { HEADER_BUTTON_CLASS, HEADER_PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { deleteQuote, moveQuoteStatus } from '@/app/admin/quotes/actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatEuros } from '@/lib/price-book/decimal'
import type { QuoteDetail } from '@/lib/quotes/queries'
import { movesFrom, QUOTE_MOVE_LABELS, type QuoteStatus } from '@/lib/quotes/status'

/**
 * The buttons that move a quote through its life, and the one that ends it.
 *
 * Which buttons exist comes from movesFrom() (src/lib/quotes/status.ts), which
 * mirrors set_quote_status in the database. Two of the moves ask first, and for
 * opposite reasons: accepting creates a project, and returning to draft kills
 * the link a client may be looking at. Sending and rejecting are a keystroke,
 * because both are reversible from this same strip.
 */
export function QuoteActions({ quote }: { quote: QuoteDetail }) {
  const [confirming, setConfirming] = useState<QuoteStatus | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startAction] = useTransition()

  function move(status: QuoteStatus) {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', quote.id)
        data.set('status', status)
        const result = await moveQuoteStatus(idleState, data)
        if (result.error) toast.error(result.error)
        else if (status === 'accepted') toast.success('Presupuesto aceptado. Proyecto creado.')
        else if (status === 'draft') toast.success('Presupuesto reabierto. El enlace anterior ya no vale.')
        else toast.success(`Presupuesto marcado como ${QUOTE_MOVE_LABELS[status].toLowerCase().replace('marcar como ', '')}`)
        resolve()
      })
    })
  }

  function runDelete() {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', quote.id)
        // On success this redirects to the list, so nothing after it runs.
        const result = await deleteQuote(idleState, data)
        if (result.error) toast.error(result.error)
        resolve()
      })
    })
  }

  return (
    <>
      {movesFrom(quote.status).map((status) => {
        const asks = status === 'accepted' || status === 'draft'
        const primary = status === 'sent' || status === 'accepted'
        return (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => (asks ? setConfirming(status) : void move(status))}
            className={primary ? HEADER_PRIMARY_BUTTON_CLASS : HEADER_BUTTON_CLASS}
          >
            {QUOTE_MOVE_LABELS[status]}
          </button>
        )
      })}

      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmingDelete(true)}
        className={HEADER_BUTTON_CLASS}
      >
        Borrar
      </button>

      <ConfirmDialog
        open={confirming === 'accepted'}
        onOpenChange={(open) => setConfirming(open ? 'accepted' : null)}
        tone="normal"
        title={`Marcar ${quote.reference} como aceptado`}
        description={`El cliente acepta ${formatEuros(quote.totals.grandTotal)}.`}
        risks={[
          'Se crea el proyecto con su propia referencia (P-año-nnnn), a nombre de este cliente.',
          'Las líneas siguen congeladas: para cambiarlas hay que volver a borrador.',
        ]}
        confirmLabel="Marcar como aceptado"
        onConfirm={() => move('accepted')}
      />

      <ConfirmDialog
        open={confirming === 'draft'}
        onOpenChange={(open) => setConfirming(open ? 'draft' : null)}
        title={`Volver ${quote.reference} a borrador`}
        description="Se vuelve a poder editar, y a cambio el enlace que tenga el cliente deja de funcionar."
        risks={[
          'El enlace público cambia: el que ya esté enviado no abrirá nada.',
          'Se borran las marcas de enviado y de respuesta.',
          quote.project
            ? `El proyecto ${quote.project.reference} sigue existiendo: reabrir el papeleo no deshace la obra.`
            : 'Habrá que volver a enviarlo cuando esté listo.',
        ]}
        confirmLabel="Volver a borrador"
        onConfirm={() => move('draft')}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Borrar ${quote.reference}`}
        description={
          quote.client ? `«${quote.title}», de ${quote.client.fullName}.` : `«${quote.title}».`
        }
        risks={[
          `Se borran sus ${quote.items.length} ${quote.items.length === 1 ? 'línea' : 'líneas'}. No se puede deshacer.`,
          'El enlace público deja de funcionar.',
          quote.project
            ? `El proyecto ${quote.project.reference} NO se borra: queda sin presupuesto asociado.`
            : 'El cliente y el tarifario no se tocan.',
        ]}
        confirmLabel="Borrar presupuesto"
        onConfirm={runDelete}
      />
    </>
  )
}
