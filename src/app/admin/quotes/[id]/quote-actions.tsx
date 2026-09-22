'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { deleteQuote } from '@/app/admin/quotes/actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { QuoteDetail } from '@/lib/quotes/queries'

/**
 * Deleting the quote you are looking at.
 *
 * The only thing left of what used to be a strip of status buttons in the
 * header. Sending, accepting, rejecting and reopening moved to the quote list,
 * where they are done one row at a time without opening anything: those are
 * decisions about a document somebody already read, and the editor is where the
 * document is written. It also leaves room for what those moves will really be
 * later -- send an email, produce a PDF, hand the client a link to sign.
 */
export function DeleteQuoteButton({ quote }: { quote: QuoteDetail }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startAction] = useTransition()

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
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(true)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs text-muted transition-colors hover:border-danger hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.8 4.2h10.4" />
          <path d="M6.2 4.2V2.8h3.6v1.4" />
          <path d="M4.2 4.2h7.6l-.6 8.2a.8.8 0 0 1-.8.8H5.6a.8.8 0 0 1-.8-.8Z" />
        </svg>
        Borrar
      </button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
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
