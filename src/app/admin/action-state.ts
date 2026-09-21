/**
 * What every admin Server Action returns, and the value its form starts from.
 *
 * It lives beside the screens rather than inside an actions module because a
 * 'use server' file may only export async functions: Next's actions loader
 * re-exports every export of such a module as a Server Action reference, and a
 * plain object makes the whole module fail to evaluate with "A 'use server'
 * file can only export async functions, found object." Forms need `idleState`
 * as the seed for useActionState, so it needs a home a Client Component can
 * import from.
 *
 * It started in src/app/admin/price-book/action-state.ts and moved up here
 * when the client and quote screens needed the same type. That file still
 * re-exports it, so the price-book screens are untouched.
 */
export type ActionState = { error: string | null }

export const idleState: ActionState = { error: null }
