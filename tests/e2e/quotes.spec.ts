import { expect, test, type Page } from '@playwright/test'
import { adminDb, makeAdmin, uniqueEmail } from '../integration/helpers/db'

const password = 'test-password-123'
const staffEmail = uniqueEmail('quotes-staff-e2e')
const clientEmail = uniqueEmail('quotes-client-e2e')

/**
 * Suffix shared by every row this file creates, so a run against a database an
 * earlier run already touched can never collide with its leftovers.
 *
 * The names are deliberately unlike the price-book spec's fixtures: that file
 * sweeps 'Grupo %' and 'Concepto %' in its own beforeAll, and the two specs
 * share a database.
 */
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const clientName = `Familia E2E ${runId}`
const conceptName = `Gresite E2E ${runId}`
const partidaName = `Partida E2E ${runId}`
const quoteTitle = `Presupuesto E2E ${runId}`

let clientRowId: string

test.beforeAll(async () => {
  const admin = adminDb()

  const staff = await admin.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
  })
  if (staff.error) throw staff.error
  await makeAdmin(staff.data.user.id)

  const customer = await admin.auth.admin.createUser({
    email: clientEmail,
    password,
    email_confirm: true,
  })
  if (customer.error) throw customer.error

  const { data: client, error: clientError } = await admin
    .from('clients')
    .insert({
      email: uniqueEmail('quotes-e2e-client'),
      full_name: clientName,
      phone: '977 00 11 22',
      address: 'Camí de la Pedrera 12',
      city: 'Reus',
      postal_code: '43201',
    })
    .select('id')
    .single()
  if (clientError) throw clientError
  clientRowId = client.id

  // The concept this quote is written from, in the book the seed leaves behind.
  const { data: book, error: bookError } = await admin
    .from('price_books')
    .select('id')
    .order('position')
    .limit(1)
    .single()
  if (bookError) throw bookError

  const { data: group, error: groupError } = await admin
    .from('price_book_groups')
    .insert({ price_book_id: book.id, name: partidaName, position: 900 })
    .select('id')
    .single()
  if (groupError) throw groupError

  const { error: itemError } = await admin.from('price_book_items').insert({
    price_book_id: book.id,
    group_id: group.id,
    code: `PQ-${runId}`.slice(0, 40),
    name: conceptName,
    unit: 'm2',
    unit_cost: 10,
    unit_price: 20,
  })
  if (itemError) throw itemError
})

test.afterAll(async () => {
  const admin = adminDb()

  // Quotes first: projects are referenced by quotes.project_id (on delete set
  // null), and the client cannot go while a quote points at it (on delete
  // restrict). Deleting a quote cascades to its lines, which the freeze
  // trigger allows on purpose (0009_quote_immutability.sql).
  await admin.from('quotes').delete().like('title', `%${runId}`)
  await admin.from('projects').delete().like('name', `%${runId}`)
  await admin.from('clients').delete().eq('id', clientRowId)
  await admin.from('price_book_items').delete().like('name', `%${runId}`)
  await admin.from('price_book_groups').delete().like('name', `%${runId}`)
})

/**
 * Waits for a toast, then closes it rather than waiting it out.
 *
 * Toasts stack at the bottom right, over the last column of every table, where
 * every row keeps its buttons: a test that clicks one of those and then reaches
 * for the next control has a toast in the way, and hovering it pauses sonner's
 * own timer, so waiting for it to leave can wait forever. The price-book spec
 * moves the mouse away and waits; this one presses the close button the Toaster
 * already renders, which needs no timing assumption at all.
 */
async function dismissToast(page: Page, text: string) {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: text })
  await expect(toast).toBeVisible()
  await toast.locator('[data-close-button]').click()
  await expect(toast).toBeHidden()
  // Anything still on screen (an earlier toast that has not expired) must not
  // sit over the next click either.
  await page.mouse.move(0, 0)
}

async function loginAsStaff(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(staffEmail)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin/)
}

async function loginAsClient(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(clientEmail)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/portal/)
}

test('keeps a client out of the clients and quotes screens', async ({ page }) => {
  await loginAsClient(page)

  await page.goto('/admin/clients')
  await expect(page).toHaveURL(/\/portal/)

  await page.goto('/admin/quotes')
  await expect(page).toHaveURL(/\/portal/)
})

