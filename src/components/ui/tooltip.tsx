'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

/**
 * A label for a control that shows only an icon.
 *
 * It is deliberately NOT the accessible name: the trigger keeps its own
 * aria-label, because a tooltip that never opens for a screen reader or a
 * touch user is no name at all. This is the sighted mouse user's copy of it.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-md border border-line bg-surface px-2 py-1 text-2xs text-ink shadow-pop select-none"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-[var(--surface)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
