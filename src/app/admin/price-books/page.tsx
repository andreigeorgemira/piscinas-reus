import type { Metadata } from 'next'
import { PageHeader } from '@/app/admin/page-header'
import { DataTable, TableEmpty, type TableColumn } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listPriceBooks } from '@/lib/price-book/queries'
import { NewPriceBookForm } from './new-price-book-form'
import { PriceBookRow } from './price-book-row'

export const metadata: Metadata = { title: 'Tarifarios' }

/**
 * Two columns for the name so the description has room to run under it, and
 * the two counts on the right where numbers belong. Every screen in this app
 * uses the same table shell, and this is the shape it takes here.
 */
const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Tarifario' },
  { key: 'spacer', label: '', width: 'w-0', srOnly: true },
  { key: 'groups', label: 'Grupos', width: 'w-28', align: 'right' },
  { key: 'items', label: 'Conceptos', width: 'w-32', align: 'right' },
  { key: 'actions', label: 'Acciones', width: 'w-24', srOnly: true },
]

export default async function PriceBooksPage() {
  const supabase = await requireAdmin()
  const books = await listPriceBooks(supabase)

  const totalItems = books.reduce((sum, book) => sum + book.itemCount, 0)

  return (
    <>
      <PageHeader
        title="Tarifarios"
        meta={
          books.length === 1
            ? `1 tarifario · ${totalItems} conceptos`
            : `${books.length} tarifarios · ${totalItems} conceptos`
        }
      />

      <div className="min-h-0 flex-1 p-5">
        <DataTable
          columns={COLUMNS}
          empty={
            books.length === 0 ? (
              <TableEmpty message="Todavía no hay ningún tarifario. Crea el primero." />
            ) : undefined
          }
          footer={<NewPriceBookForm />}
        >
          <tbody>
            {books.map((book) => (
              <PriceBookRow key={book.id} book={book} />
            ))}
          </tbody>
        </DataTable>
      </div>
    </>
  )
}
