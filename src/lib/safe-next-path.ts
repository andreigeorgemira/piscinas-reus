/**
 * Validates the `next` query parameter before it is used as a redirect
 * target.
 *
 * The route guard sets `next` from a server-side pathname, but it reaches the
 * sign-in action through the URL, where the visitor controls it. Redirecting
 * to it unchecked is an open redirect: `/login?next=https://evil.example`
 * would bounce a user who has just authenticated - session cookie and all -
 * onto somebody else's site, which is exactly the moment a phishing page
 * wants them.
 *
 * Only a same-site absolute path is accepted: one leading slash, and neither
 * of the two forms a browser reads as "some other host":
 *
 *   //evil.example    a protocol-relative URL
 *   /\evil.example    browsers normalise the backslash to a slash
 *
 * Control characters are rejected as well, because browsers strip them before
 * parsing a URL: `/\nhttps://evil.example` looks like a path to a naive check
 * and like an absolute URL to the browser.
 *
 * Returns the path when it is safe, or null when the caller should fall back
 * to its own default.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null

  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code < 0x20 || code === 0x7f) return null
  }

  return value
}
