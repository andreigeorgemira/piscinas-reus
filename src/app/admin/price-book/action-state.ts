/**
 * The price-book screens' action state, which is every admin screen's action
 * state: the definition moved to src/app/admin/action-state.ts when the client
 * and quote screens needed it too. Re-exported from here so the imports in
 * this folder keep pointing at the file next door.
 */
import type { ActionState } from '@/app/admin/action-state'

export { idleState } from '@/app/admin/action-state'
export type { ActionState }

/**
 * What moveItem returns. Besides the error, the code the concept could take
 * in its new group -- offered, never applied, because the code is what a CSV
 * re-import matches rows on, and changing it silently would turn the next
 * import of the same file into a duplicate.
 */
export type MoveState = ActionState & { renumber: { from: string; to: string } | null }
