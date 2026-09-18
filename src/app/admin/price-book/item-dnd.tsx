'use client'

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { formatEuros } from '@/lib/price-book/decimal'
import type { PriceBookGroup, PriceBookItem } from '@/lib/price-book/queries'
import { idleState } from './action-state'
import { moveItem } from './actions'

/*
 * Dragging a concept from one group to another, on dnd-kit.
 *
 * The library owns the pointer: the sensor, the overlay that follows it, the
 * auto-scroll at the edges of the table, and the screen-reader announcements.
 * What stays ours is the part that is about this catalogue rather than about
 * dragging -- the move is applied to the screen before the database has
 * agreed (useOptimistic), and the row that arrives in its new group is tinted
 * once so the eye can follow it.
 *
 * Only the handle is draggable, and only a real drag counts: a press that
 * does not travel four pixels stays a click, and opens the "Mover a" menu.
 * That menu is the keyboard's way in, so no KeyboardSensor is registered --
 * it would take space and enter away from the menu and give back something
 * worse.
 */

/** The ungrouped bucket, which has no id of its own. */
const UNGROUPED = '__ungrouped__'

/** Pixels of travel before a press on the handle becomes a drag. */
const DRAG_THRESHOLD = 4

/** How long a row hovers over a folded group before the group opens. */
const HOLD_MS = 500

/** How long a move waits to be claimed by the row mounting in its new group. */
const ARRIVAL_WINDOW_MS = 2000

/** A move the screen already shows while the database catches up. */
type Move = { item: PriceBookItem; toGroupId: string | null }

type ItemMoves = {
  move: (item: PriceBookItem, toGroupId: string | null, toName: string) => void
  /** True once, for a row that has just been moved and is mounting in its new group. */
  consumeArrival: (itemId: string) => boolean
}

/** What a dragged handle carries, and what a section offers to catch it. */
type DragData = { item: PriceBookItem }
type DropData = { groupId: string | null; name: string }

const ItemMovesContext = createContext<ItemMoves>({
  move: () => {},
  consumeArrival: () => false,
})

const NO_MOVES: ReadonlyMap<string, Move> = new Map()
const PendingMovesContext = createContext<ReadonlyMap<string, Move>>(NO_MOVES)

export function ItemDragArea({ className, children }: { className?: string; children: ReactNode }) {
  const [moves, addMove] = useOptimistic<ReadonlyMap<string, Move>, Move>(
    NO_MOVES,
    (current, next) => new Map(current).set(next.item.id, next),
  )
  const arrivals = useRef(new Set<string>())

  // The card under the pointer, and the group named beneath it. Both change
  // once per pick-up and once per group crossed, never on pointer movement:
  // the overlay itself is moved by the library, outside React.
  const [dragged, setDragged] = useState<PriceBookItem | null>(null)
  const [destination, setDestination] = useState<string | null>(null)

  const move = useCallback(
    (item: PriceBookItem, toGroupId: string | null, toName: string) => {
      if (item.groupId === toGroupId) return

      const pending = arrivals.current
      pending.add(item.id)
      window.setTimeout(() => pending.delete(item.id), ARRIVAL_WINDOW_MS)

      startTransition(async () => {
        addMove({ item, toGroupId })
        const data = new FormData()
        data.set('id', item.id)
        data.set('group_id', toGroupId ?? '')
        const result = await moveItem(idleState, data)
        if (result.error) toast.error(result.error)
        else toast.success(`«${item.name}» movido a ${toName}`)
      })
    },
    [addMove],
  )

  const consumeArrival = useCallback((itemId: string) => arrivals.current.delete(itemId), [])

  // One attribute on <html> while a row is in the air: it turns the pointer
  // into a closed hand, stops text selecting, and takes the table out of
  // pointer events. The last one is the expensive part -- see the note beside
  // the rule in globals.css. dnd-kit finds its target from the sections'
  // rectangles, not from what sits under the pointer, so the table can stop
  // answering without costing the drop anything.
  useEffect(() => {
    if (!dragged) return
    const root = document.documentElement
    root.setAttribute('data-dragging', '')
    return () => root.removeAttribute('data-dragging')
  }, [dragged])

  const actions = useMemo(() => ({ move, consumeArrival }), [move, consumeArrival])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } }),
  )

  /** The group under the pointer, unless it is the one the row already sits in. */
  const landingOn = (event: DragOverEvent | DragEndEvent): DropData | null => {
    const item = (event.active.data.current as DragData | undefined)?.item
    const over = event.over?.data.current as DropData | undefined
    if (!item || !over || over.groupId === item.groupId) return null
    return over
  }

  function handleDragStart(event: DragStartEvent) {
    setDragged((event.active.data.current as DragData | undefined)?.item ?? null)
    setDestination(null)
  }

  function handleDragOver(event: DragOverEvent) {
    setDestination(landingOn(event)?.name ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const item = (event.active.data.current as DragData | undefined)?.item
    const over = landingOn(event)
    setDragged(null)
    setDestination(null)
    if (item && over) move(item, over.groupId, over.name)
  }

  function handleDragCancel() {
    setDragged(null)
    setDestination(null)
  }

  return (
    <div className={className}>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <ItemMovesContext.Provider value={actions}>
          <PendingMovesContext.Provider value={moves}>{children}</PendingMovesContext.Provider>
        </ItemMovesContext.Provider>

        <DragOverlay dropAnimation={null}>
          {dragged ? <GhostCard item={dragged} destination={destination} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

/** The screen reader's half of the story, in the language of the screen. */
const announcements: Announcements = {
  onDragStart: ({ active }) => {
    const item = (active.data.current as DragData | undefined)?.item
    return item ? `Has cogido «${item.name}». Muévelo sobre un grupo para soltarlo.` : undefined
  },
  onDragOver: ({ over }) => {
    const group = over?.data.current as DropData | undefined
    return group ? `Sobre ${group.name}.` : 'Fuera de cualquier grupo.'
  },
  onDragEnd: ({ over }) => {
    const group = over?.data.current as DropData | undefined
    return group ? `Soltado en ${group.name}.` : 'Soltado fuera de un grupo: sin cambios.'
  },
  onDragCancel: ({ active }) => {
    const item = (active.data.current as DragData | undefined)?.item
    return item ? `Movimiento de «${item.name}» cancelado.` : undefined
  },
}

/**
 * The row reduced to what identifies it, lifted off the page, with the
 * destination spelled out beneath it once there is one.
 */
function GhostCard({ item, destination }: { item: PriceBookItem; destination: string | null }) {
  return (
    <div className="relative w-[min(32rem,80vw)] cursor-grabbing">
      <div
        className={`flex items-center gap-3 rounded-lg border bg-surface px-3 py-2 shadow-pop transition-colors duration-150 motion-safe:animate-ghost-lift ${
          destination ? 'border-accent' : 'border-line'
        }`}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="shrink-0 text-faint"
        >
          <circle cx="6" cy="4" r="1.1" />
          <circle cx="10" cy="4" r="1.1" />
          <circle cx="6" cy="8" r="1.1" />
          <circle cx="10" cy="8" r="1.1" />
          <circle cx="6" cy="12" r="1.1" />
          <circle cx="10" cy="12" r="1.1" />
        </svg>
        <span className="w-20 shrink-0 truncate font-mono text-xs text-muted">
          {item.code ?? '—'}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.name}</span>
        <span className="num shrink-0 text-sm font-medium text-ink">
          {formatEuros(item.unitPrice)}
        </span>
      </div>

      <div
        className={`absolute top-full left-3 mt-1.5 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-2xs font-medium whitespace-nowrap text-accent-ink shadow-pop transition-[opacity,translate] duration-150 ${
          destination ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
        }`}
      >
        <svg
          width={11}
          height={11}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
        Mover a {destination}
      </div>
    </div>
  )
}

/** Move a row from anywhere: the drop, or the "Mover a" menu. */
export function useItemMoves(): ItemMoves {
  return useContext(ItemMovesContext)
}

/**
 * The handle's half of a drag: what makes a row pickable.
 *
 * Returns the props the handle button spreads, and whether this row is the
 * one in flight -- the row dims itself while its card is over the table.
 */
export function useItemDragHandle(item: PriceBookItem) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item } satisfies DragData,
  })

  return {
    handleRef: setNodeRef,
    handleProps: { ...attributes, ...listeners },
    isDragging,
  }
}

