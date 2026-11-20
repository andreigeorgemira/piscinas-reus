'use client'

import { useActionState, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { formatEuros, formatPercent } from '@/lib/price-book/decimal'
import { UNIT_LABELS, type UnitType } from '@/lib/price-book/schema'
import { plural } from '@/lib/plural'
import { formatQuantity } from '@/lib/quotes/quantity'
import {
  GROUP_DISPLAYS,
  GROUP_DISPLAY_HINTS,
  GROUP_DISPLAY_LABELS,
  UNGROUPED_LABEL,
  type GroupDisplay,
} from '@/lib/quotes/presentation'
import { moveGroup, moveLineToGroup, renameGroup, setGroupDisplay } from './presentation-actions'

/** A line as this screen shows it: staff always see every figure. */
export type PresentationLine = {
  id: string
  name: string
  quantity: number
  unit: UnitType
  unitPrice: number
  discountPct: number
  lineTotal: number
}

export type PresentationSection = {
  /** The lines' group_name: null for the lines with no group. */
  groupName: string | null
  display: GroupDisplay
  subtotal: number
  lines: PresentationLine[]
}

/**
 * The quote as the client will read it, and the controls to arrange it.
 *
 * The catalogue views answer "what is in the quote"; this one answers "how is
 * it presented": which groups, in what order, under what names, and how much of
 * each the client sees. Prices hidden from the client stay visible here, dimmed,
 * so staff never lose sight of the numbers they are hiding.
 */
export function PresentationBoard({
  quoteId,
  sections,
  extrasCount,
  editable,
}: {
  quoteId: string
  sections: PresentationSection[]
  extrasCount: number
  editable: boolean
}) {
  const named = sections.map((section) => section.groupName).filter((name): name is string => name !== null)

  if (sections.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface px-5 py-12 text-center text-sm text-muted">
        El presupuesto todavía no tiene líneas. Añádelas desde «Todo el tarifario».
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-5 text-muted">
        Así lo verá el cliente: en este orden y con estos nombres. En cada grupo eliges si ve el
        detalle, solo los conceptos o solo el total. Los extras opcionales se muestran siempre con su
        precio: el cliente los elige.
        {extrasCount > 0 ? ` Este presupuesto tiene ${plural(extrasCount, 'extra', 'extras')}.` : ''}
      </p>

      {sections.map((section, index) => (
        <SectionCard
          key={section.groupName ?? '\u0000'}
          quoteId={quoteId}
          section={section}
          otherGroups={named.filter((name) => name !== section.groupName)}
          first={index === 0}
          last={index === sections.length - 1}
          editable={editable}
        />
      ))}
    </div>
  )
}

/** useActionState with the error said out loud, the way every control here wants it. */
function useToastedAction(action: (previous: ActionState, formData: FormData) => Promise<ActionState>) {
  return useActionState<ActionState, FormData>(async (previous, formData) => {
    const next = await action(previous, formData)
    if (next.error) toast.error(next.error)
    return next
  }, idleState)
}

function SectionCard({
  quoteId,
  section,
  otherGroups,
  first,
  last,
  editable,
}: {
  quoteId: string
  section: PresentationSection
  otherGroups: string[]
  first: boolean
  last: boolean
  editable: boolean
}) {
  const label = section.groupName ?? UNGROUPED_LABEL
  const hidden = section.display !== 'detailed'
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2">
        {editable && section.groupName !== null ? (
          <MoveButtons quoteId={quoteId} groupName={section.groupName} first={first} last={last} />
        ) : null}

        <GroupName quoteId={quoteId} section={section} label={label} headingId={headingId} editable={editable} />

        <span className="num ml-auto text-sm font-medium">{formatEuros(section.subtotal)}</span>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft bg-surface-sunk px-3 py-2">
        {section.groupName === null ? (
          <span className="text-2xs text-muted">
            Las líneas sin grupo se muestran en detalle. Ponle nombre al grupo para elegir cómo se ve.
          </span>
        ) : (
          <>
            <DisplaySwitch
              quoteId={quoteId}
              groupName={section.groupName}
              display={section.display}
              editable={editable}
            />
            <span className="text-2xs text-muted">{GROUP_DISPLAY_HINTS[section.display]}</span>
          </>
        )}
      </div>

      <ul>
        {section.lines.map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-3 py-2 text-sm last:border-0"
          >
            <span className={`min-w-[12rem] flex-1 ${section.display === 'total_only' ? 'text-muted' : ''}`}>
              {line.name}
            </span>
            <span className={`num w-24 text-right text-xs ${section.display === 'total_only' ? 'text-faint' : 'text-muted'}`}>
              {`${formatQuantity(line.quantity)} ${UNIT_LABELS[line.unit]}`}
            </span>
            <span
              className={`num w-28 text-right text-xs ${hidden ? 'text-faint line-through decoration-faint/60' : 'text-muted'}`}
              title={hidden ? 'El cliente no ve este precio' : undefined}
            >
              {formatEuros(line.unitPrice)}
              {line.discountPct ? ` −${formatPercent(line.discountPct)}` : ''}
            </span>
            <span
              className={`num w-24 text-right ${hidden ? 'text-faint line-through decoration-faint/60' : 'font-medium'}`}
              title={hidden ? 'El cliente no ve este importe' : undefined}
            >
              {formatEuros(line.lineTotal)}
            </span>
            {editable ? (
              <MoveLine quoteId={quoteId} lineId={line.id} lineName={line.name} groups={otherGroups} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function MoveButtons({
  quoteId,
  groupName,
  first,
  last,
}: {
  quoteId: string
  groupName: string
  first: boolean
  last: boolean
}) {
  const [, formAction, pending] = useToastedAction(moveGroup)

  return (
    <form action={formAction} className="flex">
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="group_name" value={groupName} />
      <button
        type="submit"
        name="direction"
        value="up"
        disabled={first || pending}
        aria-label={`Subir ${groupName}`}
        className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.6 10.2 8 5.8l4.4 4.4" />
        </svg>
      </button>
      <button
        type="submit"
        name="direction"
        value="down"
        disabled={last || pending}
        aria-label={`Bajar ${groupName}`}
        className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.6 5.8 8 10.2l4.4-4.4" />
        </svg>
      </button>
    </form>
  )
}

function GroupName({
  quoteId,
  section,
  label,
  headingId,
  editable,
}: {
  quoteId: string
  section: PresentationSection
  label: string
  headingId: string
  editable: boolean
}) {
  const [renaming, setRenaming] = useState(false)
  const inputId = useId()
  const [, formAction, pending] = useToastedAction(async (previous, formData) => {
    const next = await renameGroup(previous, formData)
    if (next.error === null) {
      setRenaming(false)
      toast.success('Grupo renombrado')
    }
    return next
  })

  if (renaming) {
    return (
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="quote_id" value={quoteId} />
        <input type="hidden" name="group_name" value={section.groupName ?? ''} />
        <label htmlFor={inputId} className="sr-only">
          Nuevo nombre para {label}
        </label>
        <input
          id={inputId}
          name="new_name"
          defaultValue={section.groupName ?? ''}
          placeholder="Nombre del grupo"
          maxLength={80}
          required
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Escape') setRenaming(false)
          }}
          className={`${FIELD_CLASS} h-8 w-64`}
        />
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setRenaming(false)} className={BUTTON_CLASS}>
          Cancelar
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <h2 id={headingId} className={`text-sm font-semibold ${section.groupName === null ? 'text-muted italic' : ''}`}>
        {label}
      </h2>
      <span className="num text-2xs text-faint">{plural(section.lines.length, 'línea', 'líneas')}</span>
      {editable ? (
        <button
          type="button"
          onClick={() => setRenaming(true)}
          aria-label={section.groupName === null ? 'Poner nombre a las líneas sin grupo' : `Renombrar ${label}`}
          className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.6 2.8 13.2 5.4 5.8 12.8H3.2v-2.6Z" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

function DisplaySwitch({
  quoteId,
  groupName,
  display,
  editable,
}: {
  quoteId: string
  groupName: string
  display: GroupDisplay
  editable: boolean
}) {
  const [, formAction, pending] = useToastedAction(setGroupDisplay)

  return (
    <form action={formAction} role="radiogroup" aria-label={`Qué ve el cliente de ${groupName}`} className="flex rounded-lg bg-surface p-0.5 ring-1 ring-line">
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="group_name" value={groupName} />
      {GROUP_DISPLAYS.map((mode) => {
        const current = mode === display
        return (
          <button
            key={mode}
            type="submit"
            name="display"
            value={mode}
            role="radio"
            aria-checked={current}
            disabled={!editable || pending || current}
            className={`h-7 rounded-md px-2.5 text-2xs font-medium transition-[background-color,color] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
              current ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink disabled:hover:text-muted'
            }`}
          >
            {GROUP_DISPLAY_LABELS[mode]}
          </button>
        )
      })}
    </form>
  )
}

const NEW_GROUP = '\u0000new'

function MoveLine({
  quoteId,
  lineId,
  lineName,
  groups,
}: {
  quoteId: string
  lineId: string
  lineName: string
  groups: string[]
}) {
  const [creating, setCreating] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const selectId = useId()
  const [, formAction, pending] = useToastedAction(async (previous, formData) => {
    const next = await moveLineToGroup(previous, formData)
    if (next.error === null) setCreating(false)
    return next
  })

  return (
    <form ref={form} action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="line_id" value={lineId} />
      {creating ? (
        <>
          <label htmlFor={selectId} className="sr-only">
            Nuevo grupo para {lineName}
          </label>
          <input
            id={selectId}
            name="group_name"
            placeholder="Nuevo grupo"
            maxLength={80}
            required
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCreating(false)
            }}
            className={`${FIELD_CLASS} h-7 w-40 text-xs`}
          />
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
            Mover
          </button>
        </>
      ) : (
        <>
          <label htmlFor={selectId} className="sr-only">
            Mover {lineName} a otro grupo
          </label>
          <select
            id={selectId}
            name="group_name"
            defaultValue=""
            disabled={pending}
            onChange={(event) => {
              if (event.target.value === NEW_GROUP) {
                setCreating(true)
                return
              }
              form.current?.requestSubmit()
            }}
            className="h-7 w-36 rounded-md border border-line bg-surface px-1.5 text-2xs text-muted focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="" disabled>
              Mover a…
            </option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
            <option value={NEW_GROUP}>Nuevo grupo…</option>
          </select>
        </>
      )}
    </form>
  )
}
