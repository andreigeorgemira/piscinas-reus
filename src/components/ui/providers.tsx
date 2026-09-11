'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { useThemeChoice } from '@/app/theme'

/**
 * The two things every admin screen needs mounted once: the tooltip timing
 * context, and the toast stack.
 *
 * Toasts are sonner rather than the browser's own anything: a write that
 * succeeded has to say so somewhere, and the alternative is either a silent
 * screen or a blocking alert() that stops the person mid-task.
 */
export function AdminProviders({ children }: { children: ReactNode }) {
  const theme = useThemeChoice()

  return (
    <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={200}>
      {children}
      {/*
        richColors paints each kind of toast in its own colour - green for a
        write that landed, red for something removed, amber for a warning -
        and globals.css feeds it this app's tokens so the colours are the
        same ones the rest of the screen uses, in both themes.
      */}
      <Toaster theme={theme} position="bottom-right" closeButton richColors />
    </TooltipPrimitive.Provider>
  )
}
