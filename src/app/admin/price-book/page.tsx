import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/app/admin/page-header'
import { ACTION_BAR_FORM_ID, ActionBar } from '@/components/ui/action-bar'
import { PAGE_SIZES, Paginator } from '@/components/ui/paginator'
import { DataTable, TableEmpty } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  listPriceBook,
  UNGROUPED_FILTER,
  UNGROUPED_NAME,
  type ActiveFilter,
} from '@/lib/price-book/queries'
import { parseDecimal } from '@/lib/price-book/decimal'
import { UNIT_LABELS, UNIT_TYPES, type UnitType } from '@/lib/price-book/schema'
import { GroupSection } from './group-section'
import { PRICE_BOOK_COLUMNS } from './item-fields'
import { NewGroupForm } from './new-group-form'
import { HEADER_BUTTON_CLASS } from './ui'

export const metadata: Metadata = { title: 'Tarifario' }

const FILTER_FIELD_CLASS =
  'h-8 w-full rounded-md border border-line bg-surface px-2 text-xs text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/** Reads a query value that may legally arrive repeated (`?q=a&q=b`). */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

type Query = {
  q: string
  group: string
  unit: string
  costMin: string
  costMax: string
  active: ActiveFilter
  size: number
  page: number
}

/**
 * Builds an address for this screen with some of the query changed.
 *
 * Defaults stay out of the URL - page 1, the default page size, "todos" -
 * so the plain address and the address of the first unfiltered page are the
 * same string, and a link someone pastes into a chat is as short as it can
 * honestly be.
 */
function href(query: Query, changes: Partial<Query> = {}): string {
  const next = { ...query, ...changes }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.group) params.set('group', next.group)
  if (next.unit) params.set('unit', next.unit)
  if (next.costMin) params.set('costMin', next.costMin)
  if (next.costMax) params.set('costMax', next.costMax)
  if (next.active !== 'all') params.set('active', next.active)
  if (next.size !== PAGE_SIZES[1]) params.set('size', String(next.size))
  if (next.page > 1) params.set('page', String(next.page))
  const search = params.toString()
  return search ? `/admin/price-book?${search}` : '/admin/price-book'
}

