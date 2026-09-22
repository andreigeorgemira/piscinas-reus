import { expect, test, type Page } from '@playwright/test'
import { adminDb, makeAdmin, uniqueEmail } from '../integration/helpers/db'

const password = 'test-password-123'
const staffEmail = uniqueEmail('link-staff-e2e')

/** Suffix shared by every row this file writes, so runs never collide. */
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const clientName = `Familia Enlace ${runId}`
const sentTitle = `Presupuesto enviado ${runId}`
const draftTitle = `Presupuesto en borrador ${runId}`
const toSendTitle = `Presupuesto por enviar ${runId}`

const sentToken = `token-enviado-${runId}`
const draftToken = `token-borrador-${runId}`
const rejectToken = `token-rechazo-${runId}`
const rejectTitle = `Presupuesto rechazado ${runId}`

let clientId: string

async function seedQuote(options: {
  title: string
  reference: string
  token: string
  status: 'draft' | 'sent'
}): Promise<string> {
  const admin = adminDb()

  const { data, error } = await admin
    .from('quotes')
    .insert({
      client_id: clientId,
      title: options.title,
      reference: options.reference,
      access_token: options.token,
      valid_until: '2026-12-31',
      client_notes: 'Pago en tres plazos: 40% al empezar, 40% a mitad de obra, 20% al entregar.',
      // Always born a draft: quote_items_guard_status (0009) refuses a line on
      // a quote that has left draft, so the lines go in first and the status
      // moves afterwards.
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) throw error

  const { error: linesError } = await admin.from('quote_items').insert([
    {
      quote_id: data.id,
      group_name: 'Revestimiento',
      name: `Gresite 2,5x2,5 ${runId}`,
      unit: 'm2',
      quantity: 10,
      unit_cost: 18,
      unit_price: 30,
      // Spelled out even though the column defaults to false: PostgREST builds
      // ONE insert for the array, with the union of the keys, so a field missing
      // from this row arrives as an explicit null and the not-null bites.
      is_recommended: false,
      position: 1,
    },
    {
      quote_id: data.id,
      group_name: 'Depuración',
      name: `Clorador salino ${runId}`,
      unit: 'unit',
      quantity: 1,
      unit_cost: 620,
      unit_price: 500,
      is_recommended: true,
      position: 2,
    },
  ])
  if (linesError) throw linesError

  if (options.status === 'sent') {
    const { error: statusError } = await admin
      .from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', data.id)
    if (statusError) throw statusError
  }

  return data.id
}

test.beforeAll(async () => {
  const admin = adminDb()

  const staff = await admin.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
  })
  if (staff.error) throw staff.error
  await makeAdmin(staff.data.user.id)

  const { data: client, error } = await admin
    .from('clients')
    .insert({
      email: uniqueEmail('link-client'),
      full_name: clientName,
      address: 'Camí de la Pedrera 12',
      city: 'Reus',
      postal_code: '43201',
    })
    .select('id')
    .single()
  if (error) throw error
  clientId = client.id

  await seedQuote({
    title: sentTitle,
    reference: `Q-LINK-${runId}`,
    token: sentToken,
    status: 'sent',
  })
  await seedQuote({
    title: draftTitle,
    reference: `Q-DRAFT-${runId}`,
    token: draftToken,
    status: 'draft',
  })
  await seedQuote({
    title: rejectTitle,
    reference: `Q-NO-${runId}`,
    token: rejectToken,
    status: 'sent',
  })
  await seedQuote({
    title: toSendTitle,
    reference: `Q-SEND-${runId}`,
    token: `token-por-enviar-${runId}`,
    status: 'draft',
  })
})

test.afterAll(async () => {
  const admin = adminDb()
  // Quotes first: a project created by an acceptance points at its client.
  await admin.from('quotes').update({ status: 'draft' }).like('title', `%${runId}`)
  await admin.from('quotes').delete().like('title', `%${runId}`)
  await admin.from('projects').delete().like('name', `%${runId}`)
  await admin.from('clients').delete().eq('id', clientId)
})

async function loginAsStaff(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(staffEmail)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin/)
}

test('a draft has no public page', async ({ page }) => {
  // The token exists and names a real quote; until it is sent there is nothing
  // to show, and the page cannot tell that apart from a wrong token.
  const response = await page.goto(`/q/${draftToken}`)

  expect(response?.status()).toBe(404)
})

