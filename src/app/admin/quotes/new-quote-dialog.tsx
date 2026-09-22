'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useActionState, useId, useState } from 'react'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { HEADER_PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import type { ClientOption } from '@/lib/clients/queries'
import { createQuote } from './actions'
import { ClientPicker, type PickedClient } from './client-picker'

const FIELD_CLASS =
  'h-9 rounded-md border bg-surface px-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/**
 * The three things a quote needs before it can be opened, and no more.
 *
 * Not the reference and not the token: the database allocates both
 * (0013_quote_lifecycle.sql). Not the lines either -- they are what the editor
 * is for, and a dialog that asked for them would be the editor in a box. And
 * not, since 0014_quote_without_client.sql, a client: the price comes first and
 * the name when there is one.
 *
 * The fields are controlled on purpose. React resets an uncontrolled form once
 * its action returns, so a refused save used to hand back an empty dialog and
 * everything typed had to be typed again to fix one field. Now a refusal marks
 * the box that caused it and changes nothing else.
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
  /** Every client, for the picker. */
  clients?: ClientOption[]
  /** The client this quote is for, when the screen already knows. */
  client?: PickedClient
}) {
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

          {/*
            The form is its own component so its state is born with the dialog:
            Radix unmounts closed content, so each opening starts blank without
            an effect clearing anything (which is a cascading render).
          */}
          <QuoteForm clients={clients} client={client} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function QuoteForm({ clients, client }: { clients?: ClientOption[]; client?: PickedClient }) {
  const titleId = useId()
  const startId = useId()
  const validId = useId()
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [validUntil, setValidUntil] = useState('')

  const [state, formAction, pending] = useActionState<ActionState, FormData>(createQuote, idleState)
  const fields = state.fields ?? {}

  return (
    <form action={formAction} className="flex flex-col gap-3 pt-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="text-xs font-medium">
          Título
          <span className="text-danger" title="Obligatorio">
            {' *'}
          </span>
        </label>
        <input
          id={titleId}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          required
          autoFocus
          aria-invalid={fields.title ? true : undefined}
          aria-describedby={fields.title ? `${titleId}-error` : undefined}
          placeholder="Piscina 8x4 con gresite"
          className={`${FIELD_CLASS} ${fields.title ? 'border-danger' : 'border-line'}`}
        />
        {fields.title ? (
          <p id={`${titleId}-error`} className="text-2xs text-danger">
            {fields.title}
          </p>
        ) : null}
      </div>

      {client ? (
        <input type="hidden" name="client_id" value={client.id} />
      ) : (
        <ClientPicker clients={clients ?? []} error={fields.clientId} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={startId} className="text-xs font-medium">
            Inicio previsto
          </label>
          <input
            id={startId}
            name="start_date_planned"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            aria-invalid={fields.startDatePlanned ? true : undefined}
            className={`${FIELD_CLASS} num ${fields.startDatePlanned ? 'border-danger' : 'border-line'}`}
          />
          {fields.startDatePlanned ? (
            <p className="text-2xs text-danger">{fields.startDatePlanned}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={validId} className="text-xs font-medium">
            Válido hasta
          </label>
          <input
            id={validId}
            name="valid_until"
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
            aria-invalid={fields.validUntil ? true : undefined}
            className={`${FIELD_CLASS} num ${fields.validUntil ? 'border-danger' : 'border-line'}`}
          />
          {fields.validUntil ? <p className="text-2xs text-danger">{fields.validUntil}</p> : null}
        </div>
      </div>

      {/*
        The summary line, under the per-field marks: a refusal that belongs to no
        single box (a database error) still has to be said.
      */}
      {state.error && Object.keys(fields).length === 0 ? (
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
      </div>
    </form>
  )
}

/** The button that opens the dialog, wherever a quote can be started. */
export function NewQuoteButton({
  clients,
  client,
  label = 'Nuevo presupuesto',
}: {
  clients?: ClientOption[]
  client?: PickedClient
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
