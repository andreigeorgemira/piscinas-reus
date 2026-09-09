'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { formatMoney } from '@/lib/price-book/decimal'
import { UNGROUPED_NAME, type PriceBookItem } from '@/lib/price-book/queries'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { idleState, type ActionState } from './action-state'
import { deleteItem, setItemActive, updateItem } from './actions'
import { ConfirmButton } from './confirm-button'
import {
  CELL_CLASS,
  ITEM_TABLE_COLUMN_COUNT,
  ItemFields,
  type GroupOption,
} from './item-fields'

const BUTTON_CLASS =
  'rounded border border-slate-400 px-2 py-1 text-xs whitespace-nowrap hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:outline-blue-400'

const PRIMARY_BUTTON_CLASS = `${BUTTON_CLASS} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300`

export function ItemRow({ item, groups }: { item: PriceBookItem; groups: GroupOption[] }) {
  const [editing, setEditing] = useState(false)
  const [oneClickError, setOneClickError] = useState<string | null>(null)
  const editButton = useRef<HTMLButtonElement>(null)

  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await updateItem(previous, formData)
      // Only a clean save closes the row: an error has to stay next to the
      // fields that caused it. The close goes through startTransition because
      // a state update after an await is not part of the action's transition
      // on its own -- it would commit a frame early, over the table as it was
      // before the write. See
      // node_modules/next/dist/docs/01-app/02-guides/interactive-apps.md.
      if (next.error === null) {
        startTransition(() => setEditing(false))
      }
      return next
    },
    idleState,
  )

  // Closing the editor removes whatever had focus (Guardar or Cancelar), which
  // would drop the caret on <body> and send the next Tab back to the top of
  // the page. Hand it back to the control that opened the editor.
  const wasEditing = useRef(false)
  useEffect(() => {
    if (wasEditing.current && !editing) {
      editButton.current?.focus()
    }
    wasEditing.current = editing
  }, [editing])

  /**
   * setItemActive and deleteItem take (previous, formData); a <form action>
   * hands over only the FormData, so these wrappers supply the seed state.
   * They are plain client functions on purpose -- a Server Function cannot be
   * declared inside a Client Component, so re-marking them 'use server' here
   * would fail to compile.
   */
  async function submitSetActive(formData: FormData) {
    setOneClickError((await setItemActive(idleState, formData)).error)
  }

  async function submitDelete(formData: FormData) {
    setOneClickError((await deleteItem(idleState, formData)).error)
  }

  const formId = `item-${item.id}`
  const groupName = groups.find((group) => group.id === item.groupId)?.name ?? UNGROUPED_NAME
  // A failed save's message belongs to the open editor: Cancelar closes the
  // editor, so the message goes with it rather than hanging under a read-only
  // row that no longer shows what caused it.
  const error = (editing ? saveState.error : null) ?? oneClickError

  return (
    <>
      <tr className={item.isActive ? undefined : 'text-slate-500 dark:text-slate-400'}>
        {editing ? (
          <>
            <ItemFields
              formId={formId}
              groups={groups}
              item={item}
              defaultGroupId={item.groupId}
            />
            <td className={CELL_CLASS}>
              {/*
                Two things about this form. It lives in the actions cell rather
                than around the row: a <form> between <tr> and <td> is hoisted
                out of the table by the parser, so Guardar sits inside it and
                every field in the cells to the left joins it through
                form={formId}. And it refuses the reset React runs on an
                uncontrolled form once a function action settles, which would
                wipe what was typed at the exact moment the action came back
                with an error and the row stayed open to show it.
              */}
              <form
                id={formId}
                action={saveAction}
                onReset={(event) => event.preventDefault()}
                className="flex gap-1"
              >
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className={BUTTON_CLASS}
                >
                  Cancelar
                </button>
              </form>
            </td>
          </>
        ) : (
          <>
            <td className={`${CELL_CLASS} font-mono whitespace-nowrap`}>{item.code ?? '—'}</td>
            <td className={CELL_CLASS}>
              <span>{item.name}</span>
              {item.description ? (
                <span className="block text-xs text-slate-600 dark:text-slate-400">
                  {item.description}
                </span>
              ) : null}
            </td>
            <td className={CELL_CLASS}>{groupName}</td>
            <td className={CELL_CLASS}>{UNIT_LABELS[item.unit]}</td>
            <td className={`${CELL_CLASS} text-right tabular-nums`}>
              {formatMoney(item.unitCost)}
            </td>
            <td className={`${CELL_CLASS} text-right tabular-nums`}>
              {formatMoney(item.unitPrice)}
            </td>
            {/* Text, not only the grey row: colour alone is not a state. */}
            <td className={CELL_CLASS}>{item.isActive ? 'Sí' : 'No'}</td>
            <td className={CELL_CLASS}>
              <div className="flex gap-1">
                <button
                  ref={editButton}
                  type="button"
                  aria-label={`Editar ${item.name}`}
                  onClick={() => {
                    setOneClickError(null)
                    setEditing(true)
                  }}
                  className={BUTTON_CLASS}
                >
                  Editar
                </button>
                <form action={submitSetActive}>
                  <input type="hidden" name="id" value={item.id} />
                  {/*
                    A hidden field spelling out the target state, not a
                    checkbox: setItemActive reads 'true'/'false', and both
                    values are always posted.
                  */}
                  <input type="hidden" name="is_active" value={item.isActive ? 'false' : 'true'} />
                  <button
                    type="submit"
                    aria-label={`${item.isActive ? 'Retirar' : 'Reactivar'} ${item.name}`}
                    className={BUTTON_CLASS}
                  >
                    {item.isActive ? 'Retirar' : 'Reactivar'}
                  </button>
                </form>
                <form action={submitDelete}>
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmButton
                    question={`¿Borrar «${item.name}» del tarifario? No se puede deshacer. Si solo quieres dejar de ofrecerlo, usa Retirar.`}
                  >
                    Borrar
                  </ConfirmButton>
                </form>
              </div>
            </td>
          </>
        )}
      </tr>
      {error ? (
        <tr>
          <td colSpan={ITEM_TABLE_COLUMN_COUNT} className={CELL_CLASS}>
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  )
}
