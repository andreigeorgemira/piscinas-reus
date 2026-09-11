import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/app/admin/page-header'
import { requireAdmin } from '@/lib/auth/require-admin'
import { ImportForm } from './import-form'

export const metadata: Metadata = { title: 'Importar tarifario' }

/**
 * The two Server Actions this screen calls (previewImport, commitImport) gate
 * themselves with requireAdmin -- they are POST endpoints reachable directly,
 * with or without this page. Gating the page too just keeps a non-admin from
 * seeing that the screen exists at all.
 */
export default async function ImportPriceBookPage() {
  await requireAdmin()

  return (
    <>
      <PageHeader title="Importar tarifario">
        <Link
          href="/admin/price-book"
          className="flex h-[30px] items-center rounded-[5px] border border-line bg-surface px-2.5 text-xs font-medium text-ink-soft hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Volver al tarifario
        </Link>
      </PageHeader>

      <div className="p-5">
        <ImportForm />
      </div>
    </>
  )
}
