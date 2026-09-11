'use client'

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip } from '@/components/ui/tooltip'
import { formatEuros } from '@/lib/price-book/decimal'
import type { PriceBookItem } from '@/lib/price-book/queries'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { idleState, type ActionState } from './action-state'
import { deleteItem, moveItem, setItemActive, updateItem } from './actions'
import { DRAG_MIME } from './drag'
import {
  CELL_CLASS,
  ITEM_TABLE_COLUMN_COUNT,
  ItemFields,
  type GroupOption,
} from './item-fields'
import { BUTTON_CLASS, DANGER_ICON_BUTTON_CLASS, ICON_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from './ui'

const ICON_PROPS = {
  width: 14,
  height: 14,
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

export function ItemRow({
  item,
  groups,
  groupName,
}: {
  item: PriceBookItem
  groups: GroupOption[]
  /** The group this row currently sits in, for the move menu. */
  groupName: string
}) {
  const [editor, setEditor] = useState({ open: false, session: 0 })
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startAction] = useTransition()
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
        toast.success('Concepto guardado')
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
   * The one-click writes. Each takes (previous, formData) because they are
   * the same Server Functions a <form action> would post to; called directly
   * they need the seed state supplied. Every outcome ends in a toast --
   * silence after a click is indistinguishable from a click that missed.
   */
  function runSetActive() {
    startAction(async () => {
      const data = new FormData()
      data.set('id', item.id)
      data.set('is_active', item.isActive ? 'false' : 'true')
      const result = await setItemActive(idleState, data)
      if (result.error) toast.error(result.error)
      // Amber for retiring, green for bringing it back: one narrows what the
      // catalogue offers, the other widens it.
      else if (item.isActive) toast.warning('Concepto retirado del catálogo')
      else toast.success('Concepto reactivado')
    })
  }

  function runDelete() {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', item.id)
        const result = await deleteItem(idleState, data)
        if (result.error) toast.error(result.error)
        // Red, because what it reports is a row that no longer exists.
        else toast.error(`«${item.name}» borrado del tarifario`)
        resolve()
      })
    })
  }

  function runMove(groupId: string | null, name: string) {
    startAction(async () => {
      const data = new FormData()
      data.set('id', item.id)
      data.set('group_id', groupId ?? '')
      const result = await moveItem(idleState, data)
      if (result.error) toast.error(result.error)
      else toast.success(`«${item.name}» movido a ${name}`)
    })
  }

  const formId = `item-${item.id}`
  const error = saveState.session === editor.session ? saveState.error : null

  if (editing) {
    return (
      <>
        <tr className="bg-canvas">
          <ItemFields formId={formId} item={item} />
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
              className="flex flex-col gap-1.5"
            >
              <input type="hidden" name="id" value={item.id} />
              {/*
                The group travels with the save even though this row cannot
                change it. updateItem writes the whole row, and a form that
                left group_id out would post nothing for it -- which reads as
                null, and would quietly file the concept under "Sin grupo"
                every time someone corrected a price.
              */}
              <input type="hidden" name="group_id" value={item.groupId ?? ''} />
              <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className={BUTTON_CLASS}>
                Cancelar
              </button>
            </form>
          </td>
        </tr>
        {error ? (
          <tr>
            <td colSpan={ITEM_TABLE_COLUMN_COUNT} className="border-b border-line-soft px-3 py-2">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            </td>
          </tr>
        ) : null}
      </>
    )
  }

  return (
    <>
      <tr
        className={`group/row transition-colors hover:bg-surface-hover ${
          item.isActive ? '' : 'text-muted'
        } ${pending ? 'opacity-60' : ''}`}
      >
        <td className={`${CELL_CLASS} pr-0`}>
          {/*
            Drag it to another group, or open it and pick one. Both, because
            a drag is quick with a mouse and impossible without one.
          */}
          <Popover>
            <Tooltip label="Mover de grupo">
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Mover ${item.name} de grupo`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_MIME, item.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  className="flex size-6 cursor-grab items-center justify-center rounded text-faint opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                >
                  <svg {...ICON_PROPS} strokeWidth={0} fill="currentColor">
                    <circle cx="6" cy="4" r="1.1" />
                    <circle cx="10" cy="4" r="1.1" />
                    <circle cx="6" cy="8" r="1.1" />
                    <circle cx="10" cy="8" r="1.1" />
                    <circle cx="6" cy="12" r="1.1" />
                    <circle cx="10" cy="12" r="1.1" />
                  </svg>
                </button>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent align="start" className="max-h-72 w-56 overflow-y-auto">
              <span className="block px-2.5 py-1.5 text-2xs font-medium tracking-[0.06em] text-faint uppercase">
                Mover a
              </span>
              {[{ id: null as string | null, name: 'Sin grupo' }, ...groups].map((group) => (
                <button
                  key={group.id ?? 'ungrouped'}
                  type="button"
                  disabled={group.name === groupName}
                  onClick={() => runMove(group.id, group.name)}
                  className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-hover disabled:text-faint disabled:hover:bg-transparent"
                >
                  {group.name}
                  {group.name === groupName ? (
                    <span className="ml-auto text-2xs text-faint">actual</span>
                  ) : null}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </td>

        <td className={`${CELL_CLASS} truncate font-mono text-xs text-muted`}>
          {item.code ?? '—'}
        </td>

        <td className={CELL_CLASS}>
          {/*
            Name on its own line, description under it in small grey. Two
            lines rather than one: a description read as a trailing clause of
            the name is a description nobody reads.
          */}
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium" title={item.name}>
              {item.name}
            </span>
            {item.description ? (
              <span className="truncate text-xs text-faint" title={item.description}>
                {item.description}
              </span>
            ) : null}
          </div>
        </td>

        <td className={`${CELL_CLASS} truncate text-xs text-muted`}>{UNIT_LABELS[item.unit]}</td>
        <td className={`${CELL_CLASS} num text-right text-muted`}>{formatEuros(item.unitCost)}</td>
        <td className={`${CELL_CLASS} num text-right font-medium`}>
          {formatEuros(item.unitPrice)}
        </td>

        {/* Text, not only the grey row: colour alone is not a state. */}
        <td className={CELL_CLASS}>
          {item.isActive ? (
            <span className="text-xs text-faint">Sí</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn-soft px-2 py-0.5 text-2xs text-warn">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-warn" />
              No
            </span>
          )}
        </td>

        <td className={CELL_CLASS}>
          {/*
            The actions sit at 0 opacity until the row is hovered or
            something inside it takes focus, so twenty rows of buttons do not
            compete with twenty rows of prices. Opacity, not `hidden`: the
            buttons stay in the tab order and in the accessibility tree, and
            focus-within brings them back for anyone not using a mouse.
          */}
          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
            <Tooltip label="Editar">
              <button
                ref={editButton}
                type="button"
                aria-label={`Editar ${item.name}`}
                onClick={() => setEditing(true)}
                className={ICON_BUTTON_CLASS}
              >
                <svg {...ICON_PROPS}>
                  <path d="M11.2 2.6a1.6 1.6 0 0 1 2.2 2.2L5.6 12.6l-3 .8.8-3Z" />
                </svg>
              </button>
            </Tooltip>

            <Tooltip label={item.isActive ? 'Retirar del catálogo' : 'Reactivar'}>
              <button
                type="button"
                aria-label={`${item.isActive ? 'Retirar' : 'Reactivar'} ${item.name}`}
                onClick={runSetActive}
                disabled={pending}
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
            </Tooltip>

            <Tooltip label="Borrar">
              <button
                type="button"
                aria-label={`Borrar ${item.name}`}
                onClick={() => setConfirmingDelete(true)}
                disabled={pending}
                className={DANGER_ICON_BUTTON_CLASS}
              >
                <svg {...ICON_PROPS}>
                  <path d="M2.8 4.2h10.4" />
                  <path d="M6.2 4.2V2.8h3.6v1.4" />
                  <path d="M4.2 4.2h7.6l-.6 8.2a.8.8 0 0 1-.8.8H5.6a.8.8 0 0 1-.8-.8Z" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </td>
      </tr>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Borrar «${item.name}»`}
        description="Esto quita el concepto del tarifario para siempre."
        risks={[
          'No se puede deshacer: para volver a ofrecerlo habría que crearlo otra vez.',
          'Los presupuestos que ya lo usan conservan el nombre y el precio que copiaron, pero pierden el enlace con el tarifario.',
          'Si solo quieres dejar de ofrecerlo en presupuestos nuevos, usa Retirar: eso sí se puede deshacer.',
        ]}
        confirmLabel="Borrar del tarifario"
        onConfirm={runDelete}
      />
    </>
  )
}
