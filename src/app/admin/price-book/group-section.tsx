'use client'

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react'
import type { PriceBookGroup } from '@/lib/price-book/queries'
import { idleState, type ActionState } from './action-state'
import { createItem, deleteGroup, updateGroup } from './actions'
import { ConfirmButton } from './confirm-button'
import {
  CELL_CLASS,
  ITEM_COLUMNS,
  ITEM_TABLE_COLUMN_COUNT,
  ItemFields,
  type GroupOption,
} from './item-fields'
import { ItemRow } from './item-row'

const BUTTON_CLASS =
  'rounded border border-slate-400 px-2 py-1 text-xs whitespace-nowrap hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:outline-blue-400'

const PRIMARY_BUTTON_CLASS = `${BUTTON_CLASS} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300`

const FIELD_CLASS =
  'rounded border border-slate-400 bg-transparent px-1.5 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 dark:border-slate-600 dark:focus-visible:outline-blue-400'

/**
 * Deleting a group never deletes a price: price_book_items.group_id is
 * `on delete set null`, so the items reappear under "Sin grupo". Staff still
 * need to hear how many rows are about to move.
 */
function deleteQuestion(name: string, itemCount: number): string {
  if (itemCount === 0) {
    return `¿Borrar el grupo «${name}»? No tiene ningún concepto.`
  }
  if (itemCount === 1) {
    return `¿Borrar el grupo «${name}»? Su concepto no se borra: pasa a «Sin grupo».`
  }
  return `¿Borrar el grupo «${name}»? Sus ${itemCount} conceptos no se borran: pasan a «Sin grupo».`
}

/**
 * What an action returned, plus which opening of the form asked for it.
 *
 * useActionState keeps its last state after the form closes, so a message
 * from a refused write outlives the fields that caused it. Stamping the
 * session it belongs to -- and bumping that session on every open and every
 * close -- is what stops it rendering, and being announced again, over the
 * freshly defaulted fields of the next opening.
 */
type FormState = ActionState & { session: number }

/** Seed state for the above: -1 belongs to no opening, so it never matches one. */
const idleFormState: FormState = { ...idleState, session: -1 }

