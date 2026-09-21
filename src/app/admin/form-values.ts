const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Reads an id a form posted, or null when it is not an id at all.
 *
 * Every Server Action starts with one of these. A Server Action is a POST
 * endpoint reachable directly
 * (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md),
 * so the id in the body is a claim, not a fact: checked here it becomes a
 * sentence on the form, and unchecked it becomes a 22P02 from Postgres, which
 * the screen can only report as "something went wrong".
 */
export function readUuid(formData: FormData, field: string): string | null {
  const raw = formData.get(field)
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}
