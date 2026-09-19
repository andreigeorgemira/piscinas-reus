'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

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

export function useThemeChoice(): Theme {
  return useSyncExternalStore(subscribe, readStored, () => 'system' as Theme)
}

export function setThemeChoice(theme: Theme) {
  const root = document.documentElement
  try {
    if (theme === 'system') {
      delete root.dataset.theme
      localStorage.removeItem(STORAGE_KEY)
    } else {
      root.dataset.theme = theme
      localStorage.setItem(STORAGE_KEY, theme)
    }
  } catch {
    // Storage refused, so the choice cannot outlive this page. Still apply it
    // to the document: it works until reload, which beats a dead control.
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }
  // `storage` does not fire in the tab that wrote the value, so this window's
  // own subscribers have to be told directly.
  for (const listener of listeners) listener()
}

function icon(paths: ReactNode) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  )
}

/**
 * Three states, not two: someone who never chose should keep following their
 * machine when it switches at sunset, and someone who did choose should keep
 * that choice on every machine. A two-way switch cannot say which of those
 * the current appearance is.
 */
export const THEME_OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Claro',
    icon: icon(
      <>
        <circle cx="8" cy="8" r="2.8" />
        <path d="M8 1.4v1.6M8 13v1.6M14.6 8H13M3 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4 3.3 3.3" />
      </>,
    ),
  },
  {
    value: 'dark',
    label: 'Oscuro',
    icon: icon(<path d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.8 5.8 0 1 0 7 7Z" />),
  },
  {
    value: 'system',
    label: 'Sistema',
    icon: icon(
      <>
        <rect x="2.2" y="3.2" width="11.6" height="7.6" rx="1" />
        <path d="M5.6 13.2h4.8" />
      </>,
    ),
  },
]

/**
 * The theme choice as one control: three labels in a track, with the
 * selected one under a thumb that slides.
 *
 * Three separate buttons were three things to read and no indication that
 * they were the same question. A radiogroup says it is one choice, and the
 * thumb moving from cell to cell says which way the choice went -- the
 * motion is the feedback, so the popover does not need to repeat it in
 * words.
 */
export function ThemeSlider() {
  const theme = useThemeChoice()
  const index = Math.max(
    0,
    THEME_OPTIONS.findIndex((option) => option.value === theme),
  )

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="relative grid grid-cols-3 rounded-lg border border-line bg-surface-sunk p-1"
    >
      {/*
        One third of the track minus the padding, slid a whole cell at a
        time. `transform` rather than `left` so the browser animates it on
        the compositor and it cannot nudge the labels around.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 rounded-md bg-surface shadow-card transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: 'calc((100% - 0.5rem) / 3)',
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {THEME_OPTIONS.map((option) => {
        const active = option.value === theme
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemeChoice(option.value)}
            className={`relative z-10 flex h-7 items-center justify-center gap-1.5 rounded-md text-2xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
              active ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            <span className="flex size-3.5 items-center justify-center">{option.icon}</span>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
