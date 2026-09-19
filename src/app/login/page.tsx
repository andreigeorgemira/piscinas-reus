import type { Metadata } from 'next'
import { safeNextPath } from '@/lib/safe-next-path'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Acceso' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas p-6">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-[7px] border border-line bg-surface p-6">
        <div className="flex items-center gap-2.5">
          <svg
            width="22"
            height="22"
            viewBox="0 0 20 20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 14c1.1 0 1.1 1.1 2.2 1.1S5.8 14 6.9 14s1.1 1.1 2.2 1.1S10.2 14 11.3 14s1.1 1.1 2.2 1.1S14.6 14 15.7 14s1.1 1.1 1.8 1.1" />
            <path d="M6 12.4V5.6a1.6 1.6 0 0 1 3.2 0" />
            <path d="M13.4 12.4V4.8" />
            <path d="M13.4 8.6H9.2" />
          </svg>
          <h1 className="text-xl font-semibold -tracking-[0.01em]">Acceso</h1>
        </div>
        <LoginForm nextPath={safeNextPath(next)} />
      </div>
    </main>
  )
}
