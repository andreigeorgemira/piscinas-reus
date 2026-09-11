import { formatMoney } from '@/lib/price-book/decimal'
import { UNGROUPED_NAME, type PriceBookItem } from '@/lib/price-book/queries'
import { UNIT_LABELS, UNIT_TYPES } from '@/lib/price-book/schema'
import { FIELD_CLASS } from './ui'

/** A group an item can be filed under. The "Sin grupo" bucket is not one. */
export type GroupOption = { id: string; name: string }

type Column = { label: string; numeric?: boolean; width?: string }

/**
 * The columns this component fills, in order. Exported so the table header
 * and the fields below it can never drift apart, and so a row that needs to
 * span the whole table (an error message) knows how wide the table is. The
 * `+ 1` is the actions column, which each row builds for itself.
 *
 * There is no Grupo column. Every row here is already inside the section for
 * its group, so the column repeated the heading once per row and bought
 * nothing; the control that moves an item to another group now lives in the
 * edit row's Concepto cell, where it is only rendered when it can be used.
 */
export const ITEM_COLUMNS: Column[] = [
  { label: 'Código', width: 'w-[104px]' },
  { label: 'Concepto' },
  { label: 'Unidad', width: 'w-[92px]' },
  { label: 'Coste', numeric: true, width: 'w-[104px]' },
  { label: 'Precio', numeric: true, width: 'w-[104px]' },
  { label: 'Activo', width: 'w-[72px]' },
]

export const ITEM_TABLE_COLUMN_COUNT = ITEM_COLUMNS.length + 1

export const CELL_CLASS = 'border-b border-line-soft px-2.5 py-1 align-middle'

/**
 * The editable cells shared by the edit row and the new-item row.
 *
 * Every control carries `form={formId}` instead of sitting inside the form.
 * A <form> is not valid between <tr> and <td>: the HTML parser hoists it out
 * of the table and takes its inputs with it, so the row would post an empty
 * body. The form element therefore lives in the row's actions cell and the
 * controls here join it by id.
 *
 * The names are on `aria-label`, not on a visible <label>. The column header
 * already names each field for a sighted reader, and repeating it inside
 * every row would double the height of a table whose whole point is density
 * -- but nothing is left unnamed for a screen reader.
 */
export function ItemFields({
  formId,
  groups,
  item,
  defaultGroupId,
}: {
  formId: string
  groups: GroupOption[]
  /** The row being edited, or undefined for the new-item row. */
  item?: PriceBookItem
  /** Which group the row starts out in. */
  defaultGroupId: string | null
}) {
  return (
    <>
      <td className={CELL_CLASS}>
        <input
          form={formId}
          name="code"
          aria-label="Código"
          defaultValue={item?.code ?? ''}
          maxLength={40}
          // The first field of a row that only ever appears in response to a
          // click, so taking focus here continues the gesture rather than
          // stealing it.
          autoFocus
          className={`${FIELD_CLASS} w-full font-mono`}
        />
      </td>
      <td className={CELL_CLASS}>
        <div className="flex flex-col gap-1">
          <input
            form={formId}
            name="name"
            aria-label="Concepto"
            defaultValue={item?.name ?? ''}
            maxLength={200}
            className={`${FIELD_CLASS} w-full`}
          />
          <input
            form={formId}
            name="description"
            aria-label="Descripción"
            defaultValue={item?.description ?? ''}
            maxLength={2000}
            className={`${FIELD_CLASS} w-full`}
          />
          {/*
            The only place an item changes group. It sits under the concept
            rather than in a column of its own because moving an item between
            groups is a rare edit, and a column for it cost every row of the
            table a repeat of its own section heading.
          */}
          <select
            form={formId}
            name="group_id"
            aria-label="Grupo"
            defaultValue={defaultGroupId ?? ''}
            className={`${FIELD_CLASS} w-full`}
          >
            <option value="">{UNGROUPED_NAME}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className={CELL_CLASS}>
        <select
          form={formId}
          name="unit"
          aria-label="Unidad"
          defaultValue={item?.unit ?? 'unit'}
          className={`${FIELD_CLASS} w-full`}
        >
          {UNIT_TYPES.map((unit) => (
            <option key={unit} value={unit}>
              {UNIT_LABELS[unit]}
            </option>
          ))}
        </select>
      </td>
      <td className={CELL_CLASS}>
        {/*
          Text, never type="number": staff type prices the Spanish way and a
          number input silently discards a comma, so '48,5' would post as ''.
          inputMode gets the numeric keypad on a phone without that cost.
        */}
        <input
          form={formId}
          name="unit_cost"
          aria-label="Coste"
          inputMode="decimal"
          defaultValue={item ? formatMoney(item.unitCost) : ''}
          className={`${FIELD_CLASS} num w-full text-right`}
        />
      </td>
      <td className={CELL_CLASS}>
        <input
          form={formId}
          name="unit_price"
          aria-label="Precio"
          inputMode="decimal"
          defaultValue={item ? formatMoney(item.unitPrice) : ''}
          className={`${FIELD_CLASS} num w-full text-right`}
        />
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
          className="size-4 accent-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </td>
    </>
  )
}
