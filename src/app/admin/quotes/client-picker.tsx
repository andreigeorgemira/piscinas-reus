'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ClientDialog } from '@/app/admin/clients/client-dialog'
import type { ClientOption } from '@/lib/clients/queries'

/** The client a quote is for, when it has one. */
export type PickedClient = { id: string; fullName: string }

/**
 * Who the quote is for, chosen by typing the name -- and created on the spot
 * when the name is not on the list yet.
 *
 * Three things this replaces a `<select>` with, and why:
 *
 * - It can be left empty. A price is quoted over the phone before anybody has
 *   taken a name down, and demanding the client first puts the paperwork in
 *   front of the work (0014_quote_without_client.sql).
 * - It is typed into, not scrolled through. Past a hundred clients a select is
 *   a list nobody can find a name in.
 * - "Crear «lo que has escrito»" opens the client form in a dialog ON TOP of
 *   this one, and the client it creates lands selected here. Going to the
 *   clients screen to create a record, then coming back and starting the quote
 *   again, was the long way round a two-field form.
 */
export function ClientPicker({
  clients,
  defaultClient = null,
  error,
  label = 'Cliente',
  hint = 'Opcional: puedes asignarlo más tarde.',
}: {
  clients: ClientOption[]
  defaultClient?: PickedClient | null
  /** The message this field earned from the server, if any. */
  error?: string
  label?: string
  hint?: string
}) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [selected, setSelected] = useState<PickedClient | null>(defaultClient)
  const [term, setTerm] = useState(defaultClient?.fullName ?? '')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  /** A click outside closes the list, the way every combo box does. */
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const needle = term.trim().toLowerCase()
  const matches = clients
    .filter(
      (client) =>
        needle === '' ||
        client.fullName.toLowerCase().includes(needle) ||
        client.email.toLowerCase().includes(needle) ||
        (client.city ?? '').toLowerCase().includes(needle),
    )
    .slice(0, 8)

  const exact = clients.some((client) => client.fullName.toLowerCase() === needle)

  function choose(client: PickedClient) {
    setSelected(client)
    setTerm(client.fullName)
    setOpen(false)
  }

  function clear() {
    setSelected(null)
    setTerm('')
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-medium">
        {label}
      </label>

      <div ref={box} className="relative">
        {/* The value the form actually posts. Empty means no client, which is a
            state the database allows and the quote screen says out loud. */}
        <input type="hidden" name="client_id" value={selected?.id ?? ''} />

        {/*
          A plain text box with a list of buttons under it, and deliberately NOT
          an ARIA combobox: a real one promises arrow-key navigation through
          options and announces the active one, and half of that is worse than
          none. The list is reachable by Tab like any other buttons, and Enter in
          the box takes the first match.
        */}
        <div
          className={`flex h-9 items-center gap-2 rounded-md border bg-surface px-2.5 focus-within:ring-2 focus-within:ring-accent/25 ${
            error ? 'border-danger' : selected ? 'border-accent/50' : 'border-line'
          }`}
        >
          {selected ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-accent"
              aria-hidden="true"
            >
              <circle cx="8" cy="5.6" r="2.6" />
              <path d="M3 13.4c0-2.3 2.2-3.8 5-3.8s5 1.5 5 3.8" />
            </svg>
          ) : null}

          <input
            id={inputId}
            type="text"
            value={term}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setTerm(event.target.value)
              // Typing over a chosen name un-chooses it: the hidden field must
              // never say a client the box no longer shows.
              if (selected && event.target.value !== selected.fullName) setSelected(null)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'Enter' && open && matches[0]) {
                event.preventDefault()
                choose(matches[0])
              }
            }}
            placeholder="Escribe un nombre, o déjalo en blanco"
            className="w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />

          {term ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Quitar el cliente"
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          ) : null}
        </div>

        {open ? (
          <div className="absolute top-full left-0 z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop">
            {matches.length > 0 ? (
              <ul>
                {matches.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      onClick={() => choose({ id: client.id, fullName: client.fullName })}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{client.fullName}</span>
                        <span className="block truncate text-2xs text-faint">{client.email}</span>
                      </span>
                      {client.city ? (
                        <span className="shrink-0 text-2xs text-muted">{client.city}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-2 text-xs text-muted">Ningún cliente con ese nombre.</p>
            )}

            {/*
              The way out of the dead end: the name is already typed, so creating
              the client is one dialog away and it comes back selected.
            */}
            {needle !== '' && !exact ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setCreating(true)
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-line px-2 py-2 text-left text-xs font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M8 3.4v9.2M3.4 8h9.2" />
                </svg>
                Crear el cliente «{term.trim()}»
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} className="text-2xs text-danger">
          {error}
        </p>
      ) : (
        <p className="text-2xs text-faint">{hint}</p>
      )}

      {/* A dialog on top of the dialog that opened this. Radix stacks them and
          returns focus here when the top one closes. */}
      <ClientDialog
        open={creating}
        onOpenChange={setCreating}
        defaultName={term.trim()}
        onCreated={choose}
      />
    </div>
  )
}
