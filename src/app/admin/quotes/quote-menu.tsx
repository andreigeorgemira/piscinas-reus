'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { deleteQuote, duplicateQuote } from './actions'
import { SendQuoteDialog, type SendableQuote } from './send-dialog'

/** Everything the menu offers to do with one quote. */
export type MenuQuote = SendableQuote & {
  lineCount: number
  projectReference: string | null
}

const ITEM_CLASS =
  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent'

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
 * Everything that can be done to a quote without editing it, behind one button.
 *
 * Five separate icons in a table row is a row nobody reads, and the same five in
 * the editor's toolbar is a toolbar that wraps. They are also not equally
 * common: sending is the whole point, the rest are occasional. So the menu holds
 * them and the screens put "Enviar" outside it when there is room.
 *
 * The same component serves the list and the editor deliberately: the wording of
 * a destructive confirmation should not depend on which screen it was reached
 * from.
 */
export function QuoteMenu({
  quote,
  align = 'end',
}: {
  quote: MenuQuote
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(quote.publicUrl)
      toast.success('Enlace copiado')
    } catch {
      toast.error('El navegador no ha dejado copiar. Ábrelo desde Enviar y cópialo de ahí.')
    }
  }

  const answered = quote.status === 'accepted' || quote.status === 'rejected'

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={pending}
            aria-label={`Acciones de ${quote.reference}`}
            className="flex size-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60"
          >
            <svg {...ICON_PROPS} strokeWidth={2}>
              <circle cx="3.4" cy="8" r="0.9" fill="currentColor" />
              <circle cx="8" cy="8" r="0.9" fill="currentColor" />
              <circle cx="12.6" cy="8" r="0.9" fill="currentColor" />
            </svg>
          </button>
        </PopoverTrigger>

        <PopoverContent align={align} className="w-56 p-1">
          {!answered ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setSending(true)
              }}
              className={ITEM_CLASS}
            >
              <svg {...ICON_PROPS}>
                <path d="M13.6 2.6 7.4 8.8" />
                <path d="M13.6 2.6 9.6 13.4l-2.2-4.6-4.6-2.2Z" />
              </svg>
              {quote.status === 'sent' ? 'Reenviar al cliente' : 'Enviar al cliente'}
            </button>
          ) : null}

          <button type="button" onClick={copyLink} className={ITEM_CLASS}>
            <svg {...ICON_PROPS}>
              <path d="M6.6 9.4a2.4 2.4 0 0 0 3.4 0l2.2-2.2a2.4 2.4 0 1 0-3.4-3.4l-.6.6" />
              <path d="M9.4 6.6a2.4 2.4 0 0 0-3.4 0L3.8 8.8a2.4 2.4 0 1 0 3.4 3.4l.6-.6" />
            </svg>
            Copiar enlace del cliente
          </button>

          {quote.status !== 'draft' ? (
            <a href={quote.publicUrl} target="_blank" rel="noreferrer" className={ITEM_CLASS}>
              <svg {...ICON_PROPS}>
                <path d="M3 8s2-3.6 5-3.6S13 8 13 8s-2 3.6-5 3.6S3 8 3 8Z" />
                <circle cx="8" cy="8" r="1.4" />
              </svg>
              Ver la página del cliente
            </a>
          ) : null}

          <a
            href={`/admin/quotes/${quote.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className={ITEM_CLASS}
          >
            <svg {...ICON_PROPS}>
              <path d="M8 2.6v7.2" />
              <path d="M5.2 7 8 9.8 10.8 7" />
              <path d="M2.8 11.4v1.2a.8.8 0 0 0 .8.8h8.8a.8.8 0 0 0 .8-.8v-1.2" />
            </svg>
            Ver el PDF
          </a>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              runDuplicate()
            }}
            className={ITEM_CLASS}
          >
            <svg {...ICON_PROPS}>
              <path d="M5.6 5.6V3.4h7.2v7.2h-2.2" />
              <path d="M3.2 5.6h7.2v7.2H3.2z" />
            </svg>
            Duplicar
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setConfirmingDelete(true)
            }}
            className={`${ITEM_CLASS} text-danger hover:bg-danger-soft`}
          >
            <svg {...ICON_PROPS}>
              <path d="M2.8 4.2h10.4" />
              <path d="M6.2 4.2V2.8h3.6v1.4" />
              <path d="M4.2 4.2h7.6l-.6 8.2a.8.8 0 0 1-.8.8H5.6a.8.8 0 0 1-.8-.8Z" />
            </svg>
            Borrar presupuesto
          </button>
        </PopoverContent>
      </Popover>

      <SendQuoteDialog quote={quote} open={sending} onOpenChange={setSending} />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Borrar ${quote.reference}`}
        description={`«${quote.title}»${quote.clientName ? `, de ${quote.clientName}` : ''}.`}
        risks={[
          `Se borran sus ${quote.lineCount} ${quote.lineCount === 1 ? 'línea' : 'líneas'}. No se puede deshacer.`,
          'El enlace del cliente deja de funcionar.',
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

/** The send button the screens put outside the menu, where there is room. */
export function SendQuoteButton({
  quote,
  className,
}: {
  quote: SendableQuote
  className: string
}) {
  const [open, setOpen] = useState(false)
  const answered = quote.status === 'accepted' || quote.status === 'rejected'

  if (answered) return null

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13.6 2.6 7.4 8.8" />
          <path d="M13.6 2.6 9.6 13.4l-2.2-4.6-4.6-2.2Z" />
        </svg>
        {quote.status === 'sent' ? 'Reenviar' : 'Enviar al cliente'}
      </button>
      <SendQuoteDialog quote={quote} open={open} onOpenChange={setOpen} />
    </>
  )
}
