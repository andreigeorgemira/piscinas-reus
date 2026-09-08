import { signOut } from '@/app/auth/actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AdminHomePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Panel</h1>
        <form action={signOut}>
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">
            Salir
          </button>
        </form>
      </div>
      <p className="text-sm text-slate-600">Sesión iniciada como {user?.email}</p>
    </main>
  )
}
