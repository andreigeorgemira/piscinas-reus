/**
 * Wraps a search term for use inside a PostgREST `or` filter.
 *
 * That filter is a comma-separated string, so a search for "gresite, borada"
 * would otherwise be parsed as two conditions and the second one - `borada`,
 * with no column or operator - makes the whole request a 400. Parentheses
 * group conditions and would do the same. PostgREST's own answer is to
 * double-quote the value, which makes every reserved character literal; only
 * the backslash and the quote itself then need escaping.
 *
 * `*` is left alone deliberately: it is the ilike wildcard, and a staff
 * member typing `REV-*` meaning "everything in revestimiento" gets what they
 * asked for.
 *
 * It lived inside src/lib/price-book/queries.ts until the quote and client
 * screens needed the same escaping. It moved here rather than being copied,
 * and it lost its old name, `quoteFilterValue` -- "quote" as a verb reads as
 * the domain noun now that Presupuesto/Quote is a table.
 */
export function escapeFilterTerm(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
