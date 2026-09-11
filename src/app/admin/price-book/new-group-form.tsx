'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { idleState, type ActionState } from './action-state'
import { createGroup } from './actions'
import { FIELD_CLASS, PRIMARY_BUTTON_CLASS } from './ui'

/**
 * Creating a group is a standalone form, not a table row, so its fields carry
 * visible labels rather than the aria-labels the dense rows rely on. They sit
 * beside the fields instead of above them: this form lives in the toolbar,
 * and stacked labels would cost the strip twice the height for two words.
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
    <form
      action={formAction}
      // React clears an uncontrolled form once a function action settles, which
      // would throw away the name that was just refused as a duplicate. The
      // reset event is cancelable, so the fields clear on success only, through
      // the key below.
      onReset={(event) => event.preventDefault()}
      className="flex items-center gap-2"
    >
      <label htmlFor={nameId} className="text-[11px] whitespace-nowrap text-muted">
        Nuevo grupo
      </label>
      <input
        key={`name-${fieldsKey}`}
        id={nameId}
        name="name"
        maxLength={80}
        className={`${FIELD_CLASS} h-[26px] w-40 shrink-0 py-0`}
      />

      <label htmlFor={positionId} className="text-[11px] whitespace-nowrap text-muted">
        Posición
      </label>
      <input
        key={`position-${fieldsKey}`}
        id={positionId}
        name="position"
        type="number"
        defaultValue={nextPosition}
        min={0}
        max={9999}
        step={1}
        className={`${FIELD_CLASS} num h-[26px] w-16 shrink-0 py-0`}
      />

      <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
        {pending ? 'Creando…' : 'Crear grupo'}
      </button>

      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
