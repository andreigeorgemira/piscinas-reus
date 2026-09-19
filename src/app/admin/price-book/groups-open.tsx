'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Request = { token: number; open: boolean }

const GroupsOpenContext = createContext<{
  request: Request | null
  setAll: (open: boolean) => void
}>({ request: null, setAll: () => {} })

/**
 * Lets one control in the toolbar fold or unfold every group at once.
 *
 * Each group still owns whether it is open -- that is what makes folding one
 * of them independent of the rest. What crosses this context is a REQUEST,
 * stamped with a token: a group applies it once, when the token changes, and
 * then goes back to minding its own state. Without the token, "unfold all"
 * would be a latch that stopped anyone folding a single group afterwards.
 */
export function GroupsOpenProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null)

  const setAll = useCallback((open: boolean) => {
    setRequest((current) => ({ token: (current?.token ?? 0) + 1, open }))
  }, [])

  return (
    <GroupsOpenContext.Provider value={{ request, setAll }}>{children}</GroupsOpenContext.Provider>
  )
}

export function useGroupsOpenRequest(): Request | null {
  return useContext(GroupsOpenContext).request
}

/** Folds or unfolds every group on the page. */
export function ToggleAllGroups() {
  const { setAll } = useContext(GroupsOpenContext)
  // Which way the button offers to go next. It is not a reading of the
  // groups' real state -- they each keep their own - only of what this
  // control last asked for.
  const [collapsed, setCollapsed] = useState(false)

  return (
    // Labelled, not an icon on its own: two chevrons at 15px read as a
    // cross, and this is a control nobody will hover to find out.
    <button
      type="button"
      onClick={() => {
        setAll(collapsed)
        setCollapsed(!collapsed)
      }}
      className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {collapsed ? (
          // Chevrons pointing apart: this opens the groups back up.
          <>
            <path d="M5 6.5 8 3.5l3 3" />
            <path d="M5 9.5 8 12.5l3-3" />
          </>
        ) : (
          // Chevrons pointing at each other: this folds them.
          <>
            <path d="M5 3.5 8 6.5l3-3" />
            <path d="M5 12.5 8 9.5l3 3" />
          </>
        )}
      </svg>
      {collapsed ? 'Desplegar todo' : 'Plegar todo'}
    </button>
  )
}
