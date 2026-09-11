'use client'

import Link from 'next/link'
import { useActionState, useId } from 'react'
import { formatMoney } from '@/lib/price-book/decimal'
import { UNGROUPED_NAME } from '@/lib/price-book/queries'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { PRIMARY_BUTTON_CLASS } from '../ui'
import { commitImport, previewImport } from './actions'
import { idleImportState, type ImportState } from './import-state'

const TEXTAREA_CLASS =
  'rounded-[5px] border border-line bg-surface px-2 py-1.5 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

const CELL_CLASS = 'border-b border-line-soft px-2.5 py-1 align-top'

const ACTION_LABELS = {
  create: 'Añade',
  update: 'Actualiza',
} as const

const PREVIEW_COLUMNS = ['Línea', 'Acción', 'Grupo', 'Código', 'Concepto', 'Unidad', 'Coste €', 'Precio €']

const PLACEHOLDER = `concepto;unidad;coste;precio;grupo;codigo;descripcion
Vaso de gresite;m2;10,00;15,00;Revestimiento;REV-001;Revestimiento en gresite azul
Mano de obra;hora;12,00;18,00;Mano de obra;;`

/**
 * A plain client function, NOT a Server Function: it runs in the browser and
 * calls one of the two real Server Functions in ./actions (previewImport or
 * commitImport) according to a hidden `intent` field both forms below post.
 * The distinction is worth the words -- reading a client wrapper like this
 * one as a Server Function is what put a 'use server' directive in a client
 * module earlier in this phase, which breaks at runtime.
 *
 * One `useActionState` this way means one `state`/`pending` pair drives the
 * whole screen, rather than two independent hooks whose results would need
 * reconciling into a single rendered view.
 */
async function runImport(previous: ImportState, formData: FormData): Promise<ImportState> {
  if (formData.get('intent') === 'commit') {
    return commitImport(previous, formData)
  }
  return previewImport(previous, formData)
}

export function ImportForm() {
  const textareaId = useId()
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    runImport,
    idleImportState,
  )

  const showPreview = state.stage === 'preview' && state.rows.length > 0

  return (
    <div className="flex flex-col gap-6">
      <form
        action={formAction}
        // React clears an uncontrolled form once a function action settles --
        // that would wipe the pasted text at the exact moment the preview
        // comes back, whether with a result or a refusal.
        onReset={(event) => event.preventDefault()}
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="intent" value="preview" />
        <p className="max-w-3xl text-[13px] text-muted">
          La primera fila del archivo lleva los nombres de las columnas. Las columnas{' '}
          <strong>concepto</strong>, <strong>unidad</strong>, <strong>coste</strong> y{' '}
          <strong>precio</strong> son obligatorias; <strong>grupo</strong>,{' '}
          <strong>código</strong> y <strong>descripción</strong> son opcionales. Un
          concepto con código actualiza el que ya exista con ese código; uno sin código
          siempre se añade como nuevo. Si el archivo no tiene columna descripción, la
          descripción ya guardada no se toca. Importar un concepto retirado no lo
          reactiva: hay que reactivarlo a mano desde el tarifario.
        </p>
        <label htmlFor={textareaId} className="text-sm font-medium">
          Pega aquí el CSV, o el bloque de celdas copiado desde Excel
        </label>
        <textarea
          id={textareaId}
          name="text"
          rows={10}
          defaultValue={state.text}
          placeholder={PLACEHOLDER}
          className={`${TEXTAREA_CLASS} font-mono`}
        />
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? 'Comprobando…' : 'Comprobar'}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}

      {state.issues.length > 0 ? (
        <ul role="alert" className="list-inside list-disc text-[13px] text-danger">
          {state.issues.map((issue, index) => (
            <li key={index}>
              Línea {issue.line}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {showPreview ? (
        <div className="flex flex-col gap-2">
          <table className="w-full border-collapse overflow-hidden rounded-[7px] border border-line bg-surface text-[13px]">
            <caption className="sr-only">Previsualización de la importación</caption>
            <thead>
              <tr>
                {PREVIEW_COLUMNS.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="border-b border-line px-2.5 pt-2 pb-1.5 text-left text-[10.5px] font-medium tracking-[0.05em] text-muted uppercase"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.line}>
                  <td className={CELL_CLASS}>{row.line}</td>
                  <td className={CELL_CLASS}>{ACTION_LABELS[row.action]}</td>
                  <td className={CELL_CLASS}>{row.groupName ?? UNGROUPED_NAME}</td>
                  <td className={`${CELL_CLASS} font-mono`}>{row.code ?? '—'}</td>
                  <td className={CELL_CLASS}>{row.name}</td>
                  <td className={CELL_CLASS}>{UNIT_LABELS[row.unit]}</td>
                  <td className={`${CELL_CLASS} num text-right`}>
                    {formatMoney(row.unitCost)}
                  </td>
                  <td className={`${CELL_CLASS} num text-right`}>
                    {formatMoney(row.unitPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form action={formAction}>
            <input type="hidden" name="intent" value="commit" />
            {/*
              The previewed text, on purpose: `state.text` is what the server
              parsed when Comprobar last ran, not what the textarea holds now
              (it is uncontrolled, so a later edit never reaches this field).
              That is what makes Importar write exactly the rows the table
              above shows. Do not "fix" this into reading the textarea --
              tests/e2e/price-book.spec.ts, 'commits what the preview showed,
              not what the textarea holds when Importar is pressed', edits the
              textarea after Comprobar and asserts the edit was not written.
            */}
            <input type="hidden" name="text" value={state.text} />
            <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
              {pending ? 'Importando…' : `Importar ${state.rows.length} conceptos`}
            </button>
          </form>
        </div>
      ) : null}

      {state.stage === 'done' ? (
        <div className="flex w-fit flex-col gap-2 rounded-[7px] border border-line bg-surface p-4">
          {/*
            "updated" only counts rows that carried a code -- an upsert never
            says which half of those were new and which replaced an existing
            row, so this is worded as "created or updated", never as a
            precise update count.
          */}
          <p className="text-[13px]">
            Importación completada: {state.groupsCreated} grupos nuevos, {state.created}{' '}
            conceptos nuevos sin código, {state.updated} conceptos con código creados o
            actualizados.
          </p>
          <Link
            href="/admin/price-book"
            className="w-fit text-[13px] text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Ver el tarifario
          </Link>
        </div>
      ) : null}
    </div>
  )
}
