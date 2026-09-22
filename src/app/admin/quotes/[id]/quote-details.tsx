'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { startTransition, useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { FIELD_CLASS, HEADER_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { updateQuote } from '@/app/admin/quotes/actions'
import { ClientPicker } from '@/app/admin/quotes/client-picker'
import type { ClientOption } from '@/lib/clients/queries'
import type { QuoteDetail } from '@/lib/quotes/queries'

const LABEL_CLASS = 'text-2xs font-medium tracking-[0.05em] text-muted uppercase'

/**
 * Everything about the quote that is not a line: the client, the dates, and the
 * two kinds of notes.
 *
 * In a dialog, not in a rail beside the table. The single-table editor gives the
 * whole width to the catalogue -- that is the point of it -- and these fields
 * are written once when the quote is opened and then left alone, while a
 * quantity is typed forty times. The facts worth seeing without opening
 * anything (who it is for, until when it is valid) are printed in the header by
 * the page itself.
 */
export function QuoteDetailsButton({
  quote,
  clients,
  editable,
}: {
  quote: QuoteDetail
  /** Every client, for moving a quote to the right one. */
  clients: ClientOption[]
  /** False once the quote has left draft: the fields are then read-only. */
  editable: boolean
}) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const startId = useId()
  const validId = useId()
  const clientNotesId = useId()
  const internalNotesId = useId()

  const fieldsOf = (value: ActionState) => value.fields ?? {}

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await updateQuote(previous, formData)
      if (next.error === null) {
        startTransition(() => setOpen(false))
        toast.success('Presupuesto guardado')
      }
      return next
    },
    idleState,
  )

  const fields = fieldsOf(state)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={HEADER_BUTTON_CLASS}>
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
          <path d="M4 2.8h8v10.4H4z" />
          <path d="M6 5.6h4M6 8h4M6 10.4h2.4" />
        </svg>
        Datos
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-3rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-pop">
            <DialogPrimitive.Title className="text-base font-semibold">
              Datos del presupuesto
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="pt-1 text-xs text-muted">
              {editable
                ? 'Las notas para el cliente salen en el PDF; las internas no salen de aquí.'
                : 'El presupuesto ya no es un borrador: para cambiar estos datos hay que reabrirlo.'}
            </DialogPrimitive.Description>

            <form action={formAction} className="flex flex-col gap-3 pt-4">
              <input type="hidden" name="id" value={quote.id} />

              <div className="flex flex-col gap-1.5">
                <label htmlFor={titleId} className={LABEL_CLASS}>
                  Título
                  <span className="text-danger" title="Obligatorio">
                    {' *'}
                  </span>
                </label>
                <input
                  id={titleId}
                  name="title"
                  defaultValue={quote.title}
                  maxLength={200}
                  disabled={!editable}
                  autoFocus
                  aria-invalid={fields.title ? true : undefined}
                  className={`${FIELD_CLASS} h-9 ${fields.title ? 'border-danger' : ''}`}
                />
                {fields.title ? <p className="text-2xs text-danger">{fields.title}</p> : null}
              </div>

              {editable ? (
                <ClientPicker
                  clients={clients}
                  defaultClient={
                    quote.client ? { id: quote.client.id, fullName: quote.client.fullName } : null
                  }
                  error={fields.clientId}
                  hint="Opcional. Hace falta para aceptarlo: al aceptar nace el proyecto."
                />
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className={LABEL_CLASS}>Cliente</span>
                  <span className="text-sm">
                    {quote.client ? quote.client.fullName : 'Sin cliente'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={startId} className={LABEL_CLASS}>
                    Inicio previsto
                  </label>
                  <input
                    id={startId}
                    name="start_date_planned"
                    type="date"
                    defaultValue={quote.startDatePlanned ?? ''}
                    disabled={!editable}
                    className={`${FIELD_CLASS} num h-9`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={validId} className={LABEL_CLASS}>
                    Válido hasta
                  </label>
                  <input
                    id={validId}
                    name="valid_until"
                    type="date"
                    defaultValue={quote.validUntil ?? ''}
                    disabled={!editable}
                    className={`${FIELD_CLASS} num h-9`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={clientNotesId} className={LABEL_CLASS}>
                  Notas para el cliente
                </label>
                <textarea
                  id={clientNotesId}
                  name="client_notes"
                  defaultValue={quote.clientNotes ?? ''}
                  rows={3}
                  maxLength={4000}
                  disabled={!editable}
                  placeholder="Condiciones, plazos de pago…"
                  className={`${FIELD_CLASS} py-1.5`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={internalNotesId} className={LABEL_CLASS}>
                  Notas internas
                </label>
                <textarea
                  id={internalNotesId}
                  name="internal_notes"
                  defaultValue={quote.internalNotes ?? ''}
                  rows={2}
                  maxLength={4000}
                  disabled={!editable}
                  placeholder="No sale del panel"
                  className={`${FIELD_CLASS} border-warn/40 bg-warn-soft py-1.5`}
                />
              </div>

              {state.error ? (
                <p role="alert" className="text-xs text-danger">
                  {state.error}
                </p>
              ) : null}

              <div className="flex items-center gap-2 pt-1">
                <span className="text-2xs text-faint">
                  <span className="text-danger">*</span> obligatorio
                </span>
                <div className="ml-auto flex gap-2">
                  <DialogPrimitive.Close asChild>
                    <button
                      type="button"
                      className="flex h-8 items-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink-soft hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {editable ? 'Cancelar' : 'Cerrar'}
                    </button>
                  </DialogPrimitive.Close>
                  {editable ? (
                    <button
                      type="submit"
                      disabled={pending}
                      className="flex h-8 items-center rounded-md border border-ink bg-ink px-3 text-xs font-medium text-canvas hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
                    >
                      {pending ? 'Guardando…' : 'Guardar'}
                    </button>
                  ) : null}
                </div>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
