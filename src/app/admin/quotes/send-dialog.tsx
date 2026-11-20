'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { sendQuoteToClient, type SendQuoteState } from './actions'

/** What the dialog needs to know about the quote it is about to send. */
export type SendableQuote = {
  id: string
  reference: string
  title: string
  clientName: string | null
  clientEmail: string | null
  publicUrl: string
  /** 'sent' means this is a reminder rather than a first send. */
  status: string
}

/**
 * Sending the quote, and the one place that says what sending does.
 *
 * Three things the office should see before pressing it: who it goes to, what
 * the client will read, and the link itself -- which is also the way out when
 * there is no mail server configured or the client says it never arrived.
 *
 * The status move lives in the action, not here: marking it sent and emailing it
 * are one decision, and a screen that let them come apart would produce quotes
 * that are 'sent' with no message and messages pointing at drafts.
 */
export function SendQuoteDialog({
  quote,
  open,
  onOpenChange,
}: {
  quote: SendableQuote
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const messageId = useId()
  const linkId = useId()
  const resend = quote.status === 'sent'

  const [state, formAction, pending] = useActionState<SendQuoteState, FormData>(
    async (previous, formData) => {
      const next = await sendQuoteToClient(previous, formData)
      if (next.error === null) {
        if (next.skipped) {
          toast.success(
            `${quote.reference} marcado como enviado. No hay servidor de correo configurado: copia el enlace y mándalo tú.`,
          )
        } else {
          toast.success(`${quote.reference} enviado a ${quote.clientEmail}`)
        }
        onOpenChange(false)
      }
      return next
    },
    idleState,
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 shadow-pop">
          <DialogPrimitive.Title className="text-base font-semibold">
            {resend ? `Reenviar ${quote.reference}` : `Enviar ${quote.reference}`}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="pt-1 text-xs text-muted">
            {quote.clientEmail
              ? `Va a ${quote.clientName} · ${quote.clientEmail}`
              : 'Este presupuesto no tiene cliente con correo todavía.'}
          </DialogPrimitive.Description>

          <form action={formAction} className="flex flex-col gap-3 pt-4">
            <input type="hidden" name="id" value={quote.id} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor={messageId} className="text-xs font-medium">
                Mensaje (opcional)
              </label>
              <textarea
                id={messageId}
                name="message"
                rows={3}
                maxLength={2000}
                placeholder="Te llamo el martes para concretar fechas."
                className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              />
              <p className="text-2xs text-faint">
                El correo lleva la referencia, el total, la validez y el enlace para firmar.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={linkId} className="text-xs font-medium">
                Enlace del cliente
              </label>
              <div className="flex gap-2">
                <input
                  id={linkId}
                  readOnly
                  value={quote.publicUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="num h-9 flex-1 rounded-md border border-line bg-surface-sunk px-2.5 text-xs text-muted"
                />
                <CopyButton url={quote.publicUrl} />
              </div>
              {!resend ? (
                <p className="text-2xs text-faint">
                  El enlace empieza a funcionar cuando se envía: enviar marca el presupuesto como
                  enviado y congela sus líneas.
                </p>
              ) : null}
            </div>

            {state.error ? (
              <p role="alert" className="text-xs text-danger">
                {state.error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="flex h-8 items-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink-soft hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Cancelar
                </button>
              </DialogPrimitive.Close>
              <button
                type="submit"
                disabled={pending || !quote.clientEmail}
                className="flex h-8 items-center rounded-md border border-ink bg-ink px-3 text-xs font-medium text-canvas hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
              >
                {pending ? 'Enviando…' : resend ? 'Reenviar correo' : 'Enviar al cliente'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Copying the link.
 *
 * `navigator.clipboard` needs a secure context, which a review server on plain
 * http over an IP address is not, so the failure is caught and the box is
 * selected instead: the person can copy it themselves and nothing looks broken.
 */
export function CopyButton({ url, label = 'Copiar' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
          toast.success('Enlace copiado')
        } catch {
          toast.error('El navegador no ha dejado copiar. Selecciona el enlace y cópialo a mano.')
        }
      }}
      className="flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
        {copied ? (
          <path d="m3.2 8.4 3.2 3.2 6.4-6.8" />
        ) : (
          <>
            <path d="M5.6 5.6V3.4h7.2v7.2h-2.2" />
            <path d="M3.2 5.6h7.2v7.2H3.2z" />
          </>
        )}
      </svg>
      {copied ? 'Copiado' : label}
    </button>
  )
}
