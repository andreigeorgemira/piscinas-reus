import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/app/admin/page-header'
import { ACTION_BAR_FORM_ID, ActionBar, FilterChip } from '@/components/ui/action-bar'
import { PAGE_SIZES, Paginator } from '@/components/ui/paginator'
import { DataTable, TableEmpty, type TableColumn } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listClientOptions } from '@/lib/clients/queries'
import { listQuotes } from '@/lib/quotes/queries'
import { QUOTE_STATUS_LABELS, QUOTE_STATUSES, type QuoteStatus } from '@/lib/quotes/status'
import { NewQuoteButton } from './new-quote-dialog'
import { QuoteRow } from './quote-row'

export const metadata: Metadata = { title: 'Presupuestos' }

const COLUMNS: TableColumn[] = [
  { key: 'reference', label: 'Referencia' },
  { key: 'client', label: 'Cliente', width: 'w-56' },
  { key: 'status', label: 'Estado', width: 'w-32' },
  { key: 'created', label: 'Creado', width: 'w-28' },
  { key: 'valid', label: 'Válido hasta', width: 'w-32' },
  { key: 'total', label: 'Total', width: 'w-32', align: 'right' },
  { key: 'margin', label: 'Margen', width: 'w-28', align: 'right' },
]

const FILTER_FIELD_CLASS =
  'h-8 w-full rounded-md border border-line bg-surface px-2 text-xs text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/** Reads a query value that may legally arrive repeated (`?q=a&q=b`). */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function QuotesPage({ searchParams }: PageProps<'/admin/quotes'>) {
  const search = await searchParams

  const requestedSize = Number.parseInt(firstValue(search.size), 10)
  const requestedPage = Number.parseInt(firstValue(search.page), 10)
  const requestedStatus = firstValue(search.status)

  const query = {
    q: firstValue(search.q).trim(),
    // Anything not in the enum is dropped rather than passed to an .eq() on an
    // enum column: a typo in a pasted URL should show the list, not an error.
    status: (QUOTE_STATUSES as readonly string[]).includes(requestedStatus) ? requestedStatus : '',
    client: firstValue(search.client),
    size: PAGE_SIZES.includes(requestedSize) ? requestedSize : PAGE_SIZES[1]!,
    page: Number.isFinite(requestedPage) && requestedPage > 1 ? requestedPage : 1,
  }

  const base = '/admin/quotes'

  /** This screen's address with part of the query changed. Defaults stay out. */
  function href(changes: Partial<typeof query> = {}): string {
    const next = { ...query, ...changes }
    const params = new URLSearchParams()
    if (next.q) params.set('q', next.q)
    if (next.status) params.set('status', next.status)
    if (next.client) params.set('client', next.client)
    if (next.size !== PAGE_SIZES[1]) params.set('size', String(next.size))
    if (next.page > 1) params.set('page', String(next.page))
    const queryString = params.toString()
    return queryString ? `${base}?${queryString}` : base
  }

  const supabase = await requireAdmin()

  const [listing, clients] = await Promise.all([
    listQuotes(supabase, {
      search: query.q,
      status: query.status === '' ? null : (query.status as QuoteStatus),
      clientId: query.client === '' ? null : query.client,
      page: query.page,
      pageSize: query.size,
    }),
    listClientOptions(supabase),
  ])

  const filterCount = (query.status ? 1 : 0) + (query.client ? 1 : 0)
  const filtering = filterCount > 0 || query.q !== ''

  const clientName = clients.find((option) => option.id === query.client)?.fullName ?? ''

  const chips = [
    query.status ? (
      <FilterChip
        key="status"
        label="Estado"
        value={QUOTE_STATUS_LABELS[query.status as QuoteStatus]}
        href={href({ status: '', page: 1 })}
      />
    ) : null,
    query.client && clientName ? (
      <FilterChip
        key="client"
        label="Cliente"
        value={clientName}
        href={href({ client: '', page: 1 })}
      />
    ) : null,
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title="Presupuestos"
        meta={
          filtering
            ? `${listing.total} ${listing.total === 1 ? 'resultado' : 'resultados'}`
            : `${listing.total} ${listing.total === 1 ? 'presupuesto' : 'presupuestos'}`
        }
      />

      <div className="min-h-0 flex-1 p-5">
        <DataTable
          columns={COLUMNS}
          toolbar={
            <ActionBar
              action={base}
              searchValue={query.q}
              searchLabel="Buscar presupuestos"
              searchPlaceholder="Buscar referencia, título o cliente"
              hidden={query.size === PAGE_SIZES[1] ? undefined : { size: String(query.size) }}
              filterCount={filterCount}
              onClearFilters={href({ status: '', client: '', page: 1 })}
              chips={chips.length > 0 ? chips : undefined}
              filters={
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-medium text-muted">Estado</span>
                    <select
                      form={ACTION_BAR_FORM_ID}
                      name="status"
                      defaultValue={query.status}
                      className={FILTER_FIELD_CLASS}
                    >
                      <option value="">Todos</option>
                      {QUOTE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {QUOTE_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-medium text-muted">Cliente</span>
                    <select
                      form={ACTION_BAR_FORM_ID}
                      name="client"
                      defaultValue={query.client}
                      className={FILTER_FIELD_CLASS}
                    >
                      <option value="">Todos</option>
                      {clients.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              }
            >
              <NewQuoteButton clients={clients} />
            </ActionBar>
          }
          empty={
            listing.quotes.length === 0 ? (
              <TableEmpty
                message={
                  filtering
                    ? 'Ningún presupuesto coincide con la búsqueda.'
                    : 'Todavía no hay presupuestos. Crea el primero.'
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
                    <path d="M3.4 2.6h9.2v10.8H3.4Z" />
                    <path d="M5.6 5.8h4.8M5.6 8h4.8M5.6 10.2h2.8" />
                  </svg>
                }
              >
                {filtering ? (
                  <Link href={base} className="text-xs text-accent underline">
                    Ver todos los presupuestos
                  </Link>
                ) : null}
              </TableEmpty>
            ) : undefined
          }
          footer={
            <Paginator
              page={listing.page}
              pageCount={listing.pageCount}
              pageSize={listing.pageSize}
              shown={listing.shown}
              total={listing.total}
              noun="presupuestos"
              pageHrefs={{
                previous: listing.page > 1 ? href({ page: listing.page - 1 }) : null,
                next: listing.page < listing.pageCount ? href({ page: listing.page + 1 }) : null,
              }}
              sizeHrefs={PAGE_SIZES.map((size) => ({ size, href: href({ size, page: 1 }) }))}
            />
          }
        >
          <tbody>
            {listing.quotes.map((quote) => (
              <QuoteRow key={quote.id} quote={quote} />
            ))}
          </tbody>
        </DataTable>
      </div>
    </>
  )
}
