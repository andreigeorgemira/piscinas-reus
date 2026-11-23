import Link from 'next/link'
import { BrandMark } from '@/components/ui/brand-mark'
import { readTradeName } from '@/lib/settings/brand'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/** Read per request: the name comes from Ajustes, and the build has no database. */
export const dynamic = 'force-dynamic'

/**
 * The public home, until the company has a site of its own: its name from
 * Ajustes and the way in. Read with the service role because the visitor has no
 * session; the trade name is printed on every quote, so it is no secret.
 */
export default async function HomePage() {
  let name: string | null = null
  try {
    name = await readTradeName(createAdminSupabaseClient())
  } catch {
    name = null
  }
  const shown = name ?? 'Presupuestos'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas p-8 text-center">
      <BrandMark name={shown} size="lg" />
      <h1 className="text-3xl font-semibold -tracking-[0.02em]">{shown}</h1>
      <p className="text-sm text-muted">Sitio en construcción.</p>
      <Link
        href="/login"
        className="flex h-10 items-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Acceso
      </Link>
    </main>
  )
}
