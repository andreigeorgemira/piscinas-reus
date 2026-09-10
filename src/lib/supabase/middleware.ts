import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicEnv } from '@/lib/env'
import { isAdminPath, isProtectedPath } from '@/lib/routes'

/**
 * Redirects while keeping whatever cookies the Supabase client has already
 * written to `carrying`.
 *
 * getUser() can rotate the refresh token, and setAll() writes the new pair
 * onto the response built here in the middleware. A bare
 * NextResponse.redirect() is a fresh response that carries none of them, so
 * the rotated token would never reach the browser while the old one is
 * already spent server-side - signing the user out on their next request.
 */
function redirectCarryingCookies(url: URL, carrying: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url)
  for (const cookie of carrying.cookies.getAll()) {
    redirect.cookies.set(cookie)
  }
  return redirect
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })
  const env = getPublicEnv()

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser revalidates the token against Supabase. getSession only reads the
  // cookie, which a client can forge, so it must not be used for a decision.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (isProtectedPath(path) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // The query string travels inside `next`, not beside it. A deep link is
    // usually a deep link *with* its query - /portal/quotes/42?tab=items - and
    // dropping it sends the visitor to a different page than the one they
    // asked for. Clearing `search` first stops the original parameters from
    // also being copied onto /login, where they mean nothing.
    url.search = ''
    url.searchParams.set('next', path + request.nextUrl.search)
    return redirectCarryingCookies(url, response)
  }

  if (isAdminPath(path) && user) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error) {
      // Logged, then deliberately fallen through to the redirect below, for
      // the same reason as requireAdmin() in src/lib/auth/require-admin.ts:
      // a lookup that failed has not said this visitor is staff, so the only
      // safe reading is that they are not. The pair fails closed
      // symmetrically, which is right, and used to fail silently, which was
      // not - an admin bounced to /portal by a broken grant left no trace at
      // all for the team to find.
      console.error('profiles role lookup failed in middleware', error)
    }

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      url.search = ''
      return redirectCarryingCookies(url, response)
    }
  }

  return response
}