test('writes a quote from the catalogue, sends it, accepts it and reopens it', async ({ page }) => {
  await loginAsStaff(page)

  // From the client's own page, which is where a quote actually starts: staff
  // look the client up and open the next quote from there.
  await page.goto('/admin/clients')
  await page.getByLabel('Buscar clientes').fill(clientName)
  // The search box navigates on its own a beat after the typing stops
  // (src/components/ui/action-bar.tsx). Clicking before that navigation lands
  // starts a second one that the debounced push then overtakes, and the
  // browser ends up back on the list. Waiting for the query in the URL is
  // waiting for the search to have happened.
  await expect(page).toHaveURL(/[?&]q=/)
  await page.getByRole('link', { name: clientName }).click()
  await expect(page.getByRole('heading', { name: clientName })).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo presupuesto' }).click()
  await page.getByLabel('Título').fill(quoteTitle)
  await page.getByRole('button', { name: 'Crear y abrir' }).click()

  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9a-f-]+/, { timeout: 15_000 })
  // The reference is allocated by the database, not by the form.
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toHaveText(/^Q-\d{4}-\d{4}$/)

  // A line from the catalogue. Every figure on it is a copy of the concept's,
  // read on the server rather than taken from the browser.
  await page.getByLabel('Buscar conceptos en el tarifario').fill(conceptName)
  await page.getByRole('button', { name: new RegExp(conceptName) }).click()
  await dismissToast(page, 'añadido')

  const line = page.getByRole('row').filter({ hasText: conceptName })
  await expect(line).toBeVisible()

  // 12,5 m2 at 20 € is 250 €, and the cost the catalogue carried is 10 €.
  await page.getByRole('button', { name: `Editar ${conceptName}` }).click()
  await page.getByLabel('Cantidad', { exact: true }).fill('12,5')
  await page.getByRole('button', { name: 'Guardar la línea' }).click()
  await dismissToast(page, 'Línea guardada')

  await expect(line).toContainText('250,00')

  // The totals come from the quote_totals view, not from this screen: base
  // 250,00 and cost 125,00 (12,5 at the catalogue's 10 €).
  const panel = page.getByRole('complementary', { name: 'Resumen del presupuesto' })
  await expect(panel).toContainText('250,00')
  await expect(panel).toContainText('125,00')

  // A line that is in no catalogue.
  await page.getByRole('button', { name: 'Línea libre' }).click()
  await page.getByLabel('Concepto', { exact: true }).fill(`Grúa ${runId}`)
  await page.getByLabel('Precio', { exact: true }).fill('100,00')
  await page.getByRole('button', { name: 'Añadir línea' }).click()
  await dismissToast(page, 'Línea añadida')

  await expect(panel).toContainText('350,00')

  // Sending freezes the lines. The refusal is a trigger; what is asserted here
  // is that the screen stops offering the controls whose save it would refuse.
  await page.getByRole('button', { name: 'Marcar como enviado' }).click()
  await dismissToast(page, 'enviado')

  await expect(page.locator('header')).toContainText('Enviado')
  await expect(page.getByRole('button', { name: `Editar ${conceptName}` })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Línea libre' })).toBeHidden()
  await expect(page.getByText('congeladas')).toBeVisible()
  // The quote's own fields go with the lines: the title and the notes are what
  // the client is reading, so they stop being editable at the same moment.
  await expect(panel.getByRole('button', { name: 'Editar' })).toBeHidden()

  // Accepting creates the project, which is what makes a quote work rather than
  // paperwork. The dialog says so before it happens.
  await page.getByRole('button', { name: 'Marcar como aceptado' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Marcar como aceptado' })
    .click()
  await dismissToast(page, 'Proyecto creado')

  await expect(page.locator('header')).toContainText(/Proyecto P-\d{4}-\d{4}/)
  await expect(page.locator('header')).toContainText('Aceptado')

  // Reopening gives the lines back and kills the link. The project stays.
  await page.getByRole('button', { name: 'Volver a borrador' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Volver a borrador' }).click()
  await dismissToast(page, 'reabierto')

  await expect(page.locator('header')).toContainText('Borrador')
  await expect(page.locator('header')).toContainText(/Proyecto P-\d{4}-\d{4}/)
  await expect(page.getByRole('button', { name: `Editar ${conceptName}` })).toBeVisible()
})

test('lists the quote under its client and filters by status', async ({ page }) => {
  await loginAsStaff(page)

  await page.goto('/admin/quotes')
  await page.getByLabel('Buscar presupuestos').fill(clientName)
  await expect(page).toHaveURL(/[?&]q=/)

  const row = page.getByRole('row').filter({ hasText: quoteTitle })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toContainText(clientName)
  await expect(row).toContainText('Borrador')
  await expect(row).toContainText('350,00')

  // The status filter, which is how staff find what is out of the office.
  await page.goto('/admin/quotes?status=sent')
  await expect(page.getByRole('row').filter({ hasText: quoteTitle })).toBeHidden()
  await expect(page.getByText('Estado:')).toBeVisible()
})
