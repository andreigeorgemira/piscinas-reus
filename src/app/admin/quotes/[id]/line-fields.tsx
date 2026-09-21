import { INLINE_FIELD_CLASS, INLINE_FIELD_FILL_CLASS } from '@/app/admin/price-book/ui'
import type { TableColumn } from '@/components/ui/table'
import { formatMoney } from '@/lib/price-book/decimal'
import { UNIT_LABELS, UNIT_TYPES } from '@/lib/price-book/schema'
import { formatQuantity } from '@/lib/quotes/quantity'
import type { QuoteItem } from '@/lib/quotes/queries'

/**
 * The columns of a quote's lines, in order.
 *
 * Coste and Margen are on this screen and nowhere a client can reach: the
 * column lives on quote_items, the client-facing view omits it entirely
 * (0004_client_views.sql, 0005_quote_totals.sql), and that is what keeps it
 * invisible rather than anything here.
 */
export const QUOTE_LINE_COLUMNS: TableColumn[] = [
  { key: 'order', label: 'Orden', width: 'w-12', srOnly: true },
  { key: 'concept', label: 'Concepto' },
  { key: 'unit', label: 'Ud.', width: 'w-20' },
  { key: 'quantity', label: 'Cantidad', width: 'w-28', align: 'right' },
  { key: 'price', label: 'Precio', width: 'w-28', align: 'right' },
  { key: 'discount', label: 'Dto.', width: 'w-20', align: 'right' },
  { key: 'total', label: 'Importe', width: 'w-32', align: 'right' },
  { key: 'cost', label: 'Coste', width: 'w-28', align: 'right' },
  { key: 'actions', label: 'Acciones', width: 'w-24', srOnly: true },
]

export const QUOTE_LINE_COLUMN_COUNT = QUOTE_LINE_COLUMNS.length

export const CELL_CLASS = 'border-b border-line-soft px-3 py-2 align-middle'

const FILL = `${INLINE_FIELD_CLASS} ${INLINE_FIELD_FILL_CLASS}`

/**
 * The editable cells of a line, shared by the edit row and the new-line row.
 *
 * Every control carries `form={formId}` rather than sitting inside the form: a
 * <form> between <tr> and <td> is hoisted out of the table by the HTML parser,
 * taking its inputs with it, so the row would post an empty body. The form
 * element lives in the actions cell and these join it by id -- the same
 * arrangement as the price book's ItemFields, for the same reason.
 *
 * Numbers are text inputs with inputMode="decimal", never type="number": staff
 * type the Spanish way and a number input silently discards a comma, so '48,5'
 * would post as ''.
 */
export function LineFields({
  formId,
  line,
}: {
  formId: string
  /** The line being edited, or undefined for the new-line row. */
  line?: QuoteItem
}) {
  return (
    <>
      <td className={CELL_CLASS} />
      <td className={CELL_CLASS}>
        <div className="flex flex-col gap-[3px]">
          <input
            form={formId}
            name="name"
            aria-label="Concepto"
            defaultValue={line?.name ?? ''}
            maxLength={200}
            placeholder="Nombre del concepto"
            autoFocus
            className={`${FILL} font-medium`}
          />
          <input
            form={formId}
            name="description"
            aria-label="Descripción"
            defaultValue={line?.description ?? ''}
            maxLength={2000}
            placeholder="Descripción (opcional)"
            className={`${FILL} text-xs text-muted`}
          />
          {/*
            An unchecked checkbox posts nothing at all, so this has to be in
            the form on every save: leaving it out would clear the flag on any
            line that had it, quietly moving an optional extra into the price
            the client is committed to.
          */}
          <label className="flex w-fit items-center gap-1.5 pt-0.5 text-2xs text-muted">
            <input
              form={formId}
              type="checkbox"
              name="is_recommended"
              defaultChecked={line?.isRecommended ?? false}
              className="size-3.5 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
            Extra opcional (fuera del total)
          </label>
        </div>
      </td>
      <td className={CELL_CLASS}>
        <div className="relative">
          {/* appearance-none: the native select brings its own height and
              arrow and would not sit on the line the unit text sat on. */}
          <select
            form={formId}
            name="unit"
            aria-label="Unidad"
            defaultValue={line?.unit ?? 'unit'}
            className={`${FILL} block h-5 cursor-pointer appearance-none pr-5 text-xs text-muted`}
          >
            {UNIT_TYPES.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
          <svg
            width={12}
            height={12}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-faint"
          >
            <path d="m4.4 6.2 3.6 3.6 3.6-3.6" />
          </svg>
        </div>
      </td>
      <td className={CELL_CLASS}>
        <label className={`${FILL} num flex font-medium`}>
          <input
            form={formId}
            name="quantity"
            aria-label="Cantidad"
            inputMode="decimal"
            defaultValue={line ? formatQuantity(line.quantity) : '1'}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-faint"
          />
        </label>
      </td>
      <td className={CELL_CLASS}>
        <label className={`${FILL} num flex`}>
          <input
            form={formId}
            name="unit_price"
            aria-label="Precio"
            inputMode="decimal"
            defaultValue={line ? formatMoney(line.unitPrice) : ''}
            placeholder="0,00"
            className="min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-faint"
          />
          <span aria-hidden="true">{' €'}</span>
        </label>
      </td>
      <td className={CELL_CLASS}>
        <label className={`${FILL} num flex text-muted`}>
          <input
            form={formId}
            name="discount_pct"
            aria-label="Descuento"
            inputMode="decimal"
            defaultValue={line ? formatQuantity(line.discountPct) : '0'}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-faint"
          />
          <span aria-hidden="true">%</span>
        </label>
      </td>
      <td className={CELL_CLASS}>
        {/*
          The line's own total is not a field: it is the arithmetic of the
          three fields beside it, and a box staff could type into would invite
          a figure that contradicts them. It reappears, computed, the moment
          the row is saved.
        */}
        <span className="num block text-right text-faint">—</span>
      </td>
      <td className={CELL_CLASS}>
        <label className={`${FILL} num flex text-muted`}>
          <input
            form={formId}
            name="unit_cost"
            aria-label="Coste"
            inputMode="decimal"
            defaultValue={line ? formatMoney(line.unitCost) : ''}
            placeholder="0,00"
            className="min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-faint"
          />
          <span aria-hidden="true">{' €'}</span>
        </label>
      </td>
    </>
  )
}
