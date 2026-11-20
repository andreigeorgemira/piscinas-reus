'use client'

import { useActionState, useId, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { FIELD_CLASS } from '@/app/admin/price-book/ui'
import { VatField } from '@/app/admin/quotes/vat-field'
import type { CompanySettings } from '@/lib/settings/queries'
import { updateCompanySettings } from './actions'

type TextKey =
  | 'trade_name'
  | 'tagline'
  | 'legal_name'
  | 'tax_id'
  | 'address'
  | 'postal_code'
  | 'city'
  | 'province'
  | 'phone'
  | 'email'
  | 'website'
  | 'quote_footer'

type Values = Record<TextKey, string>

function valuesOf(settings: CompanySettings): Values {
  return {
    trade_name: settings.tradeName,
    tagline: settings.tagline ?? '',
    legal_name: settings.legalName ?? '',
    tax_id: settings.taxId ?? '',
    address: settings.address ?? '',
    postal_code: settings.postalCode ?? '',
    city: settings.city ?? '',
    province: settings.province ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    website: settings.website ?? '',
    quote_footer: settings.quoteFooter ?? '',
  }
}

/** The schema's field names, which is what the action reports errors under. */
const ERROR_KEY: Record<TextKey, string> = {
  trade_name: 'tradeName',
  tagline: 'tagline',
  legal_name: 'legalName',
  tax_id: 'taxId',
  address: 'address',
  postal_code: 'postalCode',
  city: 'city',
  province: 'province',
  phone: 'phone',
  email: 'email',
  website: 'website',
  quote_footer: 'quoteFooter',
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line-soft py-6 last:border-0 md:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="pt-1 text-xs leading-5 text-muted">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/**
 * The company's details and defaults, as one form.
 *
 * Controlled fields, like the quote dialog: a refused save marks the box that
 * caused it and keeps everything else that was typed.
 */
export function SettingsForm({ settings }: { settings: CompanySettings }) {
  const [values, setValues] = useState<Values>(() => valuesOf(settings))
  const footerId = useId()

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const next = await updateCompanySettings(previous, formData)
      if (next.error === null) toast.success('Ajustes guardados')
      return next
    },
    idleState,
  )
  const fields = state.fields ?? {}

  function field(
    name: TextKey,
    label: string,
    options: {
      required?: boolean
      placeholder?: string
      maxLength?: number
      inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'url'
      wide?: boolean
      hint?: string
    } = {},
  ) {
    const error = fields[ERROR_KEY[name]]
    const id = `settings-${name}`
    return (
      <div className={`flex flex-col gap-1.5 ${options.wide ? 'sm:col-span-2' : ''}`}>
        <label htmlFor={id} className="text-xs font-medium">
          {label}
          {options.required ? (
            <span className="text-danger" title="Obligatorio">
              {' *'}
            </span>
          ) : null}
        </label>
        <input
          id={id}
          name={name}
          value={values[name]}
          onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
          required={options.required}
          placeholder={options.placeholder}
          maxLength={options.maxLength}
          inputMode={options.inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || options.hint ? `${id}-note` : undefined}
          className={`${FIELD_CLASS} h-9 ${error ? 'border-danger' : ''}`}
        />
        {error ? (
          <p id={`${id}-note`} className="text-2xs text-danger">
            {error}
          </p>
        ) : options.hint ? (
          <p id={`${id}-note`} className="text-2xs text-faint">
            {options.hint}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form action={formAction} className="mx-auto w-full max-w-4xl px-6 pb-10">
      <Section
        title="Empresa"
        description="Lo que encabeza cada presupuesto: en el PDF, en el enlace del cliente y en el correo."
      >
        {field('trade_name', 'Nombre comercial', { required: true, maxLength: 120, placeholder: 'Piscinas Reus' })}
        {field('tagline', 'Actividad', { maxLength: 200, placeholder: 'Construcción y mantenimiento de piscinas' })}
      </Section>

      <Section
        title="Datos fiscales"
        description="Razón social y NIF/CIF del emisor. Salen bajo el nombre comercial en el PDF y en la página del cliente."
      >
        {field('legal_name', 'Razón social', { maxLength: 200, placeholder: 'Piscinas Reus S.L.' })}
        {field('tax_id', 'NIF / CIF', {
          maxLength: 20,
          placeholder: 'B43123456',
          hint: 'Nueve letras y cifras. Los espacios y guiones se quitan solos.',
        })}
        {field('address', 'Dirección', { maxLength: 200, placeholder: 'Carrer Major 1', wide: true })}
        {field('postal_code', 'Código postal', { maxLength: 5, inputMode: 'numeric', placeholder: '43201' })}
        {field('city', 'Localidad', { maxLength: 120, placeholder: 'Reus' })}
        {field('province', 'Provincia', { maxLength: 120, placeholder: 'Tarragona' })}
      </Section>

      <Section title="Contacto" description="Para que el cliente sepa a quién llamar o escribir.">
        {field('phone', 'Teléfono', { maxLength: 40, inputMode: 'tel', placeholder: '977 00 00 00' })}
        {field('email', 'Correo', { maxLength: 200, inputMode: 'email', placeholder: 'hola@piscinasreus.es' })}
        {field('website', 'Web', { maxLength: 200, inputMode: 'url', placeholder: 'piscinasreus.es', wide: true })}
      </Section>

      <Section
        title="IVA"
        description="El tipo con el que nace cada presupuesto nuevo. Cada presupuesto guarda el suyo y se puede cambiar en 'Datos': cambiar esto no toca los que ya existen."
      >
        <VatField
          name="default_vat_rate"
          defaultRate={settings.defaultVatRate}
          error={fields.defaultVatRate}
          label="IVA por defecto"
          hint="Cualquier porcentaje; vacío, sin IVA. Los precios del tarifario son siempre sin IVA."
        />
      </Section>

      <Section
        title="Presupuestos"
        description="La letra pequeña que cierra cada página del PDF y la página del cliente."
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={footerId} className="text-xs font-medium">
            Pie del presupuesto
          </label>
          <textarea
            id={footerId}
            name="quote_footer"
            value={values.quote_footer}
            onChange={(event) => setValues((current) => ({ ...current, quote_footer: event.target.value }))}
            rows={3}
            maxLength={600}
            aria-invalid={fields.quoteFooter ? true : undefined}
            className={`${FIELD_CLASS} py-2 ${fields.quoteFooter ? 'border-danger' : ''}`}
          />
          {fields.quoteFooter ? <p className="text-2xs text-danger">{fields.quoteFooter}</p> : null}
        </div>
      </Section>

      <div className="flex items-center gap-3 pt-4">
        {state.error && Object.keys(fields).length === 0 ? (
          <p role="alert" className="text-xs text-danger">
            {state.error}
          </p>
        ) : null}
        {Object.keys(fields).length > 0 ? (
          <p role="alert" className="text-xs text-danger">
            Revisa los campos marcados.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="ml-auto flex h-9 items-center rounded-md border border-primary bg-primary px-4 text-sm font-medium text-primary-ink hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar ajustes'}
        </button>
      </div>
    </form>
  )
}
