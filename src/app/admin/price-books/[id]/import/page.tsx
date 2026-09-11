import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/app/admin/page-header'
import { requireAdmin } from '@/lib/auth/require-admin'
import { HEADER_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { ImportForm } from '@/app/admin/price-book/import/import-form'

export const metadata: Metadata = { title: 'Importar tarifario' }

/**
 * The two Server Actions this screen calls (previewImport, commitImport) gate
 * themselves with requireAdmin -- they are POST endpoints reachable directly,
 * with or without this page. Gating the page too just keeps a non-admin from
 * seeing that the screen exists at all.
 */
export default async function ImportPriceBookPage({
  params,
}: PageProps<'/admin/price-books/[id]/import'>) {
  const { id } = await params
  await requireAdmin()

  return (
    <>
      <PageHeader title="Importar tarifario">
        <Link href={`/admin/price-books/${id}`} className={HEADER_BUTTON_CLASS}>
          Volver al tarifario
        </Link>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-5">
        <ImportForm priceBookId={id} />
      </div>
    </>
  )
}
