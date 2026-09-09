import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Gates a Server Component or Server Action to staff only, redirecting
 * everyone else instead of rendering for them.
 *
 * Every admin-only table is already locked down by RLS
 * (supabase/migrations/0003_rls_policies.sql) - that is the real
 * authorization boundary, and this function grants no access RLS would
 * otherwise refuse. But the route guard in src/lib/supabase/middleware.ts
 * only runs in front of a *rendered page*; a Server Action is a POST
 * endpoint reachable directly, without ever going through that proxy. And
 * even where the guard does run, a caller RLS quietly empties still sees a
 * blank admin screen rather than being told they are signed in as the
 * wrong account. This is defence in depth for the former and a better
 * redirect for the latter - never the boundary itself.
 */
export async function requireAdmin(): Promise<SupabaseClient> {
  const supabase = await createServerSupabaseClient()

  // getUser revalidates the token against Supabase. getSession only reads
  // the cookie, which a client can forge, so it must not be used for an
  // authorization decision - see src/lib/supabase/middleware.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=%2Fadmin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/portal')
  }

  return supabase
}
