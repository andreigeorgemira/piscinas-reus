/**
 * What every price-book Server Action returns, and the value its form starts
 * from.
 *
 * This lives beside actions.ts rather than inside it because a 'use server'
 * module may only export async functions: Next's actions loader re-exports
 * every export of such a module as a Server Action reference, and a plain
 * object makes the whole module fail to evaluate with "A 'use server' file
 * can only export async functions, found object." The forms need this value
 * as the seed for useActionState, so it needs a home a Client Component can
 * import from.
 */
export type ActionState = { error: string | null }

export const idleState: ActionState = { error: null }

/**
 * What moveItem returns. Besides the error, the code the concept could take
 * in its new group -- offered, never applied, because the code is what a CSV
 * re-import matches rows on, and changing it silently would turn the next
 * import of the same file into a duplicate.
 */
export type MoveState = ActionState & { renumber: { from: string; to: string } | null }
