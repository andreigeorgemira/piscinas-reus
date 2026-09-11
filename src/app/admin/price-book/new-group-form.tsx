'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from './action-state'
import { createGroup } from './actions'
import { PRIMARY_BUTTON_CLASS } from './ui'

const INLINE_FIELD_CLASS =
  'h-7 rounded-md border border-line bg-surface px-2 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/**
 * Creating a group, at the FOOT of the catalogue.
 *
 * It used to sit above the table, which put a form between a person and the
 * thing they came to read. Everything that adds to this screen is now at the
 * end of what it adds to: a concept at the end of its group, a group at the
 * end of the list of groups.
 */
export function NewGroupForm({ nextPosition }: { nextPosition: number }) {
  const nameId = useId()
  const positionId = useId()
  // Bumped after each success so the fields reset for the next group.
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

  return (
    <div className="flex flex-col gap-1 border-t border-line px-3 py-2">
      <form
        action={formAction}
        // React clears an uncontrolled form once a function action settles, which
        // would throw away the name that was just refused as a duplicate. The
        // reset event is cancelable, so the fields clear on success only, through
        // the key below.
        onReset={(event) => event.preventDefault()}
        className="flex flex-wrap items-center gap-2"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="shrink-0 text-faint"
          aria-hidden="true"
        >
          <path d="M8 3.4v9.2M3.4 8h9.2" />
        </svg>
        <label htmlFor={nameId} className="text-xs whitespace-nowrap text-muted">
          Nuevo grupo
        </label>
        <input
          key={`name-${fieldsKey}`}
          id={nameId}
          name="name"
          maxLength={80}
          placeholder="Climatizacion"
          className={`${INLINE_FIELD_CLASS} w-48`}
        />

        <label htmlFor={positionId} className="sr-only">
          Posición
        </label>
        <input
          key={`position-${fieldsKey}`}
          id={positionId}
          name="position"
          type="number"
          title="Posición en la lista"
          defaultValue={nextPosition}
          min={0}
          max={9999}
          step={1}
          className={`${INLINE_FIELD_CLASS} num w-14 text-right`}
        />

        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? 'Creando…' : 'Crear grupo'}
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