/**
 * The order listPriceBook asks the database for -- code with blanks last,
 * then name -- so a row moved in lands where the refreshed page will put it.
 */
function catalogueOrder(a: PriceBookItem, b: PriceBookItem): number {
  if (a.code !== b.code) {
    if (a.code === null) return 1
    if (b.code === null) return -1
    return a.code.localeCompare(b.code)
  }
  return a.name.localeCompare(b.name)
}

/**
 * A group's rows with any move still on its way applied: rows leaving are
 * gone, rows arriving are slotted in, and the count follows both.
 */
export function useSectionItems(group: PriceBookGroup): {
  items: PriceBookItem[]
  itemCount: number
} {
  const moves = useContext(PendingMovesContext)

  return useMemo(() => {
    if (moves.size === 0) return { items: group.items, itemCount: group.itemCount }

    const items: PriceBookItem[] = []
    let leaving = 0
    for (const item of group.items) {
      const pending = moves.get(item.id)
      if (pending && pending.toGroupId !== group.id) leaving += 1
      else items.push(item)
    }

    let arriving = 0
    for (const pending of moves.values()) {
      if (pending.toGroupId !== group.id) continue
      // Already here: the refreshed page arrived in the same render.
      if (items.some((item) => item.id === pending.item.id)) continue
      const row = { ...pending.item, groupId: group.id }
      const at = items.findIndex((item) => catalogueOrder(row, item) < 0)
      if (at === -1) items.push(row)
      else items.splice(at, 0, row)
      arriving += 1
    }

    return { items, itemCount: group.itemCount - leaving + arriving }
  }, [group, moves])
}

/**
 * Marks a group's <tbody> as a place to drop, and opens the group when a row
 * is held over it -- so what is inside is in view before the row is let go.
 *
 * The group a row already sits in is never a target: there is nothing to
 * move. The highlight stays a data attribute, so the section keeps styling
 * itself with the `data-[drop-target]:` and `in-data-[drop-target]:` classes
 * it already had.
 */
export function useGroupDrop(groupId: string | null, name: string, onHold: () => void) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: groupId ?? UNGROUPED,
    data: { groupId, name } satisfies DropData,
  })

  const draggedItem = (active?.data.current as DragData | undefined)?.item
  const targeted = isOver && draggedItem !== undefined && draggedItem.groupId !== groupId

  const hold = useEffectEvent(onHold)

  useEffect(() => {
    if (!targeted) return
    const timer = window.setTimeout(() => hold(), HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [targeted])

  return {
    dropRef: setNodeRef,
    dropProps: targeted ? { 'data-drop-target': '' } : {},
  }
}
