import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/app/admin/page-header'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  listPriceBook,
  UNGROUPED_FILTER,
  UNGROUPED_NAME,
  type PriceBookGroupRef,
} from '@/lib/price-book/queries'
import { GroupSection } from './group-section'
import { ITEM_COLUMNS, ItemColumns } from './item-fields'
import { NewGroupForm } from './new-group-form'
import { HEADER_BUTTON_CLASS } from './ui'

export const metadata: Metadata = { title: 'Tarifario' }

/** Reads a query value that may legally arrive repeated (`?q=a&q=b`). */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/** Builds a link to this screen with one part of the query changed. */
function href(params: { q: string; group: string; page?: number }): string {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.group) query.set('group', params.group)
  // Page 1 is the default, so it stays out of the URL: a bookmark of the
  // first page and a bookmark of the unpaged screen should be one address.
  if (params.page && params.page > 1) query.set('page', String(params.page))
  const search = query.toString()
  return search ? `/admin/price-book?${search}` : '/admin/price-book'
}

const CHIP_CLASS =
  'flex h-7 shrink-0 items-center rounded-full border px-3 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const CHIP_OFF = `${CHIP_CLASS} border-line bg-surface text-ink-soft hover:bg-surface-hover`
const CHIP_ON = `${CHIP_CLASS} border-ink bg-ink text-canvas`

const PAGER_LINK_CLASS =
  'flex h-7 items-center rounded-md border border-line bg-surface px-2.5 text-xs text-ink-soft transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const PAGER_DEAD_CLASS =
  'flex h-7 items-center rounded-md border border-line px-2.5 text-xs text-faint'

function GroupChips({
  groups,
  current,
  q,
}: {
  groups: PriceBookGroupRef[]
  current: string
  q: string
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
      <Link href={href({ q, group: '' })} className={current === '' ? CHIP_ON : CHIP_OFF}>
        Todos
      </Link>
      {groups.map((group) => (
        <Link
          key={group.id}
          href={href({ q, group: group.id })}
          className={current === group.id ? CHIP_ON : CHIP_OFF}
        >
          {group.name}
        </Link>
      ))}
      <Link
        href={href({ q, group: UNGROUPED_FILTER })}
        className={current === UNGROUPED_FILTER ? CHIP_ON : CHIP_OFF}
      >
        {UNGROUPED_NAME}
      </Link>
    </div>
  )
}

export default async function PriceBookPage({ searchParams }: PageProps<'/admin/price-book'>) {
  const params = await searchParams
  const q = firstValue(params.q).trim()
  const group = firstValue(params.group)
  const requestedPage = Number.parseInt(firstValue(params.page), 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1

  const supabase = await requireAdmin()
  const listing = await listPriceBook(supabase, {
    search: q,
    groupId: group === '' ? null : group,
    page,
  })

  const filtering = q !== '' || group !== ''

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
      >
        {/*
          A plain GET form, not a controlled input: search has to survive a
          reload, be linkable, and work before any JavaScript arrives. The
          group filter rides along in a hidden field so searching does not
          silently drop it.
        */}
        <form action="/admin/price-book" className="flex items-center">
          <label className="flex h-8 w-72 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 focus-within:border-accent">
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="shrink-0 text-faint"
              aria-hidden="true"
            >
              <circle cx="7.2" cy="7.2" r="4.4" />
              <path d="m10.6 10.6 2.8 2.8" />
            </svg>
            <span className="sr-only">Buscar en el tarifario</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar código, concepto o descripción"
              className="w-full bg-transparent text-xs outline-none placeholder:text-faint"
            />
          </label>
          {group ? <input type="hidden" name="group" value={group} /> : null}
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>

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
      </PageHeader>

      <div className="flex items-center gap-4 border-b border-line bg-surface px-5 py-2.5">
        <div className="min-w-0 flex-1">
          <GroupChips groups={listing.allGroups} current={group} q={q} />
        </div>
        <div className="shrink-0">
          <NewGroupForm nextPosition={nextPosition} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
          {sections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-faint"
                aria-hidden="true"
              >
                <circle cx="7.2" cy="7.2" r="4.4" />
                <path d="m10.6 10.6 2.8 2.8" />
              </svg>
              <p className="text-sm text-muted">
                {filtering
                  ? 'Ningún concepto coincide con la búsqueda.'
                  : 'El tarifario está vacío. Crea un grupo para empezar.'}
              </p>
              {filtering ? (
                <Link href="/admin/price-book" className="text-xs text-accent underline">
                  Ver el tarifario entero
                </Link>
              ) : null}
            </div>
          ) : (
            <table className="w-full table-fixed border-collapse text-sm">
              <ItemColumns />
              <thead>
                <tr>
                  {ITEM_COLUMNS.map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      className={`sticky top-0 z-10 border-b border-line bg-surface px-3 py-2 text-2xs font-medium tracking-[0.05em] text-muted uppercase ${
                        column.numeric ? 'text-right' : 'text-left'
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="sticky top-0 z-10 border-b border-line bg-surface px-3 py-2"
                  >
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              {sections.map((section) => (
                <GroupSection
                  key={section.id ?? 'ungrouped'}
                  group={section}
                  groups={listing.allGroups}
                />
              ))}
            </table>
          )}

          {listing.pageCount > 1 ? (
            <nav
              aria-label="Páginas del tarifario"
              className="flex items-center gap-2 border-t border-line bg-surface-sunk px-3 py-2"
            >
              <span className="text-xs text-muted">
                Mostrando {listing.itemsShown} de {listing.itemsTotal} conceptos
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {listing.page > 1 ? (
                  <Link href={href({ q, group, page: listing.page - 1 })} className={PAGER_LINK_CLASS}>
                    Anterior
                  </Link>
                ) : (
                  <span className={PAGER_DEAD_CLASS}>Anterior</span>
                )}
                <span className="num flex h-7 items-center rounded-md border border-line bg-surface px-2.5 text-xs text-ink-soft">
                  {listing.page} / {listing.pageCount}
                </span>
                {listing.page < listing.pageCount ? (
                  <Link href={href({ q, group, page: listing.page + 1 })} className={PAGER_LINK_CLASS}>
                    Siguiente
                  </Link>
                ) : (
                  <span className={PAGER_DEAD_CLASS}>Siguiente</span>
                )}
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </>
  )
}