export function GroupSection({
  group,
  groups,
}: {
  group: PriceBookGroup
  groups: GroupOption[]
}) {
  const headingId = useId()
  const newItemFormId = useId()

  const [renamer, setRenamer] = useState({ open: false, session: 0 })
  const [adder, setAdder] = useState({ open: false, session: 0 })

  const renaming = renamer.open
  const adding = adder.open

  function setRenaming(open: boolean) {
    setRenamer((current) => ({ open, session: current.session + 1 }))
  }

  function setAdding(open: boolean) {
    setAdder((current) => ({ open, session: current.session + 1 }))
  }

  // Bumped after each insert so the new-item row remounts with empty fields,
  // ready for the next one. Staff enter a catalogue in runs, not one row a day.
  const [newItemKey, setNewItemKey] = useState(0)
  const renameButton = useRef<HTMLButtonElement>(null)

  const [renameState, renameAction, renamingPending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const next = await updateGroup(previous, formData)
      // startTransition, because a state update after an await is not part of
      // the action's transition on its own: it would commit a frame before the
      // revalidated table arrives, on the previous render's data. See
      // node_modules/next/dist/docs/01-app/02-guides/interactive-apps.md.
      if (next.error === null) {
        startTransition(() => setRenaming(false))
      }
      return { ...next, session: renamer.session }
    },
    idleFormState,
  )

  const [deleteState, deleteAction] = useActionState(deleteGroup, idleState)

  const [addState, addAction, addPending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const next = await createItem(previous, formData)
      // Inside a transition so the blank row and the revalidated table commit
      // together; see the note in the rename action above.
      if (next.error === null) {
        startTransition(() => setNewItemKey((key) => key + 1))
      }
      return { ...next, session: adder.session }
    },
    idleFormState,
  )

  // Closing the rename form takes the focused control with it; hand focus back
  // to the button that opened it rather than dropping it on <body>.
  const wasRenaming = useRef(false)
  useEffect(() => {
    if (wasRenaming.current && !renaming) {
      renameButton.current?.focus()
    }
    wasRenaming.current = renaming
  }, [renaming])

  // The "Sin grupo" bucket is not a group anyone created: there is no row to
  // rename and none to delete.
  const groupId = group.id
  // Only the messages the current openings produced. A failed delete has no
  // form to open or close, so its message has no session and simply stays.
  const renameError = renameState.session === renamer.session ? renameState.error : null
  const addError = addState.session === adder.session ? addState.error : null
  const groupError = renameError ?? deleteState.error

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          {group.name}
        </h2>
        <button
          type="button"
          aria-label={`Añadir concepto a ${group.name}`}
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
          className={BUTTON_CLASS}
        >
          + Concepto
        </button>
        {groupId === null ? null : (
          <>
            <button
              ref={renameButton}
              type="button"
              aria-label={`Renombrar ${group.name}`}
              aria-expanded={renaming}
              onClick={() => setRenaming(!renaming)}
              className={BUTTON_CLASS}
            >
              Renombrar
            </button>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={groupId} />
              <ConfirmButton question={deleteQuestion(group.name, group.items.length)}>
                Borrar grupo
              </ConfirmButton>
            </form>
          </>
        )}
      </div>

      {renaming && groupId !== null ? (
        <form
          action={renameAction}
          onReset={(event) => event.preventDefault()}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="id" value={groupId} />
          <input
            name="name"
            aria-label="Nombre"
            defaultValue={group.name}
            maxLength={80}
            autoFocus
            className={FIELD_CLASS}
          />
          <input
            name="position"
            type="number"
            aria-label="Posición"
            defaultValue={group.position}
            min={0}
            max={9999}
            step={1}
            className={`${FIELD_CLASS} w-24`}
          />
          <button type="submit" disabled={renamingPending} className={PRIMARY_BUTTON_CLASS}>
            {renamingPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setRenaming(false)} className={BUTTON_CLASS}>
            Cancelar
          </button>
        </form>
      ) : null}

      {groupError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {groupError}
        </p>
      ) : null}

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Conceptos de {group.name}</caption>
        <thead>
          <tr>
            {ITEM_COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={`border-b border-slate-400 px-2 py-1.5 font-medium dark:border-slate-600 ${
                  column.numeric ? 'text-right' : 'text-left'
                }`}
              >
                {column.label}
              </th>
            ))}
            <th
              scope="col"
              className="border-b border-slate-400 px-2 py-1.5 text-left font-medium dark:border-slate-600"
            >
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {group.items.map((item) => (
            <ItemRow key={item.id} item={item} groups={groups} />
          ))}

          {adding ? (
            <>
              <tr key={newItemKey}>
                <ItemFields
                  formId={newItemFormId}
                  groups={groups}
                  defaultGroupId={groupId}
                />
                <td className={CELL_CLASS}>
                  {/*
                    Same two reasons as the edit row: the form cannot wrap the
                    cells, and it must not clear itself when a write is refused.
                  */}
                  <form
                    id={newItemFormId}
                    action={addAction}
                    onReset={(event) => event.preventDefault()}
                  >
                    <button type="submit" disabled={addPending} className={PRIMARY_BUTTON_CLASS}>
                      {addPending ? 'Añadiendo…' : 'Añadir'}
                    </button>
                  </form>
                </td>
              </tr>
              {addError ? (
                <tr>
                  <td colSpan={ITEM_TABLE_COLUMN_COUNT} className={CELL_CLASS}>
                    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                      {addError}
                    </p>
                  </td>
                </tr>
              ) : null}
            </>
          ) : null}

          {group.items.length === 0 && !adding ? (
            <tr>
              <td
                colSpan={ITEM_TABLE_COLUMN_COUNT}
                className={`${CELL_CLASS} text-slate-600 dark:text-slate-400`}
              >
                Este grupo no tiene conceptos.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  )
}
