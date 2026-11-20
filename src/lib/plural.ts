/**
 * A count with its noun: "1 grupo", "3 grupos", "0 líneas".
 *
 * Spanish needs the two forms spelled out (línea/líneas, concepto/conceptos,
 * extra marcado/extras marcados), so the caller passes both rather than this
 * guessing at an -s.
 */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
