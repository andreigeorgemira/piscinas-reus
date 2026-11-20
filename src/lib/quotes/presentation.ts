/**
 * How a quote is presented to the client: which groups it is printed in, in
 * what order, and how much of each group the client sees.
 *
 * The groups are the lines' own `group_name`. Their settings live in
 * public.quote_groups (0019_quote_vat_and_presentation.sql), one row per group
 * that staff have touched; a group with no row is detailed and keeps the place
 * the catalogue order gives it. What "hidden" means is enforced by the
 * database -- quote_by_token returns no price for a line of a group that is not
 * detailed -- and this module only decides order and labels.
 */

export const GROUP_DISPLAYS = ['detailed', 'no_prices', 'total_only'] as const

export type GroupDisplay = (typeof GROUP_DISPLAYS)[number]

export const GROUP_DISPLAY_LABELS: Record<GroupDisplay, string> = {
  detailed: 'Detallado',
  no_prices: 'Sin precios',
  total_only: 'Solo total',
}

/** What the client sees of a group in each mode, in the words the screen uses. */
export const GROUP_DISPLAY_HINTS: Record<GroupDisplay, string> = {
  detailed: 'Cada concepto con cantidad, precio e importe.',
  no_prices: 'Los conceptos y sus cantidades, sin precios. Solo el total del grupo.',
  total_only: 'Solo el nombre del grupo y su total.',
}

export function isGroupDisplay(value: unknown): value is GroupDisplay {
  return typeof value === 'string' && (GROUP_DISPLAYS as readonly string[]).includes(value)
}

/** One row of public.quote_groups. */
export type GroupSetting = {
  name: string
  position: number
  display: GroupDisplay
}

/** The name the editor gives the lines that have no group. */
export const UNGROUPED_LABEL = 'Sin grupo'

type Grouped = { groupName: string | null }

/**
 * The lines in the order the document prints them.
 *
 * `lines` arrive in catalogue order (what src/lib/quotes/board.ts produces).
 * Groups staff have placed come first, by their position; the rest follow in
 * the order they first appear. Inside a group, lines keep the order they came
 * in. A group is never split: its lines are printed together even when the
 * catalogue scatters them, which is what grouping "as we want" means.
 */
export function presentationOrder<T extends Grouped>(lines: T[], settings: GroupSetting[]): T[] {
  const placed = new Map(settings.map((setting) => [setting.name, setting.position]))

  const appearance: (string | null)[] = []
  const members = new Map<string | null, T[]>()
  for (const line of lines) {
    const bucket = members.get(line.groupName)
    if (bucket) {
      bucket.push(line)
      continue
    }
    members.set(line.groupName, [line])
    appearance.push(line.groupName)
  }

  const order = appearance
    .map((name, index) => ({ name, index, position: name === null ? undefined : placed.get(name) }))
    .sort((a, b) => {
      if (a.position !== undefined && b.position !== undefined) {
        return a.position - b.position || a.index - b.index
      }
      if (a.position !== undefined) return -1
      if (b.position !== undefined) return 1
      return a.index - b.index
    })

  return order.flatMap(({ name }) => members.get(name) ?? [])
}

/** How a group is shown: its setting, or detailed when it has none. */
export function displayOf(groupName: string | null, settings: GroupSetting[]): GroupDisplay {
  if (groupName === null) return 'detailed'
  return settings.find((setting) => setting.name === groupName)?.display ?? 'detailed'
}

export type DocumentSection<T> = {
  /** The line's group_name: null for the lines with no group. */
  groupName: string | null
  display: GroupDisplay
  lines: T[]
}

/**
 * The base lines of a document, cut into its groups in the order they arrive.
 *
 * Optional extras are left out: the document lists them apart, whatever group
 * they were written in, because each one is a choice the client makes.
 */
export function documentSections<T extends Grouped & { isRecommended: boolean }>(
  lines: T[],
  settings: GroupSetting[],
): DocumentSection<T>[] {
  const sections: DocumentSection<T>[] = []
  for (const line of lines) {
    if (line.isRecommended) continue
    const section = sections.find((candidate) => candidate.groupName === line.groupName)
    if (section) {
      section.lines.push(line)
      continue
    }
    sections.push({
      groupName: line.groupName,
      display: displayOf(line.groupName, settings),
      lines: [line],
    })
  }
  return sections
}

