import { expect, test, type Page } from '@playwright/test'
import { adminDb, makeAdmin, uniqueEmail } from '../integration/helpers/db'

/**
 * The company settings, VAT on a quote, and the "Presentación" view: groups
 * whose prices the client does not see, renamed and reordered, all the way to
 * the page the client opens.
 */

const password = 'test-password-123'
const staffEmail = uniqueEmail('presentation-staff-e2e')
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const reference = `P-E2E-${runId}`
const title = `Presentación E2E ${runId}`

let quoteId: string

test.beforeAll(async () => {
  const admin = adminDb()

  const staff = await admin.auth.admin.createUser({ email: staffEmail, password, email_confirm: true })
  if (staff.error) throw staff.error
  await makeAdmin(staff.data.user.id)

  const { data: client, error: clientError } = await admin
    .from('clients')
    .insert({ email: uniqueEmail('presentation-client-e2e'), full_name: `Familia Presentación ${runId}` })
    .select('id')
    .single()
  if (clientError) throw clientError

  const { data: quote, error } = await admin
    .from('quotes')
    .insert({ client_id: client.id, title, reference, access_token: `token-presentacion-${runId}`, vat_rate: 21 })
    .select('id')
    .single()
  if (error) throw error
  quoteId = quote.id

  const lines = await admin.from('quote_items').insert(
    [
      ['Excavación del vaso', 'Obra civil', 10, 50],
      ['Hormigón gunitado', 'Obra civil', 10, 100],
      ['Gresite azul', 'Revestimiento', 20, 30],
      ['Depuradora 8 m3/h', 'Equipos', 1, 800],
    ].map(([name, group, quantity, price], index) => ({
      quote_id: quote.id,
      name,
      group_name: group,
      unit: 'unit',
      quantity,
      unit_price: price,
      unit_cost: 0,
      discount_pct: 0,
      is_recommended: false,
      position: index + 1,
    })),
  )
  if (lines.error) throw lines.error
})

async function loginAsStaff(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(staffEmail)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin/)
}

function section(page: Page, name: string) {
  return page.getByRole('region', { name })
}

test('saves the company’s fiscal details and tidies the tax id', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto('/admin/settings')

  await page.getByLabel('Razón social').fill('Piscinas Reus S.L.')
  await page.getByLabel('NIF / CIF').fill('b-43.123 456')
  await page.getByLabel('IVA por defecto').fill('21')
  await page.getByRole('button', { name: 'Guardar ajustes' }).click()
  await expect(page.getByText('Ajustes guardados')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('NIF / CIF')).toHaveValue('B43123456')
  await expect(page.getByLabel('IVA por defecto')).toHaveValue('21')
})

test('arranges the groups and hides prices all the way to the client’s page', async ({ page, browser }) => {
  await loginAsStaff(page)
  await page.goto(`/admin/quotes/${quoteId}?view=presentation`)

  // Obra civil: only its total.
  await section(page, 'Obra civil').getByRole('radio', { name: 'Solo total' }).click()
  await expect(section(page, 'Obra civil').getByRole('radio', { name: 'Solo total' })).toHaveAttribute('aria-checked', 'true')

  // Revestimiento becomes Acabados, without prices.
  await section(page, 'Revestimiento').getByRole('button', { name: 'Renombrar Revestimiento' }).click()
  await page.getByLabel('Nuevo nombre para Revestimiento').fill('Acabados')
  await page.getByLabel('Nuevo nombre para Revestimiento').press('Enter')
  await expect(section(page, 'Acabados')).toBeVisible()
  await section(page, 'Acabados').getByRole('radio', { name: 'Sin precios' }).click()
  await expect(section(page, 'Acabados').getByRole('radio', { name: 'Sin precios' })).toHaveAttribute('aria-checked', 'true')

  // Equipos goes first.
  await section(page, 'Equipos').getByRole('button', { name: 'Subir Equipos' }).click()
  await section(page, 'Equipos').getByRole('button', { name: 'Subir Equipos' }).click()
  await expect(page.getByRole('region').first()).toHaveAccessibleName('Equipos')

  // Send it, and open the link as the client would: no session at all.
  await page.getByRole('button', { name: 'Enviar al cliente' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar al cliente' }).click()
  await expect(page.getByText(/marcado como enviado/)).toBeVisible()

  const { data } = await adminDb().from('quotes').select('access_token').eq('id', quoteId).single()
  const visitor = await browser.newContext()
  const client = await visitor.newPage()
  await client.goto(`/q/${data!.access_token}`)

  const document = client.locator('article')
  await expect(document.getByRole('heading', { level: 2 }).first()).toHaveText('Equipos')
  // Solo total: the group and its total, no lines.
  await expect(document).toContainText('Obra civil')
  await expect(document).toContainText('1.500,00')
  await expect(document).not.toContainText('Excavación del vaso')
  // Sin precios: the line and its quantity, not its price.
  await expect(document).toContainText('Gresite azul')
  await expect(document).not.toContainText('30,00')
  // Detailed: everything.
  await expect(document).toContainText('Depuradora 8 m3/h')

  // 2.900 € of work plus 21 % VAT.
  await expect(client.getByText('Base imponible 2.900,00')).toBeVisible()
  await expect(client.getByText('3.509,00 €', { exact: true })).toBeVisible()
  // And signing commits to that figure, VAT included.
  await expect(client.getByText(/Al firmar aceptas los 3\.509,00\s€ \(IVA incluido\)/)).toBeVisible()

  await visitor.close()
})