test('a client reads the quote, picks an extra and signs it', async ({ page }) => {
  // No login anywhere in this test: the token is the whole credential.
  await page.goto(`/q/${sentToken}`)

  await expect(page.getByRole('heading', { name: 'Piscinas Reus' })).toHaveCount(0)
  await expect(page.getByText(`Q-LINK-${runId}`)).toBeVisible()
  await expect(page.getByText(clientName)).toBeVisible()
  await expect(page.getByText('Revestimiento')).toBeVisible()

  // 10 × 30 € of base work, and an extra that is not in the total yet.
  await expect(page.getByText('300,00 €').first()).toBeVisible()
  const extra = page.getByRole('checkbox', { name: /^Añadir Clorador salino/ })
  await expect(extra).not.toBeChecked()

  await extra.check()
  await expect(page.getByText('800,00 €').first()).toBeVisible({ timeout: 10_000 })

  // Cost and margin are nowhere on this page, and neither are the internal
  // notes: the function behind the token never sends them.
  await expect(page.getByText('Coste')).toHaveCount(0)
  await expect(page.getByText('Margen')).toHaveCount(0)

  // The PDF comes from the same token.
  const pdf = await page.request.get(`/q/${sentToken}/pdf`)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toContain('application/pdf')
  expect((await pdf.body()).subarray(0, 4).toString('latin1')).toBe('%PDF')

  await page.getByLabel('Nombre y apellidos').fill('Marta Soler')
  await page.getByRole('button', { name: 'Acepto el presupuesto' }).click()

  await expect(page.getByRole('heading', { name: 'Presupuesto aceptado' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/Firmado por Marta Soler/)).toBeVisible()
  // Answered: the form is gone and the extras are a record now.
  await expect(page.getByRole('button', { name: 'Acepto el presupuesto' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: /^Añadir Clorador salino/ })).toBeDisabled()

  // And the office sees it: accepted, with the project the acceptance created.
  await loginAsStaff(page)
  await page.goto(`/admin/quotes?q=${encodeURIComponent(sentTitle)}`)
  const row = page.getByRole('row').filter({ hasText: sentTitle })
  await expect(row).toContainText('Aceptado')
  await expect(row).toContainText(/P-\d{4}-\d{4}/)
})

test('a client says no, with a reason the office can read', async ({ page }) => {
  await page.goto(`/q/${rejectToken}`)

  await page.getByRole('button', { name: 'No me interesa' }).click()
  await page.getByLabel('¿Nos cuentas por qué? (opcional)').fill('Nos hemos decidido por otra empresa.')
  await page.getByRole('button', { name: 'Enviar respuesta' }).click()

  await expect(page.getByRole('heading', { name: 'Respuesta enviada' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Nos hemos decidido por otra empresa.')).toBeVisible()
  // Answered: there is nothing left to sign.
  await expect(page.getByRole('button', { name: 'Acepto el presupuesto' })).toHaveCount(0)

  // The office reads the reason on the quote itself, not only as a status.
  await loginAsStaff(page)
  await page.goto(`/admin/quotes?q=${encodeURIComponent(rejectTitle)}`)
  await page.getByRole('link', { name: `Q-NO-${runId}` }).click()
  await expect(page.getByText(/El cliente lo rechazó/)).toBeVisible()
  await expect(page.getByText(/Nos hemos decidido por otra empresa/)).toBeVisible()
})

test('sending from the office marks the quote sent and opens its link', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto(`/admin/quotes?q=${encodeURIComponent(toSendTitle)}`)

  const row = page.getByRole('row').filter({ hasText: toSendTitle })
  await expect(row).toContainText('Borrador')

  await row.getByRole('button', { name: /^Acciones de Q-SEND/ }).click()
  await page.getByRole('button', { name: 'Enviar al cliente' }).click()

  // The dialog shows the address it will send to and the link it will carry.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(clientName)
  await expect(dialog.getByLabel('Enlace del cliente')).toHaveValue(
    new RegExp(`/q/token-por-enviar-${runId}$`),
  )

  await dialog.getByRole('button', { name: 'Enviar al cliente' }).click()

  // No RESEND_API_KEY in the test environment, so nothing leaves the building
  // and the screen says exactly that rather than claiming an email.
  await expect(page.locator('[data-sonner-toast]')).toContainText(
    /marcado como enviado|enviado a/,
    { timeout: 15_000 },
  )
  await expect(row).toContainText('Enviado')

  // The link works from this moment, which is why the status moves first.
  const anonymous = await page.context().browser()!.newContext()
  const visitor = await anonymous.newPage()
  await visitor.goto(`/q/token-por-enviar-${runId}`)
  await expect(visitor.getByText(`Q-SEND-${runId}`)).toBeVisible()
  await anonymous.close()
})
