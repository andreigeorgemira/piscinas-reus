'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { idleState } from '@/app/admin/action-state'
import { DANGER_ICON_BUTTON_CLASS, ICON_BUTTON_CLASS } from '@/app/admin/price-book/ui'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tooltip } from '@/components/ui/tooltip'
import type { Client } from '@/lib/clients/queries'
import { deleteClient } from './actions'
import { EditClientButton } from './client-dialog'

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const CELL_CLASS = 'border-b border-line-soft px-3 py-2.5 align-middle'

/** One client in the list. The whole row opens their page. */
export function ClientRow({ client }: { client: Client }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [, startAction] = useTransition()

  function runDelete() {
    return new Promise<void>((resolve) => {
      startAction(async () => {
        const data = new FormData()
        data.set('id', client.id)
        const result = await deleteClient(idleState, data)
        if (result.error) toast.error(result.error)
        else toast.error(`Cliente «${client.fullName}» borrado`)
        resolve()
      })
    })
  }

  return (
    <>
      <tr className="group/row relative transition-colors hover:bg-surface-hover">
        <td className={CELL_CLASS}>
          <div className="flex min-w-0 flex-col">
            {/*
              The row is one big link, stretched with ::after so a click
              anywhere opens the client -- and still a real link, so
              Ctrl-click and the keyboard work. The actions are lifted above
              that layer to keep their own clicks.
            */}
            <Link
              href={`/admin/clients/${client.id}`}
              className="w-fit font-medium outline-none group-hover/row:text-accent after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
            >
              {client.fullName}
            </Link>
            <span className="truncate text-xs text-faint" title={client.email}>
              {client.email}
            </span>
          </div>
        </td>
        <td className={`${CELL_CLASS} num text-muted`}>{client.phone ?? '—'}</td>
        <td className={`${CELL_CLASS} text-muted`}>
          {client.city ?? '—'}
          {client.postalCode ? <span className="num text-faint"> · {client.postalCode}</span> : null}
        </td>
        <td className={`${CELL_CLASS} num text-right ${client.quoteCount > 0 ? 'font-medium' : 'text-faint'}`}>
          {client.quoteCount}
        </td>
        <td className={CELL_CLASS}>
          <div className="relative z-10 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
            <Tooltip label="Editar">
              <EditClientButton
                client={client}
                label={`Editar ${client.fullName}`}
                className={ICON_BUTTON_CLASS}
              >
                <svg {...ICON_PROPS}>
                  <path d="M11.2 2.6a1.6 1.6 0 0 1 2.2 2.2L5.6 12.6l-3 .8.8-3Z" />
                </svg>
              </EditClientButton>
            </Tooltip>
            <Tooltip label="Borrar cliente">
              <button
                type="button"
                aria-label={`Borrar ${client.fullName}`}
                onClick={() => setConfirmingDelete(true)}
                className={DANGER_ICON_BUTTON_CLASS}
              >
                <svg {...ICON_PROPS}>
                  <path d="M2.8 4.2h10.4" />
                  <path d="M6.2 4.2V2.8h3.6v1.4" />
                  <path d="M4.2 4.2h7.6l-.6 8.2a.8.8 0 0 1-.8.8H5.6a.8.8 0 0 1-.8-.8Z" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </td>
      </tr>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Borrar a «${client.fullName}»`}
        description="Se va la ficha del cliente con sus datos de contacto y sus notas."
        risks={
          client.quoteCount > 0
            ? [
                `Tiene ${client.quoteCount} ${client.quoteCount === 1 ? 'presupuesto' : 'presupuestos'}, así que la base de datos no dejará borrarlo.`,
                'Borra antes esos presupuestos, o deja la ficha como está.',
              ]
            : [
                'No se puede deshacer.',
                'Si tenía cuenta en el portal, la cuenta sigue existiendo: lo que se borra es la ficha.',
              ]
        }
        confirmLabel="Borrar cliente"
        onConfirm={runDelete}
      />
    </>
  )
}
