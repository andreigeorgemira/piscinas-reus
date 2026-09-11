/**
 * The shape profile writes return, and its seed value.
 *
 * In its own module, not in profile-actions.ts: a `'use server'` file may
 * only export async functions, so a plain object living there fails the
 * build the moment anything imports it. Same reason
 * src/app/admin/price-book/action-state.ts exists.
 */
export type ProfileState = { error: string | null; saved: boolean }

export const idleProfileState: ProfileState = { error: null, saved: false }
