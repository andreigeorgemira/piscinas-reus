import type { Metadata } from 'next'
import { safeNextPath } from '@/lib/safe-next-path'
import { BrandMark } from '@/components/ui/brand-mark'
import { readTradeName } from '@/lib/settings/brand'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Acceso' }

/**
 * The company's name for the sign-in screen, read with the service role: the
 * visitor has no session yet and company_settings is staff-only. One column of
 * one row, never a secret -- it is printed on every quote.
 */
async function tradeName(): Promise<string | null> {
  try {
    return await readTradeName(createAdminSupabaseClient())
  } catch {
    return null
  }
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams
  const name = (await tradeName()) ?? 'Panel de gestión'

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* The company half. Decorative only -- everything a screen reader needs
          is in the form beside it. */}
      <section
        aria-hidden="true"
        className="hidden bg-primary text-primary-ink lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="flex items-center gap-3">
          <BrandMark name={name} size="lg" tone="inverse" />
          <span className="text-base font-semibold">{name}</span>
        </div>
        <div className="max-w-md">
          <p className="text-3xl leading-tight font-semibold -tracking-[0.02em]">
            Presupuestos claros, firmados desde el móvil.
          </p>
          <p className="pt-3 text-sm leading-6 opacity-70">
            Tarifarios, presupuestos, firma del cliente y proyectos en un solo sitio.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <span className="lg:hidden">
              <BrandMark name={name} size="lg" />
            </span>
            <h1 className="pt-2 text-2xl font-semibold -tracking-[0.02em]">Acceso</h1>
            <p className="text-sm text-muted">Entra con tu correo y contraseña.</p>
          </div>
          <LoginForm nextPath={safeNextPath(next)} />
        </div>
      </section>
    </main>
  )
}
