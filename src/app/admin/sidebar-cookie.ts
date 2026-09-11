/**
 * The cookie that remembers whether the sidebar is collapsed.
 *
 * In a plain module, not in sidebar.tsx: that file is `'use client'`, and a
 * value a Server Component imports from a client module arrives as a client
 * REFERENCE rather than as the value itself. The layout read a function
 * where it expected 'sidebar', looked up a cookie by that name, found
 * nothing, and rendered the sidebar expanded on every load.
 *
 * It is a display preference and carries nothing about the account, so it is
 * not httpOnly - the client writes it directly - and does not need to be.
 */
export const SIDEBAR_COOKIE = 'sidebar'
