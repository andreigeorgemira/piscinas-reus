'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { formatMoney } from '@/lib/price-book/decimal'
import type { PriceBookItem } from '@/lib/price-book/queries'
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
import {
  BUTTON_CLASS,
  DANGER_ICON_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from './ui'

const ICON_PROPS = {
  width: 13,
  height: 13,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/**
 * What updateItem returned, plus which opening of the editor asked for it.
 *
 * useActionState keeps its last state after the editor closes, so a message
 * from a refused save outlives the fields that caused it. Stamping the
 * session it belongs to -- and bumping that session on every open and every
 * close -- is what stops it rendering, and being announced again, over the
 * freshly defaulted fields of the next opening.
 */
type SaveState = ActionState & { session: number }

export function ItemRow({ item, groups }: { item: PriceBookItem; groups: GroupOption[] }) {
  const [editor, setEditor] = useState({ open: false, session: 0 })
  const [oneClickError, setOneClickError] = useState<string | null>(null)
  const editButton = useRef<HTMLButtonElement>(null)

  const editing = editor.open

  function setEditing(open: boolean) {
    setEditor((current) => ({ open, session: current.session + 1 }))
  }

  const [saveState, saveAction, saving] = useActionState<SaveState, FormData>(
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
      return { ...next, session: editor.session }
    },
    // -1 belongs to no opening, so the seed state can never match one.
    { ...idleState, session: -1 },
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
  // Only the message this opening of the editor produced. Every open and every
  // close moves the session on, so a message left behind by an editor that was
  // cancelled cannot reappear over the next one's clean fields.
  const error = (saveState.session === editor.session ? saveState.error : null) ?? oneClickError

  return (
    <>
      <tr className={`group hover:bg-canvas ${item.isActive ? '' : 'text-muted'}`}>
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
                className="flex flex-col gap-1"
              >
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setEditing(false)} className={BUTTON_CLASS}>
                  Cancelar
                </button>
              </form>
            </td>
          </>
        ) : (
          <>
            <td className={`${CELL_CLASS} h-[34px] font-mono text-xs whitespace-nowrap text-muted`}>
              {item.code ?? '—'}
            </td>
            <td className={CELL_CLASS}>
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="font-medium whitespace-nowrap">{item.name}</span>
                {item.description ? (
                  <span className="truncate text-[11.5px] text-faint">{item.description}</span>
                ) : null}
              </div>
            </td>
            <td className={`${CELL_CLASS} text-xs text-muted`}>{UNIT_LABELS[item.unit]}</td>
            <td className={`${CELL_CLASS} num text-right text-muted`}>
              {formatMoney(item.unitCost)}
            </td>
            <td className={`${CELL_CLASS} num text-right font-medium`}>
              {formatMoney(item.unitPrice)}
            </td>
            {/* Text, not only the grey row: colour alone is not a state. */}
            <td className={CELL_CLASS}>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-px text-[11px] ${
                  item.isActive
                    ? 'border-line bg-surface-sunk text-ink-soft'
                    : 'border-warn/40 bg-warn-soft text-warn'
                }`}
              >
                {item.isActive ? 'Sí' : 'No'}
              </span>
            </td>
            <td className={CELL_CLASS}>
              {/*
                The actions sit at 0 opacity until the row is hovered or
                something inside it takes focus, so ten rows of buttons do not
                compete with ten rows of prices. Opacity, not `hidden`: the
                buttons stay in the tab order and in the accessibility tree,
                and focus-within brings them back for anyone not using a mouse.
              */}
              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  ref={editButton}
                  type="button"
                  aria-label={`Editar ${item.name}`}
                  onClick={() => {
                    setOneClickError(null)
                    setEditing(true)
                  }}
                  className={ICON_BUTTON_CLASS}
                >
                  <svg {...ICON_PROPS}>
                    <path d="M11.2 2.6a1.6 1.6 0 0 1 2.2 2.2L5.6 12.6l-3 .8.8-3Z" />
                  </svg>
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
                    className={ICON_BUTTON_CLASS}
                  >
                    {item.isActive ? (
                      <svg {...ICON_PROPS}>
                        <path d="M2.2 5.4h11.6v7.2a.8.8 0 0 1-.8.8H3a.8.8 0 0 1-.8-.8Z" />
                        <path d="M1.6 2.6h12.8v2.8H1.6Z" />
                        <path d="M6.4 8.8h3.2" />
                      </svg>
                    ) : (
                      <svg {...ICON_PROPS}>
                        <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
                        <path d="M13.6 2.4v3.2h-3.2" />
                      </svg>
                    )}
                  </button>
                </form>
                <form action={submitDelete}>
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmButton
                    label={`Borrar ${item.name}`}
                    className={DANGER_ICON_BUTTON_CLASS}
                    question={`¿Borrar «${item.name}» del tarifario? No se puede deshacer. Si solo quieres dejar de ofrecerlo, usa Retirar.`}
                  >
                    <svg {...ICON_PROPS}>
                      <path d="M2.8 4.2h10.4" />
                      <path d="M6.2 4.2V2.8h3.6v1.4" />
                      <path d="M4.2 4.2h7.6l-.6 8.2a.8.8 0 0 1-.8.8H5.6a.8.8 0 0 1-.8-.8Z" />
                    </svg>
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
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  )
}
