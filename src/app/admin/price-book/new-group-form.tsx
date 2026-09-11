'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { idleState, type ActionState } from './action-state'
import { createGroup } from './actions'
import { PRIMARY_BUTTON_CLASS } from './ui'

const INLINE_FIELD_CLASS =
  'h-6 rounded border border-line bg-surface px-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/**
 * Creating a group lives in the toolbar, so it is drawn as one control
 * cluster inside a single border rather than as two labelled fields and a
 * button floating beside the filters.
 *
 * The name keeps a visible label. Position does not: it is a number a staff
 * member changes once in a while, the field is pre-filled with the right
 * answer, and spelling it out in the strip would cost more room than it is
 * worth -- so it carries an accessible name and a tooltip instead.
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
      }
      return next
    },
    idleState,
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        // React clears an uncontrolled form once a function action settles, which
        // would throw away the name that was just refused as a duplicate. The
        // reset event is cancelable, so the fields clear on success only, through
        // the key below.
        onReset={(event) => event.preventDefault()}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1 pl-2.5"
      >
        <label htmlFor={nameId} className="text-2xs whitespace-nowrap text-muted">
          Nuevo grupo
        </label>
        <input
          key={`name-${fieldsKey}`}
          id={nameId}
          name="name"
          maxLength={80}
          placeholder="Revestimiento"
          className={`${INLINE_FIELD_CLASS} w-40 placeholder:text-faint`}
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
          className={`${INLINE_FIELD_CLASS} num w-12 text-right`}
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
