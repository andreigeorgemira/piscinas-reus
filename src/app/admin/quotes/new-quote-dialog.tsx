'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useActionState, useId, useState } from 'react'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { HEADER_PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import type { ClientOption } from '@/lib/clients/queries'
import { createQuote } from './actions'

const FIELD_CLASS =
  'h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

const LABEL_CLASS = 'text-xs font-medium'

/**
 * The four things a quote needs before it can be opened, and no more.
 *
 * Not the reference and not the token: the database allocates both
 * (0013_quote_lifecycle.sql). Not the lines either -- they are what the editor
 * is for, and a dialog that asked for them would be the editor in a box.
 *
 * On success this does not close: createQuote redirects to the new quote, so the
 * dialog leaves with the page.
 */
export function NewQuoteDialog({
  open,
  onOpenChange,
  clients,
  client,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Every client, for the picker. Ignored when `client` is given. */
  clients?: ClientOption[]
  /** The client this quote is for, when the screen already knows. */
  client?: { id: string; fullName: string }
}) {
  const titleId = useId()
  const clientId = useId()
  const startId = useId()
  const validId = useId()

  const [state, formAction, pending] = useActionState<ActionState, FormData>(createQuote, idleState)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 shadow-pop">
          <DialogPrimitive.Title className="text-base font-semibold">
            Nuevo presupuesto
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="pt-1 text-xs text-muted">
            {client
              ? `Para ${client.fullName}. La referencia la pone la base de datos.`
              : 'La referencia la pone la base de datos al crearlo.'}
          </DialogPrimitive.Description>

          <form action={formAction} className="flex flex-col gap-3 pt-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={titleId} className={LABEL_CLASS}>
                Título
              </label>
              <input
                id={titleId}
                name="title"
                maxLength={200}
                autoFocus
                placeholder="Piscina 8x4 con gresite"
                className={FIELD_CLASS}
              />
            </div>

            {client ? (
              <input type="hidden" name="client_id" value={client.id} />
            ) : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={clientId} className={LABEL_CLASS}>
                  Cliente
                </label>
                <select
                  id={clientId}
                  name="client_id"
                  defaultValue=""
                  className={`${FIELD_CLASS} cursor-pointer`}
                >
                  {/*
                    An empty first option, so the form cannot be submitted with
                    whoever happens to sort first. The schema refuses '' with
                    "El cliente no es válido", which is the right message for a
                    field nobody filled.
                  */}
                  <option value="">Elige un cliente…</option>
                  {(clients ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.fullName}
                      {option.city ? ` · ${option.city}` : ''}
                    </option>
                  ))}
                </select>
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
                  className={`${FIELD_CLASS} num`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={validId} className={LABEL_CLASS}>
                  Válido hasta
                </label>
                <input id={validId} name="valid_until" type="date" className={`${FIELD_CLASS} num`} />
              </div>
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
                disabled={pending}
                className="flex h-8 items-center rounded-md border border-ink bg-ink px-3 text-xs font-medium text-canvas hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
              >
                {pending ? 'Creando…' : 'Crear y abrir'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** The button that opens the dialog, wherever a quote can be started. */
export function NewQuoteButton({
  clients,
  client,
  label = 'Nuevo presupuesto',
}: {
  clients?: ClientOption[]
  client?: { id: string; fullName: string }
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={HEADER_PRIMARY_BUTTON_CLASS}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M8 3.4v9.2M3.4 8h9.2" />
        </svg>
        {label}
      </button>
      <NewQuoteDialog open={open} onOpenChange={setOpen} clients={clients} client={client} />
    </>
  )
}
