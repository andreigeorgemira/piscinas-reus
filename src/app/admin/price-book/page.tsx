import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listPriceBook, type PriceBookGroup } from '@/lib/price-book/queries'
import { GroupSection } from './group-section'
import type { GroupOption } from './item-fields'
import { NewGroupForm } from './new-group-form'

export const metadata: Metadata = { title: 'Tarifario' }

/** The highest position any real group holds, or 0 when there are none. */
function lastPosition(groups: PriceBookGroup[]): number {
  return groups.reduce((highest, group) => {
    // The ungrouped bucket carries a placeholder position, never a real one.
    return group.id === null ? highest : Math.max(highest, group.position)
  }, 0)
}

export default async function PriceBookPage() {
  const supabase = await requireAdmin()
  const groups = await listPriceBook(supabase)

  // Only real groups can be chosen in a row's Grupo select: "Sin grupo" is not
  // a group, it is what group_id = null renders as, and the select already
  // offers it as the empty value.
  const groupOptions: GroupOption[] = groups.flatMap((group) =>
    group.id === null ? [] : [{ id: group.id, name: group.name }],
  )

  // A new group almost always belongs after the existing ones, so offer that
  // rather than making staff read the last position off the screen.
  const nextPosition = lastPosition(groups) + 1

  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="w-fit text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400"
        >
          ← Panel
        </Link>
        <h1 className="text-2xl font-semibold">Tarifario</h1>
        <Link
          href="/admin/price-book/import"
          className="w-fit text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400"
        >
          Importar desde CSV
        </Link>
      </div>

      <NewGroupForm nextPosition={nextPosition} />

      {groups.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          El tarifario está vacío. Crea un grupo para empezar.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <GroupSection key={group.id ?? 'ungrouped'} group={group} groups={groupOptions} />
          ))}
        </div>
      )}
    </main>
  )
}
