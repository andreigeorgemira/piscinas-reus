import type { TableColumn } from '@/components/ui/table'
import { formatMoney } from '@/lib/price-book/decimal'
import type { PriceBookItem } from '@/lib/price-book/queries'
import { UNIT_LABELS, UNIT_TYPES } from '@/lib/price-book/schema'
import { INLINE_FIELD_CLASS, INLINE_FIELD_FILL_CLASS } from './ui'

/** A group an item can be filed under. The "Sin grupo" bucket is not one. */
export type GroupOption = { id: string; name: string }

/**
 * The catalogue's columns, in order.
 *
 * There is no Grupo column: every row is already inside the rowgroup for its
 * group, so it repeated the heading once per row. Moving an item is the
 * handle in the first column instead - drag it, or open it and pick.
 */
export const PRICE_BOOK_COLUMNS: TableColumn[] = [
  { key: 'handle', label: 'Mover', width: 'w-9', srOnly: true },
  { key: 'code', label: 'Código', width: 'w-32' },
  { key: 'name', label: 'Concepto' },
  { key: 'unit', label: 'Unidad', width: 'w-24' },
  { key: 'cost', label: 'Coste', width: 'w-32', align: 'right' },
  { key: 'price', label: 'Precio', width: 'w-32', align: 'right' },
  { key: 'active', label: 'Activo', width: 'w-20' },
  { key: 'actions', label: 'Acciones', width: 'w-24', srOnly: true },
]

export const ITEM_TABLE_COLUMN_COUNT = PRICE_BOOK_COLUMNS.length

export const CELL_CLASS = 'border-b border-line-soft px-3 py-2 align-middle'

const FILL = `${INLINE_FIELD_CLASS} ${INLINE_FIELD_FILL_CLASS}`

/**
 * The editable cells, shared by the edit row and the new-item row.
 *
 * Every control carries `form={formId}` instead of sitting inside the form.
 * A <form> is not valid between <tr> and <td>: the HTML parser hoists it out
 * of the table and takes its inputs with it, so the row would post an empty
 * body. The form element therefore lives in the row's actions cell and the
 * controls here join it by id.
 *
 * Each field wears the type classes of the cell it replaces in ItemRow, so
 * opening a row turns its text into fields where it stands instead of
 * swapping it for a taller form. Keep the two in step.
 *
 * The names are on `aria-label`, not on a visible <label>. The column header
 * already names each field for a sighted reader, and repeating it inside
 * every row would double the height of a table whose whole point is density
 * -- but nothing is left unnamed for a screen reader.
 */
export function ItemFields({
  formId,
  item,
}: {
  formId: string
  /** The row being edited, or undefined for the new-item row. */
  item?: PriceBookItem
}) {
  return (
    <>
      <td className={CELL_CLASS} />
      <td className={CELL_CLASS}>
        <input
          form={formId}
          name="code"
          aria-label="Código"
          defaultValue={item?.code ?? ''}
          maxLength={40}
          placeholder="REV-001"
          // The first field of a row that only ever appears in response to a
          // click, so taking focus here continues the gesture rather than
          // stealing it.
          autoFocus
          className={`${FILL} font-mono text-xs text-muted`}
        />
      </td>
      <td className={CELL_CLASS}>
        {/*
          The description is always offered, even when the row shows none,
          because this is the only place to write one. It is the one field
          that can make the open row taller than the closed one.
        */}
        <div className="flex flex-col gap-[3px]">
          <input
            form={formId}
            name="name"
            aria-label="Concepto"
            defaultValue={item?.name ?? ''}
            maxLength={200}
            placeholder="Nombre del concepto"
            className={`${FILL} font-medium`}
          />
          <input
            form={formId}
            name="description"
            aria-label="Descripción"
            defaultValue={item?.description ?? ''}
            maxLength={2000}
            placeholder="Descripción (opcional)"
            className={`${FILL} text-xs text-muted`}
          />
        </div>
      </td>
      <td className={CELL_CLASS}>
        <div className="relative">
          {/*
            appearance-none, because the native select brings its own height
            and arrow and would not sit on the line the unit text sat on. The
            arrow below replaces it.
          */}
          <select
            form={formId}
            name="unit"
            aria-label="Unidad"
            defaultValue={item?.unit ?? 'unit'}
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
        {/*
          Text, never type="number": staff type prices the Spanish way and a
          number input silently discards a comma, so '48,5' would post as ''.
          inputMode gets the numeric keypad on a phone without that cost.

          The box is a <label> holding the input and the euro sign, so the
          figures end exactly where formatEuros ends them in the closed row
          and a click on the sign still lands in the field.
        */}
        <label className={`${FILL} num flex text-muted`}>
          <input
            form={formId}
            name="unit_cost"
            aria-label="Coste"
            inputMode="decimal"
            defaultValue={item ? formatMoney(item.unitCost) : ''}
            placeholder="0,00"
            className="min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-faint"
          />
          <span aria-hidden="true">{' €'}</span>
        </label>
      </td>
      <td className={CELL_CLASS}>
        <label className={`${FILL} num flex font-medium`}>
          <input
            form={formId}
            name="unit_price"
            aria-label="Precio"
            inputMode="decimal"
            defaultValue={item ? formatMoney(item.unitPrice) : ''}
            placeholder="0,00"
            className="min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-faint"
          />
          <span aria-hidden="true">{' €'}</span>
        </label>
      </td>
      <td className={CELL_CLASS}>
        {/*
          Always rendered, even though an edit rarely means to touch it: the
          update writes the whole row, and an unchecked checkbox posts nothing
          at all, so a form that left this out would retire the item on every
          save.
        */}
        <input
          form={formId}
          type="checkbox"
          name="is_active"
          aria-label="Activo"
          defaultChecked={item?.isActive ?? true}
          className="size-4 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </td>
    </>
  )
}
