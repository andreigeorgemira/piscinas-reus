'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from './action-state'
import { createGroup } from './actions'
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS } from './ui'

/**
 * Creating a group, at the FOOT of the catalogue and behind a disclosure.
 *
 * It used to sit above the table, which put a form between a person and the
 * thing they came to read; then it sat below it as a permanent row of
 * fields, which is a form nobody asked for taking up the last line of every
 * screen. Now it is the same gesture as adding a concept: a quiet "+" at the
 * end of what it adds to, which opens the field when it is wanted.
 *
 * The position is not a field. It is filled with the next free slot, and the
 * one time in fifty that it matters, the group's own rename form has it.
 */
export function NewGroupForm({ nextPosition }: { nextPosition: number }) {
  const nameId = useId()
  const [open, setOpen] = useState(false)
  // Bumped after each success so the field resets for the next group.
  const [fieldsKey, setFieldsKey] = useState(0)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await createGroup(previous, formData)
      // startTransition, because a state update after an await is not part of
      // the action's transition on its own: it would commit a frame before the
      // revalidated table arrives, on the previous render's data. See
      // node_modules/next/dist/docs/01-app/02-guides/interactive-apps.md.
      if (next.error === null) {
        startTransition(() => setFieldsKey((key) => key + 1))
        toast.success('Grupo creado')
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
          Nuevo grupo
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 border-t border-line px-3 py-2">
      <form
        action={formAction}
        // React clears an uncontrolled form once a function action settles, which
        // would throw away the name that was just refused as a duplicate. The
        // reset event is cancelable, so the field clears on success only, through
        // the key below.
        onReset={(event) => event.preventDefault()}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="position" value={nextPosition} />
        <label htmlFor={nameId} className="text-xs whitespace-nowrap text-muted">
          Nombre del grupo
        </label>
        <input
          key={`name-${fieldsKey}`}
          id={nameId}
          name="name"
          maxLength={80}
          autoFocus
          placeholder="Climatizacion"
          className={`${FIELD_CLASS} h-7 w-56`}
        />
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? 'Creando…' : 'Crear grupo'}
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
