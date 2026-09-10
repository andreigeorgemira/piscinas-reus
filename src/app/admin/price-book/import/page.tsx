import type { Metadata } from 'next'
import Link from 'next/link'
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
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/price-book"
          className="w-fit text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400"
        >
          ← Tarifario
        </Link>
        <h1 className="text-2xl font-semibold">Importar tarifario</h1>
      </div>

      <ImportForm />
    </main>
  )
}
