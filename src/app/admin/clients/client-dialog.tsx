'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useActionState, useId, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { HEADER_PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import type { Client } from '@/lib/clients/queries'
import { createClient, updateClient, type ClientFormState } from './actions'

const FIELD_CLASS =
  'h-9 rounded-md border bg-surface px-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

const LABEL_CLASS = 'text-xs font-medium'

type Values = {
  full_name: string
  email: string
  phone: string
  city: string
  address: string
  postal_code: string
  notes: string
}

function valuesOf(client: Client | undefined, defaultName: string): Values {
  return {
    full_name: client?.fullName ?? defaultName,
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    city: client?.city ?? '',
    address: client?.address ?? '',
    postal_code: client?.postalCode ?? '',
    notes: client?.notes ?? '',
  }
}

/**
 * One field of the client form.
 *
 * Controlled, which is the whole point: a form submitted through `action` has
 * its uncontrolled inputs reset by React once the action returns, so a refused
 * save used to hand back an empty dialog and the person retyped seven fields to
 * fix one. Holding the values here means a refusal changes nothing but the
 * message under the box that caused it.
 */
function Field({
  label,
  name,
  value,
  onChange,
  error,
  required,
  placeholder,
  maxLength,
  type = 'text',
  inputMode,
  autoFocus,
  className,
}: {
  label: string
  name: keyof Values
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  placeholder?: string
  maxLength?: number
  type?: string
  inputMode?: 'text' | 'tel' | 'email' | 'numeric'
  autoFocus?: boolean
  className?: string
}) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
        {required ? (
          <span className="text-danger" title="Obligatorio">
            {' *'}
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${FIELD_CLASS} ${error ? 'border-danger' : 'border-line'}`}
      />
      {error ? (
        <p id={errorId} className="text-2xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A client's details, in a dialog.
 *
 * A dialog and not an inline row, unlike the price book: a client is seven
 * fields, and seven fields squeezed into a table row is a row nobody can read
 * and a form nobody can fill. The same dialog does new and existing, because the
 * fields and their rules are the same either way -- only the action, the title
 * and what happens afterwards differ.
 */
export function ClientDialog({
  open,
  onOpenChange,
  client,
  defaultName = '',
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omitted for a new client. */
  client?: Client
  /** Seeds the name, for "crear «lo que acabas de escribir»". */
  defaultName?: string
  /** Called with the new client, for whoever opened this to use it. */
  onCreated?: (created: { id: string; fullName: string }) => void
}) {
  const editing = client !== undefined

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
            The form is a component of its own so that its state is born with the
            dialog: Radix unmounts closed content, so opening the dialog for a
            second client mounts a fresh form with that client's details. The
            earlier version kept the values in this component and cleared them
            from an effect, which is a cascading render the compiler rightly
            complains about.
          */}
          <ClientForm
            client={client}
            defaultName={defaultName}
            onSaved={(created) => {
              if (created) onCreated?.(created)
              onOpenChange(false)
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ClientForm({
  client,
  defaultName,
  onSaved,
}: {
  client?: Client
  defaultName: string
  onSaved: (created?: { id: string; fullName: string }) => void
}) {
  const editing = client !== undefined
  const notesId = useId()
  const [values, setValues] = useState<Values>(() => valuesOf(client, defaultName))

  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    async (previous, formData) => {
      const next = editing
        ? await updateClient(previous, formData)
        : await createClient(previous, formData)

      if (next.error === null) {
        toast.success(editing ? 'Cliente guardado' : 'Cliente creado')
        onSaved(next.created)
      }
      return next
    },
    idleState,
  )

  const fields = state.fields ?? {}

  function set(name: keyof Values) {
    return (value: string) => setValues((current) => ({ ...current, [name]: value }))
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 pt-4">
      {editing ? <input type="hidden" name="id" value={client.id} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Nombre"
          name="full_name"
          required
          value={values.full_name}
          onChange={set('full_name')}
          error={fields.fullName}
          placeholder="Familia Soler"
          maxLength={120}
          autoFocus
        />
        <Field
          label="Correo"
          name="email"
          required
          type="email"
          inputMode="email"
          value={values.email}
          onChange={set('email')}
          error={fields.email}
          placeholder="soler@ejemplo.es"
          maxLength={254}
        />
        <Field
          label="Teléfono"
          name="phone"
          inputMode="tel"
          value={values.phone}
          onChange={set('phone')}
          error={fields.phone}
          placeholder="977 12 34 56"
          maxLength={30}
        />
        <Field
          label="Localidad"
          name="city"
          value={values.city}
          onChange={set('city')}
          error={fields.city}
          placeholder="Reus"
          maxLength={80}
        />
        <Field
          label="Dirección"
          name="address"
          value={values.address}
          onChange={set('address')}
          error={fields.address}
          placeholder="Camí de la Pedrera 12"
          maxLength={200}
          className="col-span-2"
        />
        <Field
          label="Código postal"
          name="postal_code"
          inputMode="numeric"
          value={values.postal_code}
          onChange={set('postal_code')}
          error={fields.postalCode}
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
          value={values.notes}
          onChange={(event) => set('notes')(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Lo que haya que recordar antes de llamar"
          className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </div>

      {/*
        The one-line summary stays, under the per-field marks: a database refusal
        (a duplicate email) belongs to the form, not to a box.
      */}
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
      </div>
    </form>
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
  children: ReactNode
  label: string
}) {
  const [open, setOpen] = useState(false)

  // A plain button rather than a DialogTrigger: the row decides where this
  // button sits and what it looks like, and the dialog is a sibling of the whole
  // row rather than a child of the trigger.
  return (
    <>
      <button type="button" aria-label={label} onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <ClientDialog open={open} onOpenChange={setOpen} client={client} />
    </>
  )
}
