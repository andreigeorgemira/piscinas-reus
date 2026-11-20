import type { Metadata } from 'next'
import { safeNextPath } from '@/lib/safe-next-path'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Acceso' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* The brand half: water, and what the place is for. Decorative only --
          everything a screen reader needs is in the form beside it. */}
      <section
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-shell lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="brand-backdrop absolute inset-0" />
        <svg className="absolute right-0 bottom-0 left-0 w-full text-shell-accent/20" viewBox="0 0 800 160" preserveAspectRatio="none" fill="currentColor">
          <path d="M0 80c80 0 80 30 160 30s80-30 160-30 80 30 160 30 80-30 160-30 80 30 160 30V160H0Z" />
          <path d="M0 110c80 0 80 25 160 25s80-25 160-25 80 25 160 25 80-25 160-25 80 25 160 25V160H0Z" opacity="0.6" />
        </svg>
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center brand-mark rounded-xl">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 13.8c1.1 0 1.1 1.1 2.2 1.1s1.1-1.1 2.2-1.1 1.1 1.1 2.2 1.1 1.1-1.1 2.2-1.1 1.1 1.1 2.2 1.1 1.1-1.1 2.2-1.1" />
              <path d="M6 12.2V5.6a1.6 1.6 0 0 1 3.2 0" />
              <path d="M13.4 12.2V4.8" />
              <path d="M13.4 8.6H9.2" />
            </svg>
          </span>
          <span className="text-base font-semibold text-shell-ink">Piscinas Reus</span>
        </div>
        <div className="relative max-w-md pb-16">
          <p className="text-3xl leading-tight font-semibold -tracking-[0.02em] text-shell-ink">
            Presupuestos claros, firmados desde el móvil.
          </p>
          <p className="pt-3 text-sm leading-6 text-shell-muted">
            Tarifarios, presupuestos, firma del cliente y obras en un solo sitio.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <span className="flex size-10 items-center justify-center brand-mark rounded-xl lg:hidden" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 13.8c1.1 0 1.1 1.1 2.2 1.1s1.1-1.1 2.2-1.1 1.1 1.1 2.2 1.1 1.1-1.1 2.2-1.1 1.1 1.1 2.2 1.1 1.1-1.1 2.2-1.1" />
                <path d="M6 12.2V5.6a1.6 1.6 0 0 1 3.2 0" />
                <path d="M13.4 12.2V4.8" />
                <path d="M13.4 8.6H9.2" />
              </svg>
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
