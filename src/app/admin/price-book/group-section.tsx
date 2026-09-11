'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import type { PriceBookGroup } from '@/lib/price-book/queries'
import { idleState, type ActionState } from './action-state'
import { createItem, deleteGroup, updateGroup } from './actions'
import { ConfirmButton } from './confirm-button'
import {
  CELL_CLASS,
  ITEM_TABLE_COLUMN_COUNT,
  ItemFields,
  type GroupOption,
} from './item-fields'
import { ItemRow } from './item-row'
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS } from './ui'

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

/**
 * One group of the catalogue, as a rowgroup of the single price-book table.
 *
 * A <tbody>, not a table of its own: a table per group repeated the whole
 * column header every few rows, which on a real catalogue is the loudest
 * thing on the screen. `aria-label` gives the rowgroup the group's name, so
 * the structure a screen reader hears is the one on screen.
 */
export function GroupSection({
  group,
  groups,
}: {
  group: PriceBookGroup
  groups: GroupOption[]
}) {
  const newItemFormId = `new-item-${group.id ?? 'ungrouped'}`

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
    <tbody aria-label={group.name} className="group/section">
      <tr className="bg-surface-sunk">
        <th
          scope="colgroup"
          colSpan={ITEM_TABLE_COLUMN_COUNT}
          className="border-y border-line px-3 py-1.5 text-left font-medium"
        >
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-faint"
              aria-hidden="true"
            >
              <path d="M1.9 4.6a1 1 0 0 1 1-1h3l1.4 1.6h5.8a1 1 0 0 1 1 1v6.2a1 1 0 0 1-1 1H2.9a1 1 0 0 1-1-1Z" />
            </svg>
            <span className="text-xs font-semibold tracking-[0.04em] text-ink uppercase">
              {group.name}
            </span>
            <span className="num rounded-full bg-surface px-1.5 text-2xs text-muted">
              {group.items.length}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                aria-label={`Añadir concepto a ${group.name}`}
                aria-expanded={adding}
                onClick={() => setAdding(!adding)}
                className={BUTTON_CLASS}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M8 3.4v9.2M3.4 8h9.2" />
                </svg>
                Concepto
              </button>
              {groupId === null ? null : (
                // Renaming and deleting a group are rare and one of them is
                // destructive, so they wait for the pointer or the keyboard to
                // reach this rowgroup. Adding a concept is the reason staff
                // open this screen, so it never hides. Opacity rather than
                // `hidden`: both stay in the tab order, and focus-within
                // brings them back for anyone not using a mouse.
                <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
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
                </div>
              )}
            </div>
          </div>
        </th>
      </tr>

      {renaming && groupId !== null ? (
        <tr>
          <td colSpan={ITEM_TABLE_COLUMN_COUNT} className="border-b border-line-soft bg-canvas p-3">
            <form
              action={renameAction}
              onReset={(event) => event.preventDefault()}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="id" value={groupId} />
              <label className="flex flex-col gap-1">
                <span className="text-2xs text-muted">Nombre</span>
                <input
                  name="name"
                  aria-label="Nombre"
                  defaultValue={group.name}
                  maxLength={80}
                  autoFocus
                  className={`${FIELD_CLASS} w-56 shrink-0`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-2xs text-muted">Posición</span>
                <input
                  name="position"
                  type="number"
                  aria-label="Posición"
                  defaultValue={group.position}
                  min={0}
                  max={9999}
                  step={1}
                  className={`${FIELD_CLASS} num w-20 shrink-0`}
                />
              </label>
              <button type="submit" disabled={renamingPending} className={PRIMARY_BUTTON_CLASS}>
                {renamingPending ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setRenaming(false)} className={BUTTON_CLASS}>
                Cancelar
              </button>
            </form>
          </td>
        </tr>
      ) : null}

      {groupError ? (
        <tr>
          <td colSpan={ITEM_TABLE_COLUMN_COUNT} className="border-b border-line-soft px-3 py-2">
            <p role="alert" className="text-sm text-danger">
              {groupError}
            </p>
          </td>
        </tr>
      ) : null}

      {group.items.map((item) => (
        <ItemRow key={item.id} item={item} groups={groups} />
      ))}

      {adding ? (
        <>
          <tr key={newItemKey} className="bg-canvas">
            <ItemFields formId={newItemFormId} groups={groups} defaultGroupId={groupId} />
            <td className={CELL_CLASS}>
              {/*
                Same two reasons as the edit row: the form cannot wrap the
                cells, and it must not clear itself when a write is refused.
              */}
              <form
                id={newItemFormId}
                action={addAction}
                onReset={(event) => event.preventDefault()}
                className="flex flex-col gap-1.5"
              >
                <button type="submit" disabled={addPending} className={PRIMARY_BUTTON_CLASS}>
                  {addPending ? 'Añadiendo…' : 'Añadir'}
                </button>
                <button type="button" onClick={() => setAdding(false)} className={BUTTON_CLASS}>
                  Cancelar
                </button>
              </form>
            </td>
          </tr>
          {addError ? (
            <tr>
              <td colSpan={ITEM_TABLE_COLUMN_COUNT} className="border-b border-line-soft px-3 py-2">
                <p role="alert" className="text-sm text-danger">
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
            className="border-b border-line-soft px-3 py-3 text-sm text-muted"
          >
            Este grupo no tiene conceptos.
          </td>
        </tr>
      ) : null}
    </tbody>
  )
}
