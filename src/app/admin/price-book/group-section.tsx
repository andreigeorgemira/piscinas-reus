'use client'

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip } from '@/components/ui/tooltip'
import type { PriceBookGroup } from '@/lib/price-book/queries'
import { idleState, type ActionState } from './action-state'
import { createItem, deleteGroup, moveItem, updateGroup } from './actions'
import { DRAG_MIME } from './drag'
import { useGroupsOpenRequest } from './groups-open'
import { CELL_CLASS, ITEM_TABLE_COLUMN_COUNT, ItemFields, type GroupOption } from './item-fields'
import { ItemRow } from './item-row'
import {
  BUTTON_CLASS,
  DANGER_ICON_BUTTON_CLASS,
  FIELD_CLASS,
  ICON_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from './ui'

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
 * What an action returned, plus which opening of the form asked for it. See
 * the same shape in item-row.tsx for why the session stamp is there.
 */
type FormState = ActionState & { session: number }

const idleFormState: FormState = { ...idleState, session: -1 }

/**
 * One group of the catalogue, as a rowgroup of the single price-book table.
 *
 * A <tbody>, not a table of its own: a table per group repeated the whole
 * column header every few rows, which on a real catalogue is the loudest
 * thing on it. `aria-label` gives the rowgroup the group's name, so the
 * structure a screen reader hears is the one on screen.
 *
 * It is also the drop target for a row dragged out of another group. The
 * whole rowgroup accepts the drop, not just its heading: aiming at a 28px
 * strip is a worse gesture than aiming at the block it belongs to.
 */
export function GroupSection({
  group,
  groups,
  paginated,
  groupHref,
}: {
  group: PriceBookGroup
  groups: GroupOption[]
  /** True when the catalogue runs to more than one page. */
  paginated: boolean
  /** Address that filters the screen down to this group alone. */
  groupHref: string
}) {
  const groupId = group.id
  const newItemFormId = `new-item-${groupId ?? 'ungrouped'}`

  const [open, setOpen] = useState(true)

  // "Fold all" arrives as a stamped request rather than as a value to mirror,
  // so applying it is a one-off: adjust state during render when the stamp
  // changes, which is React's own answer to "reset state when a prop
  // changes" and re-renders before anything is painted.
  const request = useGroupsOpenRequest()
  const [appliedToken, setAppliedToken] = useState(0)
  if (request && request.token !== appliedToken) {
    setAppliedToken(request.token)
    if (request.open !== open) setOpen(request.open)
  }
  const [renaming, setRenamer] = useState({ open: false, session: 0 })
  const [adding, setAdder] = useState({ open: false, session: 0 })
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [, startAction] = useTransition()

  const renameButton = useRef<HTMLButtonElement>(null)
  const [newItemKey, setNewItemKey] = useState(0)

  function setRenaming(value: boolean) {
    setRenamer((current) => ({ open: value, session: current.session + 1 }))
  }

  function setAdding(value: boolean) {
    setAdder((current) => ({ open: value, session: current.session + 1 }))
    if (value) setOpen(true)
  }

  const [renameState, renameAction, renamingPending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const next = await updateGroup(previous, formData)
      if (next.error === null) {
        startTransition(() => setRenaming(false))
        toast.success('Grupo guardado')
      }
      return { ...next, session: renaming.session }
    },
    idleFormState,
  )

  const [addState, addAction, addPending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const next = await createItem(previous, formData)
      // Inside a transition so the blank row and the revalidated table commit
      // together; see the note in item-row.tsx.
      if (next.error === null) {
        startTransition(() => setNewItemKey((key) => key + 1))
        toast.success('Concepto añadido')
      }
      return { ...next, session: adding.session }
    },
    idleFormState,
  )

  // Closing the rename form takes the focused control with it; hand focus back
  // to the button that opened it rather than dropping it on <body>.
  const wasRenaming = useRef(false)
  useEffect(() => {
    if (wasRenaming.current && !renaming.open) {
      renameButton.current?.focus()
    }
    wasRenaming.current = renaming.open
  }, [renaming.open])

  function runDeleteGroup() {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', groupId ?? '')
        const result = await deleteGroup(idleState, data)
        if (result.error) toast.error(result.error)
        else toast.error(`Grupo «${group.name}» borrado`)
        resolve()
      })
    })
  }

  function acceptDrop(itemId: string) {
    startAction(async () => {
      const data = new FormData()
      data.set('id', itemId)
      data.set('group_id', groupId ?? '')
      const result = await moveItem(idleState, data)
      if (result.error) toast.error(result.error)
      else toast.success(`Concepto movido a ${group.name}`)
    })
  }

  const renameError = renameState.session === renaming.session ? renameState.error : null
  const addError = addState.session === adding.session ? addState.error : null

  return (
    <>
      <tbody
        aria-label={group.name}
        className={`group/section ${dragOver ? 'bg-accent-soft' : ''}`}
        onDragOver={(event) => {
          // Only a row from this table, and never back into the group it
          // already sits in -- dragover cannot read the payload, so the
          // no-op drop is caught on drop instead.
          if (!event.dataTransfer.types.includes(DRAG_MIME)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          const itemId = event.dataTransfer.getData(DRAG_MIME)
          setDragOver(false)
          if (!itemId) return
          event.preventDefault()
          if (group.items.some((item) => item.id === itemId)) return
          acceptDrop(itemId)
        }}
      >
        <tr className="bg-surface-sunk">
          <th
            scope="colgroup"
            colSpan={ITEM_TABLE_COLUMN_COUNT}
            className="border-y border-line px-2 py-1.5 text-left font-medium"
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-label={`${open ? 'Contraer' : 'Expandir'} ${group.name}`}
                className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                <svg
                  {...ICON_PROPS}
                  className={`text-faint transition-transform ${open ? 'rotate-90' : ''}`}
                >
                  <path d="M6 3.6 10.4 8 6 12.4" />
                </svg>
                <span className="text-xs font-semibold tracking-[0.04em] text-ink uppercase">
                  {group.name}
                </span>
                {/*
                  The count is of rows on THIS page, so a zero would be a lie
                  about a group whose concepts are on the next one. When
                  there are none here, the row below says so in words.
                */}
                {group.items.length > 0 ? (
                  <span className="num rounded-full bg-surface px-1.5 text-2xs text-muted">
                    {group.items.length}
                  </span>
                ) : null}
              </button>

              <div className="ml-auto flex items-center gap-1.5">
                {groupId === null ? null : (
                  // Renaming and deleting a group are rare and one of them is
                  // destructive, so they wait for the pointer or the keyboard
                  // to reach this rowgroup. Adding a concept is the reason
                  // staff open this screen, so it never hides.
                  <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
                    <Tooltip label="Renombrar grupo">
                      <button
                        ref={renameButton}
                        type="button"
                        aria-label={`Renombrar ${group.name}`}
                        aria-expanded={renaming.open}
                        onClick={() => setRenaming(!renaming.open)}
                        className={ICON_BUTTON_CLASS}
                      >
                        <svg {...ICON_PROPS}>
                          <path d="M11.2 2.6a1.6 1.6 0 0 1 2.2 2.2L5.6 12.6l-3 .8.8-3Z" />
                        </svg>
                      </button>
                    </Tooltip>
                    <Tooltip label="Borrar grupo">
                      <button
                        type="button"
                        aria-label={`Borrar grupo ${group.name}`}
                        onClick={() => setConfirmingDelete(true)}
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
                )}
              </div>
            </div>
          </th>
        </tr>

        {open && renaming.open && groupId !== null ? (
          <tr>
            <td
              colSpan={ITEM_TABLE_COLUMN_COUNT}
              className="border-b border-line-soft bg-canvas p-3"
            >
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
                    className={`${FIELD_CLASS} w-56`}
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
                    className={`${FIELD_CLASS} num w-20`}
                  />
                </label>
                <button type="submit" disabled={renamingPending} className={PRIMARY_BUTTON_CLASS}>
                  {renamingPending ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setRenaming(false)} className={BUTTON_CLASS}>
                  Cancelar
                </button>
                {renameError ? (
                  <p role="alert" className="w-full text-xs text-danger">
                    {renameError}
                  </p>
                ) : null}
              </form>
            </td>
          </tr>
        ) : null}

        {open
          ? group.items.map((item) => (
              <ItemRow key={item.id} item={item} groups={groups} groupName={group.name} />
            ))
          : null}

        {open && adding.open ? (
          <>
            <tr key={newItemKey} className="bg-canvas">
              <ItemFields formId={newItemFormId} />
              <td className={CELL_CLASS}>
                <form
                  id={newItemFormId}
                  action={addAction}
                  onReset={(event) => event.preventDefault()}
                  className="flex flex-col gap-1.5"
                >
                  {/*
                    The new row belongs to the group it was typed into. There
                    is no select for it: if it lands in the wrong place, the
                    handle in the first column moves it in one drag.
                  */}
                  <input type="hidden" name="group_id" value={groupId ?? ''} />
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
                <td
                  colSpan={ITEM_TABLE_COLUMN_COUNT}
                  className="border-b border-line-soft px-3 py-2"
                >
                  <p role="alert" className="text-sm text-danger">
                    {addError}
                  </p>
                </td>
              </tr>
            ) : null}
          </>
        ) : null}

        {open && !adding.open ? (
          <tr>
            {/*
              The cell stays a cell -- `display: flex` on a <td> drops its
              table-cell box, and with it the colspan that makes this row as
              wide as the table. The stacking happens in a div inside it.
            */}
            <td colSpan={ITEM_TABLE_COLUMN_COUNT} className="border-b border-line-soft p-0">
              <div className="flex flex-col items-start">
                {/*
                The way to add a concept is at the END of the group, where
                the last row is and where the eye already is after reading
                it -- not in a form above the table.
              */}
                <button
                  type="button"
                  aria-label={`Añadir concepto a ${group.name}`}
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                >
                  <svg {...ICON_PROPS} strokeWidth={1.8} className="text-faint">
                    <path d="M8 3.4v9.2M3.4 8h9.2" />
                  </svg>
                  {group.items.length > 0
                    ? 'Añadir concepto'
                    : paginated
                      ? 'Sin conceptos de este grupo en esta página. Añadir uno'
                      : 'Este grupo no tiene conceptos. Añade el primero.'}
                </button>
                {/*
                A group whose concepts all sit on another page must not be
                described as empty -- it is not. The link is the way to see
                the ones this page is not showing.
              */}
                {group.items.length === 0 && paginated ? (
                  <a
                    href={groupHref}
                    className="px-3 pb-2 text-xs text-accent underline underline-offset-2"
                  >
                    Ver solo este grupo
                  </a>
                ) : null}
              </div>
            </td>
          </tr>
        ) : null}
      </tbody>

      {groupId === null ? null : (
        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title={`Borrar el grupo «${group.name}»`}
          description="El grupo desaparece del tarifario. Sus conceptos no."
          risks={[
            group.items.length === 0
              ? 'Este grupo no tiene ningún concepto, así que no se mueve nada.'
              : `Sus ${group.items.length} conceptos pasan a «Sin grupo» y siguen ahí con su código y su precio.`,
            'Los presupuestos ya hechos no cambian: cada línea guardó el nombre del grupo cuando se escribió.',
            'Para volver a tenerlo habría que crear el grupo otra vez y arrastrar los conceptos de vuelta.',
          ]}
          confirmLabel="Borrar grupo"
          onConfirm={runDeleteGroup}
        />
      )}
    </>
  )
}
