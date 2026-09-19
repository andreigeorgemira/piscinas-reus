'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ReactNode } from 'react'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close

/** The floating panel. Radix handles focus, escape and outside clicks. */
export function PopoverContent({
  children,
  align = 'end',
  side = 'bottom',
  className = '',
}: {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        side={side}
        sideOffset={6}
        collisionPadding={12}
        className={`z-50 rounded-lg border border-line bg-surface p-1 text-sm text-ink shadow-pop ${className}`}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

/** A row inside a popover menu: icon, label, optional trailing hint. */
export function PopoverItem({
  icon,
  children,
  danger = false,
  onClick,
  type = 'button',
}: {
  icon: ReactNode
  children: ReactNode
  danger?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
        danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-surface-hover'
      }`}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      {children}
    </button>
  )
}
