import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/app/admin/page-header'
import { GroupSection } from '@/app/admin/price-book/group-section'
import { GroupsOpenProvider, ToggleAllGroups } from '@/app/admin/price-book/groups-open'
import { ItemDragArea } from '@/app/admin/price-book/item-dnd'
import { PRICE_BOOK_COLUMNS } from '@/app/admin/price-book/item-fields'
import { NewGroupForm } from '@/app/admin/price-book/new-group-form'
import { ACTION_BAR_FORM_ID, ActionBar, FilterChip } from '@/components/ui/action-bar'
import { PAGE_SIZES, Paginator } from '@/components/ui/paginator'
import { DataTable, TableEmpty } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { parseDecimal } from '@/lib/price-book/decimal'
import {
  getPriceBook,
  listPriceBook,
  UNGROUPED_FILTER,
  UNGROUPED_NAME,
  type ActiveFilter,
} from '@/lib/price-book/queries'
import { UNIT_LABELS, UNIT_TYPES, type UnitType } from '@/lib/price-book/schema'

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

export default async function PriceBookDetailPage({
  params,
  searchParams,
}: PageProps<'/admin/price-books/[id]'>) {
  const { id } = await params
  const search = await searchParams

  const requestedSize = Number.parseInt(firstValue(search.size), 10)
  const requestedPage = Number.parseInt(firstValue(search.page), 10)
  const requestedActive = firstValue(search.active)
  const requestedUnit = firstValue(search.unit)

  const query: Query = {
    q: firstValue(search.q).trim(),
    group: firstValue(search.group),
    // Anything not in the enum is dropped rather than passed to the database:
    // the value reaches an .eq() on an enum column, and a typo in a pasted
    // URL should show the catalogue, not an error.
    unit: (UNIT_TYPES as readonly string[]).includes(requestedUnit) ? requestedUnit : '',
    costMin: firstValue(search.costMin).trim(),
    costMax: firstValue(search.costMax).trim(),
    active: requestedActive === 'active' || requestedActive === 'retired' ? requestedActive : 'all',
    size: PAGE_SIZES.includes(requestedSize) ? requestedSize : PAGE_SIZES[1]!,
    page: Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1,
  }

  const base = `/admin/price-books/${id}`

  /**
   * Builds an address for this screen with some of the query changed.
   *
   * Defaults stay out of the URL - page 1, the default page size, "todos" -
   * so the plain address and the address of the first unfiltered page are the
   * same string.
   */
  function href(changes: Partial<Query> = {}): string {
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
    const queryString = params.toString()
    return queryString ? `${base}?${queryString}` : base
  }

  const supabase = await requireAdmin()

  const book = await getPriceBook(supabase, id)
  if (!book) {
    notFound()
  }

  const filterCount =
    (query.group ? 1 : 0) +
    (query.unit ? 1 : 0) +
    (query.costMin ? 1 : 0) +
    (query.costMax ? 1 : 0) +
    (query.active !== 'all' ? 1 : 0)

  const filtering = filterCount > 0 || query.q !== ''

  const listing = await listPriceBook(supabase, {
    priceBookId: id,
    search: query.q,
    groupId: query.group === '' ? null : query.group,
    unit: query.unit === '' ? null : (query.unit as UnitType),
    costMin: parseDecimal(query.costMin),
    costMax: parseDecimal(query.costMax),
    active: query.active,
    page: query.page,
    // Unfiltered, the whole book is on one screen: a group split across two
    // pages is a group whose concepts you cannot see together. A search is
    // different -- it has no groups to keep whole -- so it pages.
    pageSize: filtering ? query.size : null,
  })

  /**
   * How many rows the screen will mount without being asked. Past this, the
   * book arrives folded and mounts a group's rows when that group is opened:
   * the alternative, paging the unfiltered view, splits groups, and a group
   * split across two pages is a group whose concepts you cannot see together.
   * Under a filter the rows are the answer to a question, so they stay open.
   */
  const FOLD_ABOVE = 300
  const startGroupsOpen = filtering || listing.itemsShown <= FOLD_ABOVE

  const groupName =
    query.group === UNGROUPED_FILTER
      ? UNGROUPED_NAME
      : (listing.allGroups.find((group) => group.id === query.group)?.name ?? '')

  // One chip per filter in force, each carrying the address that lifts just
  // that one. The badge on the button says how many; these say which.
  const chips = [
    query.group && groupName ? (
      <FilterChip key="group" label="Grupo" value={groupName} href={href({ group: '', page: 1 })} />
    ) : null,
    query.unit ? (
      <FilterChip
        key="unit"
        label="Unidad"
        value={UNIT_LABELS[query.unit as UnitType]}
        href={href({ unit: '', page: 1 })}
      />
    ) : null,
    query.costMin || query.costMax ? (
      <FilterChip
        key="cost"
        label="Coste"
        value={
          query.costMin && query.costMax
            ? `${query.costMin} – ${query.costMax} €`
            : query.costMin
              ? `desde ${query.costMin} €`
              : `hasta ${query.costMax} €`
        }
        href={href({ costMin: '', costMax: '', page: 1 })}
      />
    ) : null,
    query.active !== 'all' ? (
      <FilterChip
        key="active"
        label="Estado"
        value={query.active === 'active' ? 'Solo activos' : 'Solo retirados'}
        href={href({ active: 'all', page: 1 })}
      />
    ) : null,
  ].filter(Boolean)

  // Every group shows, whatever the page: that is the whole point of not
  // paging the grouped view. Under a filter, only the groups with a match.
  const sections = listing.groups.filter((section) => section.items.length > 0 || !filtering)

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
        title={book.name}
        meta={
          filtering
            ? `${listing.itemsTotal} ${listing.itemsTotal === 1 ? 'resultado' : 'resultados'}`
            : `${book.itemCount} conceptos · ${book.groupCount} grupos`
        }
      >
        <Link
          href="/admin/price-books"
          className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9.8 3.6 5.4 8l4.4 4.4" />
          </svg>
          Todos los tarifarios
        </Link>
      </PageHeader>

      <ItemDragArea className="min-h-0 flex-1 p-5">
        <GroupsOpenProvider>
          <DataTable
            columns={PRICE_BOOK_COLUMNS}
            toolbar={
              <ActionBar
                action={base}
                searchValue={query.q}
                searchLabel="Buscar en el tarifario"
                searchPlaceholder="Buscar código, concepto o descripción"
                hidden={query.size === PAGE_SIZES[1] ? undefined : { size: String(query.size) }}
                filterCount={filterCount}
                onClearFilters={href({
                  group: '',
                  unit: '',
                  costMin: '',
                  costMax: '',
                  active: 'all',
                  page: 1,
                })}
                chips={chips.length > 0 ? chips : undefined}
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
                <ToggleAllGroups />
                <Link
                  href={`${base}/import`}
                  className="flex h-9 items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 text-xs font-medium text-accent transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
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
            }
            empty={
              sections.length === 0 ? (
                <TableEmpty
                  message={
                    filtering
                      ? 'Ningún concepto coincide con la búsqueda.'
                      : 'Este tarifario está vacío. Crea un grupo para empezar.'
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
                    <Link href={base} className="text-xs text-accent underline">
                      Ver el tarifario entero
                    </Link>
                  ) : null}
                </TableEmpty>
              ) : undefined
            }
            footer={
              <>
                {/*
                  PostgREST caps a response at 1000 rows, so an unpaged read
                  of a very large book is a slice. Saying so is the whole
                  point of the flag: a slice that stays quiet is the bug.
                */}
                {listing.capped ? (
                  <p className="border-t border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
                    Este tarifario tiene {listing.itemsTotal} conceptos y la pantalla muestra los{' '}
                    {listing.itemsShown} primeros. Busca o filtra para llegar al resto.
                  </p>
                ) : null}
                <NewGroupForm priceBookId={id} nextPosition={nextPosition} />
                {filtering ? (
                  <Paginator
                    page={listing.page}
                    pageCount={listing.pageCount}
                    pageSize={listing.pageSize}
                    shown={listing.itemsShown}
                    total={listing.itemsTotal}
                    noun="conceptos"
                    pageHrefs={{
                      previous: listing.page > 1 ? href({ page: listing.page - 1 }) : null,
                      next:
                        listing.page < listing.pageCount ? href({ page: listing.page + 1 }) : null,
                    }}
                    sizeHrefs={PAGE_SIZES.map((size) => ({
                      size,
                      href: href({ size, page: 1 }),
                    }))}
                  />
                ) : null}
              </>
            }
          >
            {sections.map((section) => (
              <GroupSection
                key={section.id ?? 'ungrouped'}
                group={section}
                groups={listing.allGroups}
                priceBookId={id}
                filtering={filtering}
                startOpen={startGroupsOpen}
              />
            ))}
          </DataTable>
        </GroupsOpenProvider>
      </ItemDragArea>
    </>
  )
}
