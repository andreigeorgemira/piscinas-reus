import { initialsOf } from '@/lib/settings/brand'

const SIZES = {
  sm: 'size-7 rounded-md text-[11px]',
  md: 'size-9 rounded-xl text-xs',
  lg: 'size-10 rounded-xl text-sm',
} as const

/**
 * The company's initials on the primary colour (see .brand-mark in globals.css).
 * `inverse` swaps the two, for a mark that sits on a primary-coloured panel.
 */
export function BrandMark({
  name,
  size = 'md',
  inverse = false,
}: {
  name: string
  size?: keyof typeof SIZES
  inverse?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-semibold tracking-[0.02em] ${
        inverse ? 'bg-primary-ink text-primary' : 'brand-mark'
      } ${SIZES[size]}`}
    >
      {initialsOf(name)}
    </span>
  )
}
