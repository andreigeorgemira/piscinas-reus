import { initialsOf } from '@/lib/settings/brand'

const SIZES = {
  sm: 'size-7 rounded-md text-[11px]',
  md: 'size-9 rounded-xl text-xs',
  lg: 'size-10 rounded-xl text-sm',
} as const

/**
 * The company's initials on the primary colour (see .brand-mark in globals.css),
 * or turned to read on whatever it sits on.
 */
const TONES = {
  default: 'brand-mark',
  /** On a primary-coloured panel. */
  inverse: 'bg-primary-ink text-primary',
  /** On the sidebar, whatever colour it is in the current theme. */
  shell: 'bg-shell-ink text-shell',
} as const

export function BrandMark({
  name,
  size = 'md',
  tone = 'default',
}: {
  name: string
  size?: keyof typeof SIZES
  tone?: keyof typeof TONES
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-semibold tracking-[0.02em] ${TONES[tone]} ${SIZES[size]}`}
    >
      {initialsOf(name)}
    </span>
  )
}
