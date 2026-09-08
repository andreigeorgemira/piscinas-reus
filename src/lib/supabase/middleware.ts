import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicEnv } from '@/lib/env'

const ADMIN_PREFIX = '/admin'
const PORTAL_PREFIX = '/portal'

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
  const isProtected = path.startsWith(ADMIN_PREFIX) || path.startsWith(PORTAL_PREFIX)

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return redirectCarryingCookies(url, response)
  }

  if (path.startsWith(ADMIN_PREFIX) && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      url.search = ''
      return redirectCarryingCookies(url, response)
    }
  }

  return response
}