export default async function PriceBookPage({ searchParams }: PageProps<'/admin/price-book'>) {
  const params = await searchParams

  const requestedSize = Number.parseInt(firstValue(params.size), 10)
  const requestedPage = Number.parseInt(firstValue(params.page), 10)
  const requestedActive = firstValue(params.active)
  const requestedUnit = firstValue(params.unit)

  const query: Query = {
    q: firstValue(params.q).trim(),
    group: firstValue(params.group),
    // Anything not in the enum is dropped rather than passed to the database:
    // the value reaches an .eq() on an enum column, and a typo in a pasted
    // URL should show the catalogue, not an error.
    unit: (UNIT_TYPES as readonly string[]).includes(requestedUnit) ? requestedUnit : '',
    costMin: firstValue(params.costMin).trim(),
    costMax: firstValue(params.costMax).trim(),
    active:
      requestedActive === 'active' || requestedActive === 'retired' ? requestedActive : 'all',
    size: PAGE_SIZES.includes(requestedSize) ? requestedSize : PAGE_SIZES[1]!,
    page: Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1,
  }

  const supabase = await requireAdmin()
  const listing = await listPriceBook(supabase, {
    search: query.q,
    groupId: query.group === '' ? null : query.group,
    unit: query.unit === '' ? null : (query.unit as UnitType),
    costMin: parseDecimal(query.costMin),
    costMax: parseDecimal(query.costMax),
    active: query.active,
    page: query.page,
    pageSize: query.size,
  })

  const filterCount =
    (query.group ? 1 : 0) +
    (query.unit ? 1 : 0) +
    (query.costMin ? 1 : 0) +
    (query.costMax ? 1 : 0) +
    (query.active !== 'all' ? 1 : 0)

  const filtering = filterCount > 0 || query.q !== ''

  // A group with nothing on this page is worth a heading only when the screen
  // is showing the catalogue whole: that is the empty group a staff member
  // just created and is about to fill. Under a filter, or on page two, an
  // empty heading says nothing and costs a screenful.
  const showEmptyGroups = !filtering && listing.page === 1
  const sections = listing.groups.filter((section) => section.items.length > 0 || showEmptyGroups)

  const nextPosition =
    listing.allGroups.length === 0
      ? 1
      : listing.groups.reduce((highest, section) => {
          // The ungrouped bucket carries a placeholder position, never a real one.
          return section.id === null ? highest : Math.max(highest, section.position)
        }, 0) + 1

  return (
    <>
      <PageHeader
        title="Tarifario"
        meta={
          filtering
            ? `${listing.itemsTotal} ${listing.itemsTotal === 1 ? 'resultado' : 'resultados'}`
            : `${listing.itemsTotal} conceptos · ${listing.allGroups.length} grupos`
        }
      />

      <ActionBar
        action="/admin/price-book"
        searchValue={query.q}
        searchLabel="Buscar en el tarifario"
        searchPlaceholder="Buscar código, concepto o descripción"
        hidden={query.size === PAGE_SIZES[1] ? undefined : { size: String(query.size) }}
        filterCount={filterCount}
        onClearFilters={href(query, {
          group: '',
          unit: '',
          costMin: '',
          costMax: '',
          active: 'all',
          page: 1,
        })}
        filters={
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-medium text-muted">Grupo</span>
              <select
                form={ACTION_BAR_FORM_ID}
                name="group"
                defaultValue={query.group}
                className={FILTER_FIELD_CLASS}
              >
                <option value="">Todos</option>
                {listing.allGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
                <option value={UNGROUPED_FILTER}>{UNGROUPED_NAME}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-2xs font-medium text-muted">Unidad</span>
              <select
                form={ACTION_BAR_FORM_ID}
                name="unit"
                defaultValue={query.unit}
                className={FILTER_FIELD_CLASS}
              >
                <option value="">Todas</option>
                {UNIT_TYPES.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABELS[unit]}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="flex flex-col gap-1">
              <legend className="text-2xs font-medium text-muted">Coste (€)</legend>
              <div className="flex items-center gap-2">
                <input
                  form={ACTION_BAR_FORM_ID}
                  name="costMin"
                  inputMode="decimal"
                  defaultValue={query.costMin}
                  placeholder="Desde"
                  aria-label="Coste desde"
                  className={`${FILTER_FIELD_CLASS} num text-right`}
                />
                <span aria-hidden="true" className="text-xs text-faint">
                  –
                </span>
                <input
                  form={ACTION_BAR_FORM_ID}
                  name="costMax"
                  inputMode="decimal"
                  defaultValue={query.costMax}
                  placeholder="Hasta"
                  aria-label="Coste hasta"
                  className={`${FILTER_FIELD_CLASS} num text-right`}
                />
              </div>
            </fieldset>

            <label className="flex flex-col gap-1">
              <span className="text-2xs font-medium text-muted">Estado</span>
              <select
                form={ACTION_BAR_FORM_ID}
                name="active"
                defaultValue={query.active}
                className={FILTER_FIELD_CLASS}
              >
                <option value="all">Todos</option>
                <option value="active">Solo activos</option>
                <option value="retired">Solo retirados</option>
              </select>
            </label>
          </div>
        }
      >
        <Link href="/admin/price-book/import" className={HEADER_BUTTON_CLASS}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 10.4V2.6" />
            <path d="M5.2 7.6 8 10.4l2.8-2.8" />
            <path d="M2.8 11.4v1.2a.8.8 0 0 0 .8.8h8.8a.8.8 0 0 0 .8-.8v-1.2" />
          </svg>
          Importar CSV
        </Link>
      </ActionBar>

      <div className="min-h-0 flex-1 p-5">
        <DataTable
          columns={PRICE_BOOK_COLUMNS}
          empty={
            sections.length === 0 ? (
              <TableEmpty
                message={
                  filtering
                    ? 'Ningún concepto coincide con la búsqueda.'
                    : 'El tarifario está vacío. Crea un grupo para empezar.'
                }
                icon={
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="7.2" cy="7.2" r="4.4" />
                    <path d="m10.6 10.6 2.8 2.8" />
                  </svg>
                }
              >
                {filtering ? (
                  <Link href="/admin/price-book" className="text-xs text-accent underline">
                    Ver el tarifario entero
                  </Link>
                ) : null}
              </TableEmpty>
            ) : undefined
          }
          footer={
            <>
              <NewGroupForm nextPosition={nextPosition} />
              <Paginator
                page={listing.page}
                pageCount={listing.pageCount}
                pageSize={listing.pageSize}
                shown={listing.itemsShown}
                total={listing.itemsTotal}
                noun="conceptos"
                pageHrefs={{
                  previous: listing.page > 1 ? href(query, { page: listing.page - 1 }) : null,
                  next:
                    listing.page < listing.pageCount
                      ? href(query, { page: listing.page + 1 })
                      : null,
                }}
                sizeHrefs={PAGE_SIZES.map((size) => ({
                  size,
                  href: href(query, { size, page: 1 }),
                }))}
              />
            </>
          }
        >
          {sections.map((section) => (
            <GroupSection
              key={section.id ?? 'ungrouped'}
              group={section}
              groups={listing.allGroups}
              paginated={listing.pageCount > 1}
              groupHref={href(query, {
                group: section.id ?? UNGROUPED_FILTER,
                page: 1,
              })}
            />
          ))}
        </DataTable>
      </div>
    </>
  )
}
