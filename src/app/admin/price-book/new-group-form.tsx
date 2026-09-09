'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { idleState, type ActionState } from './action-state'
import { createGroup } from './actions'

const FIELD_CLASS =
  'rounded border border-slate-400 bg-transparent px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 dark:border-slate-600 dark:focus-visible:outline-blue-400'

/**
 * Creating a group is a standalone form, not a table row, so its fields carry
 * visible labels rather than the aria-labels the dense rows rely on.
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
      className="flex flex-wrap items-end gap-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-sm font-medium">
          Nuevo grupo
        </label>
        <input
          key={`name-${fieldsKey}`}
          id={nameId}
          name="name"
          maxLength={80}
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={positionId} className="text-sm font-medium">
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
          className={`${FIELD_CLASS} w-24`}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 dark:focus-visible:outline-blue-400"
      >
        {pending ? 'Creando…' : 'Crear grupo'}
      </button>

      {state.error ? (
        <p role="alert" className="w-full text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
