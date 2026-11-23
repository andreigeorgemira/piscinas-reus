import type { Metadata } from 'next'
import { PageHeader } from '@/app/admin/page-header'
import { DataTable, TableEmpty, type TableColumn } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listPriceBooks } from '@/lib/price-book/queries'
import { NewPriceBookForm } from './new-price-book-form'
import { PriceBookRow } from './price-book-row'
import { PriceBookCards } from './price-book-cards'
import { CardCollection } from '@/components/ui/card-collection'
import { readListView, ViewToggle } from '@/components/ui/view-toggle'
import { plural } from '@/lib/plural'

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

export default async function PriceBooksPage({ searchParams }: PageProps<'/admin/price-books'>) {
  const view = readListView((await searchParams).vista)
  const supabase = await requireAdmin()
  const books = await listPriceBooks(supabase)

  const totalItems = books.reduce((sum, book) => sum + book.itemCount, 0)

  return (
    <>
      <PageHeader
        title="Tarifarios"
        meta={
          `${plural(books.length, 'tarifario', 'tarifarios')} · ${plural(totalItems, 'concepto', 'conceptos')}`
        }
      >
        <ViewToggle current={view} hrefs={{ cards: '/admin/price-books', table: '/admin/price-books?vista=tabla' }} />
      </PageHeader>

      <div className="min-h-0 flex-1 p-4 md:p-6">
        {view === 'cards' ? (
          <CardCollection
            empty={books.length === 0 ? <TableEmpty message="Todavía no hay ningún tarifario. Crea el primero." /> : undefined}
            footer={<NewPriceBookForm />}
          >
            <PriceBookCards books={books} />
          </CardCollection>
        ) : (
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
        )}
      </div>
    </>
  )
}
