import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/app/admin/page-header'
import { ActionBar } from '@/components/ui/action-bar'
import { PAGE_SIZES, Paginator } from '@/components/ui/paginator'
import { DataTable, TableEmpty, type TableColumn } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listClients } from '@/lib/clients/queries'
import { ClientRow } from './client-row'
import { NewClientButton } from './client-dialog'
import { CardCollection } from '@/components/ui/card-collection'
import { readListView, ViewToggle } from '@/components/ui/view-toggle'
import { getCompanySettings } from '@/lib/settings/queries'
import { ClientCards } from './client-cards'

export const metadata: Metadata = { title: 'Clientes' }

const COLUMNS: TableColumn[] = [
  { key: 'client', label: 'Cliente' },
  { key: 'phone', label: 'Teléfono', width: 'w-40' },
  { key: 'city', label: 'Localidad', width: 'w-52' },
  { key: 'quotes', label: 'Presupuestos', width: 'w-32', align: 'right' },
  { key: 'actions', label: 'Acciones', width: 'w-24', srOnly: true },
]

/** Reads a query value that may legally arrive repeated (`?q=a&q=b`). */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function ClientsPage({ searchParams }: PageProps<'/admin/clients'>) {
  const search = await searchParams

  const requestedSize = Number.parseInt(firstValue(search.size), 10)
  const requestedPage = Number.parseInt(firstValue(search.page), 10)

  const query = {
    q: firstValue(search.q).trim(),
    size: PAGE_SIZES.includes(requestedSize) ? requestedSize : PAGE_SIZES[1]!,
    page: Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1,
    // Cards unless the table was asked for (?vista=tabla).
    view: readListView(search.vista),
  }

  const base = '/admin/clients'

  /** This screen's address with part of the query changed. Defaults stay out. */
  function href(changes: Partial<typeof query> = {}): string {
    const next = { ...query, ...changes }
    const params = new URLSearchParams()
    if (next.q) params.set('q', next.q)
    if (next.size !== PAGE_SIZES[1]) params.set('size', String(next.size))
    if (next.page > 1) params.set('page', String(next.page))
    if (next.view === 'table') params.set('vista', 'tabla')
    const queryString = params.toString()
    return queryString ? `${base}?${queryString}` : base
  }

  const supabase = await requireAdmin()
  const [listing, settings] = await Promise.all([
    listClients(supabase, {
      search: query.q,
      page: query.page,
      pageSize: query.size,
    }),
    getCompanySettings(supabase),
  ])

  const searching = query.q !== ''

  const toolbar = (<ActionBar
              action={base}
              searchValue={query.q}
              searchLabel="Buscar clientes"
              searchPlaceholder="Buscar nombre, correo, teléfono o localidad"
              hidden={{
                ...(query.size === PAGE_SIZES[1] ? {} : { size: String(query.size) }),
                ...(query.view === 'table' ? { vista: 'tabla' } : {}),
              }}
            />
  )

  const empty = listing.clients.length === 0 ? (
              <TableEmpty
                message={
                  searching
                    ? 'Ningún cliente coincide con la búsqueda.'
                    : 'Todavía no hay clientes. Crea el primero para poder presupuestar.'
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
                    <circle cx="8" cy="5.6" r="2.6" />
                    <path d="M3 13.4c0-2.3 2.2-3.8 5-3.8s5 1.5 5 3.8" />
                  </svg>
                }
              >
                {searching ? (
                  <Link href={base} className="text-xs text-accent underline">
                    Ver todos los clientes
                  </Link>
                ) : null}
              </TableEmpty>
            ) : undefined

  const footer = (<Paginator
              page={listing.page}
              pageCount={listing.pageCount}
              pageSize={listing.pageSize}
              shown={listing.shown}
              total={listing.total}
              noun="clientes"
              pageHrefs={{
                previous: listing.page > 1 ? href({ page: listing.page - 1 }) : null,
                next: listing.page < listing.pageCount ? href({ page: listing.page + 1 }) : null,
              }}
              sizeHrefs={PAGE_SIZES.map((size) => ({ size, href: href({ size, page: 1 }) }))}
            />
  )

  return (
    <>
      <PageHeader
        title="Clientes"
        meta={
          searching
            ? `${listing.total} ${listing.total === 1 ? 'resultado' : 'resultados'}`
            : `${listing.total} ${listing.total === 1 ? 'cliente' : 'clientes'}`
        }
      >
        <ViewToggle current={query.view} hrefs={{ cards: href({ view: 'cards' }), table: href({ view: 'table' }) }} />
        <NewClientButton />
      </PageHeader>

      <div className="min-h-0 flex-1 p-4 md:p-6">
        <div className="flex h-full min-h-0 flex-col">
          {query.view === 'cards' ? (
            <CardCollection toolbar={toolbar} empty={empty} footer={footer}>
              <ClientCards clients={listing.clients} defaultVatRate={settings.defaultVatRate} />
            </CardCollection>
          ) : (
            <DataTable columns={COLUMNS} toolbar={toolbar} empty={empty} footer={footer}>
              <tbody>
                {listing.clients.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      </div>
    </>
  )
}
