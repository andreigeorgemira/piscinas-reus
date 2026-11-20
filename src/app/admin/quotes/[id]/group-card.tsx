'use client'

import { startTransition, useActionState, useId, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { formatEuros } from '@/lib/price-book/decimal'
import { UNIT_LABELS, UNIT_TYPES } from '@/lib/price-book/schema'
import { UNGROUPED_SECTION, type BoardSection } from '@/lib/quotes/board'
import { addSectionLine } from './actions'
import { BoardRow } from './board-row'

/**
 * One group of the board: the catalogue's group, the quote's lines in it, and
 * the way to write a line that belongs to it and to no catalogue.
 *
 * A card per group rather than one long table with heading rows, because the
 * group is the unit of the printed document: the PDF and the public link segment
 * the quote by group with a subtotal per group, and the editor showing the same
 * shape is what stops the two from surprising each other. It is also what makes
 * the free line belong somewhere -- filed in its group, it prints among its
 * neighbours instead of in a bag of loose lines at the end.
 *
 * Folded, a group is one line of summary. That is what keeps a thousand-concept
 * book usable on this screen (the price book learned the same lesson: see the
 * fold in src/app/admin/price-books/[id]/page.tsx).
 */
export function GroupCard({
  quoteId,
  section,
  editable,
  startOpen,
}: {
  quoteId: string
  section: BoardSection
  editable: boolean
  startOpen: boolean
}) {
  const [open, setOpen] = useState(startOpen)
  const [adding, setAdding] = useState(false)
  const [fieldsKey, setFieldsKey] = useState(0)
  const headingId = useId()
  const nameId = useId()
  const unitId = useId()
  const quantityId = useId()
  const priceId = useId()
  const costId = useId()

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await addSectionLine(previous, formData)
      if (next.error === null) {
        startTransition(() => {
          setFieldsKey((key) => key + 1)
          setAdding(false)
        })
        toast.success(`Línea añadida a ${section.name}`)
      }
      return next
    },
    idleState,
  )

  const conceptLineCounts = new Map<string, number>()
  for (const row of section.rows) {
    if (row.kind === 'concept' || row.kind === 'extra') {
      if (!row.line) continue
      const key = row.concept.id
      conceptLineCounts.set(key, (conceptLineCounts.get(key) ?? 0) + 1)
    }
  }

  return (
    /*
      A named region, not a bare <section>: the group is the unit staff and the
      printed document both work in, so it is worth being able to jump to it --
      and a <section> with no accessible name is not exposed as a region at all.
    */
    <section
      aria-labelledby={headingId}
      className={`overflow-hidden rounded-lg border bg-surface ${
        section.lineCount > 0 ? 'border-line shadow-card' : 'border-line-soft'
      }`}
    >
      <div
        className={`flex h-11 items-center gap-2.5 px-3 ${open ? 'border-b border-line-soft' : ''}`}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform ${open ? 'rotate-90' : ''}`}
          >
            <path d="m5.4 3.6 4.4 4.4-4.4 4.4" />
          </svg>
          <span className="sr-only">{open ? `Plegar ${section.name}` : `Desplegar ${section.name}`}</span>
        </button>

        <h2 id={headingId} className="text-sm font-semibold -tracking-[0.005em]">
          {section.name}
        </h2>

        {section.lineCount > 0 ? (
          <span className="num rounded-full bg-accent-soft px-2 text-[10px] font-medium text-accent">
            {section.lineCount === 1 ? '1 línea' : `${section.lineCount} líneas`}
          </span>
        ) : null}

        {section.fromBook ? (
          <span className="num text-xs text-faint">
            {section.conceptCount === 1 ? '1 concepto' : `${section.conceptCount} conceptos`}
          </span>
        ) : (
          /*
            The group is not in the book on screen: these lines came from
            another tarifario, or were written by hand. They stay visible on
            purpose -- a line that disappears when the book selector changes
            reads as a line somebody deleted.
          */
          <span className="rounded-full border border-line bg-surface-sunk px-2 text-[10px] text-muted">
            fuera de este tarifario
          </span>
        )}

        <span className="num ml-auto text-sm font-medium">
          {section.subtotal > 0 ? formatEuros(section.subtotal) : ''}
        </span>
      </div>

      {open ? (
        <>
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-11" />
              <col className="w-20" />
              <col />
              <col className="w-32" />
              <col className="w-24" />
              <col className="w-16" />
              <col className="w-28" />
              <col className="w-20" />
              <col className="w-16" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="border-b border-line-soft px-3 py-1.5">
                  <span className="sr-only">En el presupuesto</span>
                </th>
                <th scope="col" className="border-b border-line-soft px-3 py-1.5 text-left text-2xs font-medium tracking-[0.05em] text-faint uppercase">
                  Código
                </th>
                <th scope="col" className="border-b border-line-soft px-3 py-1.5 text-left text-2xs font-medium tracking-[0.05em] text-faint uppercase">
                  Concepto
                </th>
                <th scope="col" className="border-b border-line-soft px-3 py-1.5 text-right text-2xs font-medium tracking-[0.05em] text-faint uppercase">
                  Cantidad
                </th>
                <th scope="col" className="border-b border-line-soft px-3 py-1.5 text-right text-2xs font-medium tracking-[0.05em] text-faint uppercase">
                  Precio
                </th>
                <th scope="col" className="border-b border-line-soft px-3 py-1.5 text-right text-2xs font-medium tracking-[0.05em] text-faint uppercase">
                  Dto.
                </th>
                <th scope="col" className="border-b border-line-soft px-3 py-1.5 text-right text-2xs font-medium tracking-[0.05em] text-faint uppercase">
                  Importe
                </th>
                <th
                  scope="col"
                  title="Un extra opcional queda fuera del total hasta que el cliente lo marca"
                  className="border-b border-line-soft px-3 py-1.5 text-center text-2xs font-medium tracking-[0.05em] text-faint uppercase"
                >
                  Opcional
                </th>
                <th scope="col" className="border-b border-line-soft px-3 py-1.5">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <BoardRow
                  key={row.kind === 'concept' ? `c-${row.concept.id}` : `l-${row.line.id}`}
                  quoteId={quoteId}
                  kind={row.kind}
                  concept={row.kind === 'loose' ? undefined : row.concept}
                  line={row.line}
                  conceptLineCount={
                    row.kind === 'concept' ? conceptLineCounts.get(row.concept.id) : undefined
                  }
                  editable={editable}
                />
              ))}
            </tbody>
          </table>

          {editable ? (
            adding ? (
              <div className="flex flex-col gap-1 border-t border-dashed border-accent/40 bg-accent-soft/50 px-3 py-2.5">
                <form
                  action={formAction}
                  onReset={(event) => event.preventDefault()}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setAdding(false)
                  }}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="quote_id" value={quoteId} />
                  {/* "Sin grupo" is the board's name for no group at all, so it
                      posts as empty and the line is stored with a null group. */}
                  <input
                    type="hidden"
                    name="group_name"
                    value={section.name === UNGROUPED_SECTION ? '' : section.name}
                  />
                  <input type="hidden" name="discount_pct" value="0" />

                  <label htmlFor={nameId} className="flex flex-col gap-1 text-2xs text-muted">
                    Concepto
                    <input
                      key={`name-${fieldsKey}`}
                      id={nameId}
                      name="name"
                      maxLength={200}
                      autoFocus
                      placeholder="Trabajo a medida"
                      className={`${FIELD_CLASS} h-7 w-64`}
                    />
                  </label>

                  <label htmlFor={unitId} className="flex flex-col gap-1 text-2xs text-muted">
                    Ud.
                    <select id={unitId} name="unit" defaultValue="lot" className={`${FIELD_CLASS} h-7`}>
                      {UNIT_TYPES.map((unit) => (
                        <option key={unit} value={unit}>
                          {UNIT_LABELS[unit]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label htmlFor={quantityId} className="flex flex-col gap-1 text-2xs text-muted">
                    Cantidad
                    <input
                      key={`quantity-${fieldsKey}`}
                      id={quantityId}
                      name="quantity"
                      inputMode="decimal"
                      defaultValue="1"
                      className={`${FIELD_CLASS} num h-7 w-20 text-right`}
                    />
                  </label>

                  <label htmlFor={priceId} className="flex flex-col gap-1 text-2xs text-muted">
                    Precio
                    <input
                      key={`price-${fieldsKey}`}
                      id={priceId}
                      name="unit_price"
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`${FIELD_CLASS} num h-7 w-24 text-right`}
                    />
                  </label>

                  <label htmlFor={costId} className="flex flex-col gap-1 text-2xs text-muted">
                    Coste
                    <input
                      key={`cost-${fieldsKey}`}
                      id={costId}
                      name="unit_cost"
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`${FIELD_CLASS} num h-7 w-24 text-right`}
                    />
                  </label>

                  <label className="flex items-center gap-1.5 pb-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      name="is_recommended"
                      className="size-3.5 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                    />
                    Extra opcional
                  </label>

                  <div className="ml-auto flex items-center gap-2 pb-1">
                    <button type="button" onClick={() => setAdding(false)} className={BUTTON_CLASS}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
                      {pending ? 'Añadiendo…' : `Añadir a ${section.name}`}
                    </button>
                  </div>
                </form>

                {state.error ? (
                  <p role="alert" className="text-xs text-danger">
                    {state.error}
                  </p>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 border-t border-dashed border-line px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <span className="flex size-4 items-center justify-center rounded border border-dashed border-line text-faint">
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M8 3.4v9.2M3.4 8h9.2" />
                  </svg>
                </span>
                Línea libre en {section.name}
              </button>
            )
          ) : null}
        </>
      ) : null}
    </section>
  )
}
