'use client'

import { useRouter } from 'next/navigation'
import { useId } from 'react'

/**
 * How many rows a page holds. A plain <select> rather than a menu: it is a
 * three-option choice on a control the browser already draws well on every
 * platform, including a phone.
 *
 * The value lives in the URL like every other list parameter, so a link to
 * "50 per page, filtered by group" is one address.
 */
export function PageSizeSelect({
  value,
  options,
}: {
  value: number
  /**
   * The sizes on offer, each with the address that selects it. Addresses,
   * not a builder function: this is a Client Component and a function cannot
   * cross that boundary from the server that knows the rest of the query.
   */
  options: { size: number; href: string }[]
}) {
  const router = useRouter()
  const id = useId()

  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-xs whitespace-nowrap text-muted">
        Por página
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const chosen = options.find((option) => option.size === Number(event.target.value))
          if (chosen) router.push(chosen.href)
        }}
        className="num h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        {options.map((option) => (
          <option key={option.size} value={option.size}>
            {option.size}
          </option>
        ))}
      </select>
    </span>
  )
}
