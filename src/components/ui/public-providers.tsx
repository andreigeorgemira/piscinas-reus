'use client'

import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { useThemeChoice } from '@/app/theme'

/**
 * What a page outside the admin needs mounted: the toast stack, and nothing
 * else.
 *
 * No tooltip provider, because a page read on a phone has no hover to tell
 * anything with, and no admin chrome to explain.
 */
export function PublicProviders({ children }: { children: ReactNode }) {
  const theme = useThemeChoice()

  return (
    <>
      {children}
      <Toaster theme={theme} position="bottom-center" richColors />
    </>
  )
}
