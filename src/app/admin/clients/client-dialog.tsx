'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { HEADER_PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import type { Client } from '@/lib/clients/queries'
import { createClient, updateClient } from './actions'

const FIELD_CLASS =
  'h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

const LABEL_CLASS = 'text-xs font-medium'

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  maxLength,
  type = 'text',
  inputMode,
  autoFocus,
  className,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  maxLength?: number
  type?: string
  inputMode?: 'text' | 'tel' | 'email' | 'numeric'
  autoFocus?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={FIELD_CLASS}
      />
    </div>
  )
}

/**
 * A client's details, in a dialog.
 *
 * A dialog and not an inline row, unlike the price book: a client is seven
 * fields, and seven fields squeezed into a table row is a row nobody can read
 * and a form nobody can fill. The same dialog does new and existing, because
 * the fields and their rules are the same either way -- only the action and
 * the title differ.
 */
export function ClientDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omitted for a new client. */
  client?: Client
}) {
  const editing = client !== undefined
  const notesId = useId()

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = editing
        ? await updateClient(previous, formData)
        : await createClient(previous, formData)
      if (next.error === null) {
        toast.success(editing ? 'Cliente guardado' : 'Cliente creado')
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
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-3rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-pop">
          <DialogPrimitive.Title className="text-base font-semibold">
            {editing ? client.fullName : 'Nuevo cliente'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="pt-1 text-xs text-muted">
            El correo identifica al cliente: es por donde se le vincula su cuenta del portal.
          </DialogPrimitive.Description>

          {/*
            `key` on the form, tied to the client being edited: React keeps a
            defaultValue from the first render, so without it the dialog opened
            on a second client would show the first one's details.
          */}
          <form key={client?.id ?? 'new'} action={formAction} className="flex flex-col gap-3 pt-4">
            {editing ? <input type="hidden" name="id" value={client.id} /> : null}

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Nombre"
                name="full_name"
                defaultValue={client?.fullName}
                placeholder="Familia Soler"
                maxLength={120}
                autoFocus
              />
              <Field
                label="Correo"
                name="email"
                type="email"
                inputMode="email"
                defaultValue={client?.email}
                placeholder="soler@ejemplo.es"
                maxLength={254}
              />
              <Field
                label="Teléfono"
                name="phone"
                inputMode="tel"
                defaultValue={client?.phone ?? ''}
                placeholder="977 12 34 56"
                maxLength={30}
              />
              <Field
                label="Localidad"
                name="city"
                defaultValue={client?.city ?? ''}
                placeholder="Reus"
                maxLength={80}
              />
              <Field
                label="Dirección"
                name="address"
                defaultValue={client?.address ?? ''}
                placeholder="Camí de la Pedrera 12"
                maxLength={200}
                className="col-span-2"
              />
              <Field
                label="Código postal"
                name="postal_code"
                inputMode="numeric"
                defaultValue={client?.postalCode ?? ''}
                placeholder="43201"
                maxLength={5}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={notesId} className={LABEL_CLASS}>
                Notas
              </label>
              <textarea
                id={notesId}
                name="notes"
                defaultValue={client?.notes ?? ''}
                rows={3}
                maxLength={4000}
                placeholder="Lo que haya que recordar antes de llamar"
                className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              />
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
                {pending ? 'Guardando…' : editing ? 'Guardar' : 'Crear cliente'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** The button that opens the dialog for a client who does not exist yet. */
export function NewClientButton({ label = 'Nuevo cliente' }: { label?: string }) {
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
      <ClientDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/** The pencil in a row, and the dialog it opens on an existing client. */
export function EditClientButton({
  client,
  className,
  children,
  label,
}: {
  client: Client
  className: string
  children: React.ReactNode
  label: string
}) {
  const [open, setOpen] = useState(false)

  // A plain button rather than a DialogTrigger: the row decides where this
  // button sits and what it looks like, and the dialog is a sibling of the
  // whole row rather than a child of the trigger.
  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      <ClientDialog open={open} onOpenChange={setOpen} client={client} />
    </>
  )
}
