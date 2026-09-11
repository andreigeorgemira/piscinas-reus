'use client'

import { useState } from 'react'
import { signOut } from '@/app/auth/actions'
import { setThemeChoice, THEME_OPTIONS, useThemeChoice } from '@/app/theme'
import { Popover, PopoverContent, PopoverItem, PopoverTrigger } from '@/components/ui/popover'
import { ProfileDialog } from './profile-dialog'

export type AdminUser = {
  email: string
  fullName: string
  phone: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  client: 'Cliente',
}

/** Two letters for the avatar: initials when there is a name, else the address. */
function initials(user: AdminUser): string {
  const parts = user.fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return user.email.slice(0, 2).toUpperCase()
}

/**
 * The block at the foot of the sidebar, and everything behind it.
 *
 * One target rather than three: the avatar, the name and the role are what
 * a person looks at to check who they are signed in as, so they are also
 * what they click to change it. Signing out lives at the bottom in red --
 * the one item here with a consequence.
 *
 * The avatar is drawn from initials. A photograph would need an
 * `avatar_url` on profiles and a Storage bucket to put it in, and neither
 * exists yet.
 */
export function UserMenu({ user, collapsed }: { user: AdminUser; collapsed: boolean }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const theme = useThemeChoice()

  const name = user.fullName.trim() || user.email
  const role = ROLE_LABELS[user.role] ?? user.role

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Cuenta de ${name}`}
            className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-shell-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-shell-active text-2xs font-semibold text-shell-ink"
            >
              {initials(user)}
            </span>
            {collapsed ? null : (
              <>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-medium text-shell-ink">{name}</span>
                  <span className="text-2xs text-shell-faint">{role}</span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-auto shrink-0 text-shell-faint"
                  aria-hidden="true"
                >
                  <path d="m5.6 6.4 2.4-2.4 2.4 2.4M10.4 9.6 8 12l-2.4-2.4" />
                </svg>
              </>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" side="top" className="w-64">
          <div className="flex flex-col gap-0.5 border-b border-line px-2.5 pt-1.5 pb-2.5">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-xs text-muted">{user.email}</span>
          </div>

          <div className="py-1">
            <PopoverItem
              onClick={() => setProfileOpen(true)}
              icon={
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
                  <circle cx="8" cy="5.6" r="2.6" />
                  <path d="M2.8 13.4c0-2.6 2.3-4.2 5.2-4.2s5.2 1.6 5.2 4.2" />
                </svg>
              }
            >
              Editar perfil
            </PopoverItem>
          </div>

          <div className="border-t border-line py-1">
            <span className="block px-2.5 py-1 text-2xs font-medium tracking-[0.06em] text-faint uppercase">
              Tema
            </span>
            {THEME_OPTIONS.map((option) => (
              <PopoverItem
                key={option.value}
                icon={option.icon}
                onClick={() => setThemeChoice(option.value)}
              >
                <span className="flex w-full items-center">
                  {option.label}
                  {theme === option.value ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-auto text-accent"
                      aria-hidden="true"
                    >
                      <path d="m3.2 8.4 3.2 3.2 6.4-6.8" />
                    </svg>
                  ) : null}
                </span>
              </PopoverItem>
            ))}
          </div>

          <div className="border-t border-line py-1">
            <form action={signOut}>
              <PopoverItem
                type="submit"
                danger
                icon={
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
                    <path d="M6.2 2.4H3.4a1 1 0 0 0-1 1v9.2a1 1 0 0 0 1 1h2.8" />
                    <path d="M10.6 11 13.6 8l-3-3" />
                    <path d="M13.6 8H6.4" />
                  </svg>
                }
              >
                Cerrar sesión
              </PopoverItem>
            </form>
          </div>
        </PopoverContent>
      </Popover>

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        email={user.email}
        fullName={user.fullName}
        phone={user.phone}
      />
    </>
  )
}
