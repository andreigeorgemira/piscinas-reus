'use client'

import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme'

/**
 * Stamps the stored choice on <html> before the page paints.
 *
 * It has to run as markup rather than in an effect: an effect runs after the
 * first paint, so someone who chose light on a dark machine would watch the
 * dark palette flash past on every navigation. Rendered as the first thing
 * in <body>, it executes before the rest of the document is parsed.
 *
 * Wrapped in try/catch because localStorage throws outright in a browser
 * with site data blocked, and a theme is not worth a blank page.
 */
export function ThemeScript() {
  const script = `try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}

function apply(theme: Theme) {
  const root = document.documentElement
  try {
    if (theme === 'system') {
      delete root.dataset.theme
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    root.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage refused, so the choice cannot outlive this page. Still apply it
    // to the document: it works until reload, which beats a dead control.
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }
}

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/**
 * The choice is external state - it lives in localStorage, which React does
 * not own - so it is read through useSyncExternalStore rather than copied
 * into state by an effect. The server snapshot is 'system' because the
 * server cannot know the choice; the first client read corrects it without a
 * paint in between, and the `storage` event keeps a second tab in step.
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'system',
    label: 'Tema del sistema',
    icon: (
      <>
        <rect x="2.2" y="3.2" width="11.6" height="7.6" rx="1" />
        <path d="M5.6 13.2h4.8" />
      </>
    ),
  },
  {
    value: 'light',
    label: 'Tema claro',
    icon: (
      <>
        <circle cx="8" cy="8" r="2.8" />
        <path d="M8 1.4v1.6M8 13v1.6M14.6 8H13M3 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4 3.3 3.3" />
      </>
    ),
  },
  {
    value: 'dark',
    label: 'Tema oscuro',
    icon: <path d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.8 5.8 0 1 0 7 7Z" />,
  },
]

/**
 * Three states, not two: someone who never chose should keep following their
 * machine when it switches at sunset, and someone who did choose should keep
 * that choice on every machine. A two-way switch cannot say which of those
 * the current appearance is.
 *
 * It renders "system" until the effect reads storage, because the server has
 * no way to know the choice and rendering a guess would hydrate wrong.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readStored, () => 'system' as Theme)

  return (
    <div
      role="group"
      aria-label="Tema"
      className="flex items-center gap-0.5 rounded-md border border-shell-line p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            onClick={() => {
              apply(option.value)
              for (const listener of listeners) listener()
            }}
            className={`flex size-6 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
              active
                ? 'bg-shell-active text-shell-ink'
                : 'text-shell-faint hover:text-shell-muted'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {option.icon}
            </svg>
          </button>
        )
      })}
    </div>
  )
}
