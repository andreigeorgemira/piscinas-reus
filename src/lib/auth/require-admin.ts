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

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error) {
    // Logged, then deliberately fallen through to the redirect below. This
    // is the single query that answers "is this person staff", and a
    // failure here (a 42501 from a mis-scoped grant, a dropped connection,
    // a missing profile row) leaves the question unanswered - which is not
    // a yes, so the redirect must still happen. Failing open would hand the
    // admin screens to whoever provoked the error. But the symptom of
    // failing closed is every admin silently landing on /portal, and
    // without this line there is nothing anywhere to read that explains it.
    // src/lib/supabase/middleware.ts does the same for the page guard.
    console.error('profiles role lookup failed in requireAdmin', error)
  }

  if (profile?.role !== 'admin') {
    redirect('/portal')
  }

  return supabase
}
