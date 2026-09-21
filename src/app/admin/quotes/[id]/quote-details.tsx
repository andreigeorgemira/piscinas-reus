'use client'

import Link from 'next/link'
import { startTransition, useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { updateQuote } from '@/app/admin/quotes/actions'
import type { ClientOption } from '@/lib/clients/queries'
import type { QuoteDetail } from '@/lib/quotes/queries'

const LABEL_CLASS = 'text-2xs font-medium tracking-[0.05em] text-muted uppercase'

/** A date as `<input type="date">` wants it, or '' when there is none. */
function dateValue(value: string | null): string {
  return value ?? ''
}

/** A date as Spain writes it: 4 de abril de 2026 is overkill in a side panel. */
function formatDate(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={LABEL_CLASS}>{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

/**
 * Everything about the quote that is not a line: who it is for, when the work
 * starts, how long the offer stands, and the two kinds of notes.
 *
 * It sits in a panel beside the lines rather than above them, because the lines
 * are what this screen is for and a header deep enough to hold seven fields
 * would push them below the fold.
 *
 * Read mode and edit mode, like every other editable thing in this app. The
 * whole panel opens at once -- the fields are read together (a date only means
 * something next to the other one) and four separate inline edits would be four
 * separate saves of the same record.
 */
export function QuoteDetails({
  quote,
  clients,
  editable,
}: {
  quote: QuoteDetail
  /** Every client, for moving a quote to the right one. */
  clients: ClientOption[]
  /** False once the quote has left draft. */
  editable: boolean
}) {
  const [editing, setEditing] = useState(false)
  const clientId = useId()
  const titleId = useId()
  const startId = useId()
  const validId = useId()
  const clientNotesId = useId()
  const internalNotesId = useId()

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await updateQuote(previous, formData)
      if (next.error === null) {
        startTransition(() => setEditing(false))
        toast.success('Presupuesto guardado')
      }
      return next
    },
    idleState,
  )

  if (editing) {
    return (
      <form
        action={formAction}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setEditing(false)
        }}
        className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card"
      >
        <input type="hidden" name="id" value={quote.id} />

        <div className="flex flex-col gap-1">
          <label htmlFor={titleId} className={LABEL_CLASS}>
            Título
          </label>
          <input
            id={titleId}
            name="title"
            defaultValue={quote.title}
            maxLength={200}
            autoFocus
            className={`${FIELD_CLASS} h-8`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={clientId} className={LABEL_CLASS}>
            Cliente
          </label>
          <select
            id={clientId}
            name="client_id"
            defaultValue={quote.client.id}
            className={`${FIELD_CLASS} h-8 cursor-pointer`}
          >
            {/*
              The current client is always an option even if the list is capped
              (listClientOptions stops at 100): a select whose value is missing
              posts the first option instead, which would move the quote to
              whoever happens to sort first.
            */}
            {clients.some((option) => option.id === quote.client.id) ? null : (
              <option value={quote.client.id}>{quote.client.fullName}</option>
            )}
            {clients.map((option) => (
              <option key={option.id} value={option.id}>
                {option.fullName}
                {option.city ? ` · ${option.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={startId} className={LABEL_CLASS}>
              Inicio previsto
            </label>
            <input
              id={startId}
              name="start_date_planned"
              type="date"
              defaultValue={dateValue(quote.startDatePlanned)}
              className={`${FIELD_CLASS} num h-8`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={validId} className={LABEL_CLASS}>
              Válido hasta
            </label>
            <input
              id={validId}
              name="valid_until"
              type="date"
              defaultValue={dateValue(quote.validUntil)}
              className={`${FIELD_CLASS} num h-8`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={clientNotesId} className={LABEL_CLASS}>
            Notas para el cliente
          </label>
          <textarea
            id={clientNotesId}
            name="client_notes"
            defaultValue={quote.clientNotes ?? ''}
            rows={3}
            maxLength={4000}
            placeholder="Condiciones, plazos de pago…"
            className={`${FIELD_CLASS} py-1.5`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={internalNotesId} className={LABEL_CLASS}>
            Notas internas
          </label>
          <textarea
            id={internalNotesId}
            name="internal_notes"
            defaultValue={quote.internalNotes ?? ''}
            rows={2}
            maxLength={4000}
            placeholder="No sale del panel"
            className={`${FIELD_CLASS} py-1.5`}
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-xs text-danger">
            {state.error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className={BUTTON_CLASS}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">Datos</h2>
        {editable ? (
          <button type="button" onClick={() => setEditing(true)} className={BUTTON_CLASS}>
            Editar
          </button>
        ) : null}
      </div>

      <Row label="Cliente">
        <Link
          href={`/admin/clients/${quote.client.id}`}
          className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {quote.client.fullName}
        </Link>
        <span className="block truncate text-xs text-muted">{quote.client.email}</span>
        {quote.client.phone ? (
          <span className="num block text-xs text-muted">{quote.client.phone}</span>
        ) : null}
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Inicio previsto">
          <span className="num">{formatDate(quote.startDatePlanned)}</span>
        </Row>
        <Row label="Válido hasta">
          <span className="num">{formatDate(quote.validUntil)}</span>
        </Row>
      </div>

      {quote.clientNotes ? (
        <Row label="Notas para el cliente">
          <span className="block text-xs whitespace-pre-line text-ink-soft">
            {quote.clientNotes}
          </span>
        </Row>
      ) : null}

      {quote.internalNotes ? (
        <Row label="Notas internas">
          {/*
            Marked, not hidden: the column never reaches a client (the
            client-facing views omit it, 0004_client_views.sql), and the person
            reading this screen needs to know which of the two boxes the client
            will see.
          */}
          <span className="block rounded-md border border-warn/40 bg-warn-soft px-2 py-1.5 text-xs whitespace-pre-line text-warn">
            {quote.internalNotes}
          </span>
        </Row>
      ) : null}
    </div>
  )
}
