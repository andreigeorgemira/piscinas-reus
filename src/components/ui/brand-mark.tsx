import { initialsOf } from '@/lib/settings/brand'

const SIZES = {
  sm: 'size-7 rounded-md text-[11px]',
  md: 'size-9 rounded-xl text-xs',
  lg: 'size-10 rounded-xl text-sm',
} as const

/** The company's initials on the accent tile (see .brand-mark in globals.css). */
export function BrandMark({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-mark flex shrink-0 items-center justify-center font-semibold tracking-[0.02em] text-white ${SIZES[size]}`}
    >
      {initialsOf(name)}
    </span>
  )
}
