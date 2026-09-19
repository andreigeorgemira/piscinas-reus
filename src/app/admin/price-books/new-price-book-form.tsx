'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/price-book/action-state'
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { createPriceBook } from './actions'

/**
 * Creating a catalogue: the same disclosure at the foot of the list that
 * creating a group is at the foot of a catalogue.
 */
export function NewPriceBookForm() {
  const nameId = useId()
  const descriptionId = useId()
  const [open, setOpen] = useState(false)
  const [fieldsKey, setFieldsKey] = useState(0)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await createPriceBook(previous, formData)
      if (next.error === null) {
        startTransition(() => setFieldsKey((key) => key + 1))
        toast.success('Tarifario creado')
      }
      return next
    },
    idleState,
  )

  if (!open) {
    return (
      <div className="border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="text-faint"
            aria-hidden="true"
          >
            <path d="M8 3.4v9.2M3.4 8h9.2" />
          </svg>
          Nuevo tarifario
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 border-t border-line px-3 py-2">
      <form
        action={formAction}
        onReset={(event) => event.preventDefault()}
        className="flex flex-wrap items-center gap-2"
      >
        <label htmlFor={nameId} className="text-xs whitespace-nowrap text-muted">
          Nombre
        </label>
        <input
          key={`name-${fieldsKey}`}
          id={nameId}
          name="name"
          maxLength={80}
          autoFocus
          placeholder="Mantenimiento"
          className={`${FIELD_CLASS} h-7 w-48`}
        />
        <label htmlFor={descriptionId} className="text-xs whitespace-nowrap text-muted">
          Descripción
        </label>
        <input
          key={`description-${fieldsKey}`}
          id={descriptionId}
          name="description"
          maxLength={300}
          placeholder="Opcional"
          className={`${FIELD_CLASS} h-7 w-72`}
        />
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? 'Creando…' : 'Crear tarifario'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={BUTTON_CLASS}>
          Cancelar
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
