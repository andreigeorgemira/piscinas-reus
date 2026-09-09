/**
 * The one place that decides which area of the site a path belongs to.
 *
 * Two callers ask the question - the route guard in
 * `src/lib/supabase/middleware.ts` and the sign-in action in
 * `src/app/auth/actions.ts` - and they must agree. When each carried its own
 * `path.startsWith('/admin')`, they did not: the action's copy let `/./admin`
 * through, so a client could sign in and watch the URL bar say `/admin` while
 * the guard quietly served them the portal.
 *
 * WHEN THE LOCALE SEGMENT ARRIVES: the design puts these routes under
 * `app/[locale]/` (docs/superpowers/specs/2026-09-07-piscinas-reus-design.md,
 * "Directory layout"), so the real paths become `/es/admin`, `/ca/admin` and so
 * on. A prefix anchored at the first segment stops matching them, and these
 * predicates then return false for every protected page - the guard fails
 * OPEN, silently. Whoever adds the segment must widen the predicates below to
 * skip it and add a localised case to `tests/e2e/auth.spec.ts`. Moving the
 * constants alone is not enough.
 */

const ADMIN_PREFIX = '/admin'
const PORTAL_PREFIX = '/portal'
const LOGIN_PREFIX = '/login'

/**
 * The pathname a browser would actually end up on.
 *
 * `String.startsWith` compares spellings, and a path has many: `/./admin` and
 * `/portal/../admin` both reach `/admin` and neither starts with it. The URL
 * parser collapses those the same way the browser will, and drops the query
 * string and fragment, which never take part in a route decision (`next` is
 * allowed to carry a query string - see `safeNextPath`).
 *
 * The base is a throwaway origin; `new URL` only needs one to resolve a
 * relative reference and nothing here looks at the host.
 */
function pathnameOf(path: string): string {
  try {
    return new URL(path, 'http://route.invalid').pathname
  } catch {
    // Unparseable, so there is no browser-visible pathname to compare. Fall
    // back to the raw string, which keeps the tests below at least as strict
    // as the bare startsWith they replaced.
    return path
  }
}

/** True for the staff dashboard and anything under it. */
export function isAdminPath(path: string): boolean {
  return pathnameOf(path).startsWith(ADMIN_PREFIX)
}

/** True for any page that requires a signed-in user. */
export function isProtectedPath(path: string): boolean {
  const pathname = pathnameOf(path)
  return pathname.startsWith(ADMIN_PREFIX) || pathname.startsWith(PORTAL_PREFIX)
}

/** True for the sign-in form itself. */
export function isLoginPath(path: string): boolean {
  return pathnameOf(path).startsWith(LOGIN_PREFIX)
}
