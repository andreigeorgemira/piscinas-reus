import type { Metadata } from 'next'
import { safeNextPath } from '@/lib/safe-next-path'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Acceso' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Acceso</h1>
      <LoginForm nextPath={safeNextPath(next)} />
    </main>
  )
}
