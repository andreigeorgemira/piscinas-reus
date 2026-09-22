import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/app/admin/page-header'
import { HEADER_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { NewQuoteButton } from '@/app/admin/quotes/new-quote-dialog'
import { QuoteRow } from '@/app/admin/quotes/quote-row'
import { DataTable, TableEmpty, type TableColumn } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getClient } from '@/lib/clients/queries'
import { listQuotes } from '@/lib/quotes/queries'
import { EditClientButton } from '../client-dialog'

export const metadata: Metadata = { title: 'Cliente' }

/** The quotes of one client: the reference column already says whose they are. */
const COLUMNS: TableColumn[] = [
  { key: 'reference', label: 'Referencia' },
  { key: 'client', label: 'Cliente', width: 'w-36' },
  { key: 'status', label: 'Estado', width: 'w-36' },
  { key: 'lines', label: 'Líneas', width: 'w-20', align: 'right' },
  { key: 'created', label: 'Creado', width: 'w-28' },
  { key: 'valid', label: 'Válido hasta', width: 'w-32' },
  { key: 'total', label: 'Total', width: 'w-32', align: 'right' },
  { key: 'margin', label: 'Margen', width: 'w-28', align: 'right' },
  { key: 'actions', label: 'Acciones', width: 'w-24', srOnly: true },
]

/** How many of a client's quotes the page shows before sending you to the list. */
const SHOWN_QUOTES = 25

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-medium tracking-[0.05em] text-muted uppercase">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

/**
 * One client, and what has been quoted to them.
 *
 * This is where a quote is usually started: staff look the client up, read what
 * was offered last time, and open the next one from the button in this header
 * with the client already filled in.
 */
export default async function ClientPage({ params }: PageProps<'/admin/clients/[id]'>) {
  const { id } = await params

  const supabase = await requireAdmin()

  const client = await getClient(supabase, id)
  if (!client) {
    notFound()
  }

  const listing = await listQuotes(supabase, { clientId: id, pageSize: SHOWN_QUOTES })

  const created = new Date(client.createdAt).toLocaleDateString('es-ES')

  return (
    <>
      <PageHeader
        title={client.fullName}
        meta={
          <span className="flex items-center gap-2">
            <span className="max-w-[20rem] truncate">{client.email}</span>
            {client.city ? <span className="text-faint">{client.city}</span> : null}
          </span>
        }
      >
        <Link
          href="/admin/clients"
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
          Clientes
        </Link>
        <EditClientButton
          client={client}
          label={`Editar ${client.fullName}`}
          className={HEADER_BUTTON_CLASS}
        >
          Editar
        </EditClientButton>
        <NewQuoteButton client={{ id: client.id, fullName: client.fullName }} />
      </PageHeader>

      <div className="flex min-h-0 flex-1 gap-5 p-5">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DataTable
            columns={COLUMNS}
            empty={
              listing.quotes.length === 0 ? (
                <TableEmpty message="Este cliente todavía no tiene presupuestos." />
              ) : undefined
            }
            footer={
              listing.total > listing.shown ? (
                <div className="border-t border-line px-3 py-2">
                  <Link
                    href={`/admin/quotes?client=${client.id}`}
                    className="text-xs text-accent underline"
                  >
                    Ver los {listing.total} presupuestos de este cliente
                  </Link>
                </div>
              ) : undefined
            }
          >
            <tbody>
              {listing.quotes.map((quote) => (
                <QuoteRow key={quote.id} quote={quote} />
              ))}
            </tbody>
          </DataTable>
        </div>

        <aside
          aria-label="Ficha del cliente"
          className="flex w-[21rem] shrink-0 flex-col gap-4 overflow-y-auto"
        >
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
            <h2 className="text-sm font-semibold">Ficha</h2>

            <Row label="Correo">
              <span className="break-all">{client.email}</span>
            </Row>
            <Row label="Teléfono">
              <span className="num">{client.phone ?? '—'}</span>
            </Row>
            <Row label="Dirección">
              {client.address ?? '—'}
              {client.postalCode || client.city ? (
                <span className="block text-xs text-muted">
                  <span className="num">{client.postalCode ?? ''}</span>{' '}
                  {client.city ?? ''}
                </span>
              ) : null}
            </Row>
            <Row label="Cuenta del portal">
              {/*
                clients.user_id is written by the account-linking trigger when
                somebody registers with this email (0008_account_linking.sql),
                never by the form on this screen. Saying which of the two states
                it is in is the whole value of the row.
              */}
              <span className={client.userId ? 'text-success' : 'text-muted'}>
                {client.userId ? 'Vinculada' : 'Sin cuenta'}
              </span>
            </Row>
            <Row label="Alta">
              <span className="num">{created}</span>
            </Row>
            {client.notes ? (
              <Row label="Notas">
                <span className="block text-xs whitespace-pre-line text-ink-soft">
                  {client.notes}
                </span>
              </Row>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  )
}
