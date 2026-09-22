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
const freeLineName = `Desvío de riego ${runId}`
const newClientName = `Cliente nuevo ${runId}`
const looseQuoteTitle = `Sin cliente E2E ${runId}`

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
    /*
     * position 990, not 900: the price-book spec's drag test creates its own two
     * groups at 900 and 901, and a group of this file's at 900 sorted BETWEEN
     * them -- with a row in it, right under the row that test picks up. The drag
     * then started on the wrong handle and the whole test failed, but only in the
     * full suite, where both files' fixtures are in the same catalogue at once.
     * Each file keeps its own band.
     */
    .insert({ price_book_id: book.id, name: partidaName, position: 990 })
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
  await admin.from('quotes').delete().like('title', `%${runId} (copia)`)
  await admin.from('projects').delete().like('name', `%${runId}`)
  await admin.from('clients').delete().eq('id', clientRowId)
  await admin.from('clients').delete().like('full_name', `%${runId}`)
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

test('builds a quote by ticking the catalogue, sends it, accepts it and reopens it', async ({ page }) => {
  await loginAsStaff(page)

  // From the client's own page, which is where a quote actually starts: staff
  // look the client up and open the next quote from there.
  await page.goto('/admin/clients')
  await page.getByLabel('Buscar clientes').fill(clientName)
  // The search box navigates on its own a beat after the typing stops
  // (src/components/ui/action-bar.tsx). Waiting for the query in the URL is
  // waiting for that navigation to have happened, so the click below is not
  // overtaken by it.
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
  const reference = (await heading.textContent())!.trim()

  // The catalogue IS the editor: the concept is on screen from the start, in its
  // group, and ticking it writes the line.
  const group = page.getByRole('region').filter({ hasText: partidaName })
  await expect(group).toBeVisible()
  await group.getByRole('checkbox', { name: `Añadir ${conceptName}` }).check()
  await expect(group.getByRole('checkbox', { name: `Quitar ${conceptName}` })).toBeVisible()

  const line = group.getByRole('row').filter({ hasText: conceptName })
  // Every figure is copied from the concept, read on the server: 1 × 20 €.
  await expect(line).toContainText('20,00')

  // A quantity saves on blur, with no Guardar button. 12,5 m2 at 20 € is 250 €.
  await line.getByLabel(`Cantidad de ${conceptName}`).fill('12,5')
  await page.keyboard.press('Tab')
  await expect(line).toContainText('250,00')

  const totals = page.getByRole('contentinfo')
  await expect(totals).toContainText('250,00')
  // Cost came from the catalogue too (10 €), so the margin is the other half.
  await expect(totals).toContainText('125,00')

  // Marking it optional takes it out of the price without deleting anything. One
  // checkbox at the end of the row, no Base/Opcional switch in the middle of it.
  const optional = line.getByRole('checkbox', { name: `Marcar ${conceptName} como extra opcional` })
  await optional.check()
  await expect(totals).toContainText('Extras opcionales')
  await optional.uncheck()
  await expect(totals).toContainText('250,00')

  // The unit belongs to this quote, not to the tariff: hours here leave the
  // catalogue's m² alone.
  await line.getByLabel(`Unidad de ${conceptName}`).selectOption('hour')
  await expect(line.getByLabel(`Unidad de ${conceptName}`)).toHaveValue('hour')

  // The same concept twice: the case a checkbox alone cannot express. The copy
  // owns its name, because "Gresite" twice on a PDF tells the client nothing.
  await line.getByRole('button', { name: `Duplicar ${conceptName}` }).click()
  await dismissToast(page, 'Línea duplicada')

  const copyName = `${conceptName} escalera`
  const copyRow = group.getByRole('row').filter({ hasText: 'copia' })
  await copyRow.getByRole('textbox').first().fill(copyName)
  await page.keyboard.press('Tab')
  await expect(group.getByRole('row').filter({ hasText: copyName })).toBeVisible()

  // A line of this quote and no catalogue, filed INSIDE the group, which is what
  // makes the PDF print it among its neighbours.
  await group.getByRole('button', { name: `Línea libre en ${partidaName}` }).click()
  // Exact labels: every row of the table also has a "Precio de <concepto>"
  // field, and a substring match would find those too.
  await group.getByLabel('Concepto', { exact: true }).fill(freeLineName)
  await group.getByLabel('Precio', { exact: true }).fill('100,00')
  await group.getByRole('button', { name: `Añadir a ${partidaName}` }).click()
  await dismissToast(page, 'Línea añadida')

  const freeRow = group.getByRole('row').filter({ hasText: freeLineName })
  await expect(freeRow).toContainText('línea libre')
  await expect(freeRow).toContainText('100,00')

  // Unticking a concept that has a copy asks first: the checkbox says whether
  // the concept is on the quote at all, so it takes both lines.
  // click, not uncheck: this one opens a dialog instead of flipping the box, so
  // Playwright's "did the state change" assertion inside uncheck() would fail on
  // the very behaviour being tested.
  await group.getByRole('checkbox', { name: `Quitar ${conceptName}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Quitar todas' }).click()
  await expect(group.getByRole('row').filter({ hasText: copyName })).toBeHidden()
  await expect(group.getByRole('checkbox', { name: `Añadir ${conceptName}` })).toBeVisible()
  // The free line is untouched: it belongs to the quote, not to the concept.
  await expect(freeRow).toBeVisible()

  // Every status move happens from the list now: the badge is the control, and
  // the editor is left for writing the quote.
  await page.goto('/admin/quotes')
  const row = page.getByRole('row').filter({ hasText: reference })
  await row.getByRole('button', { name: `Cambiar el estado de ${reference}` }).click()
  await page.getByRole('button', { name: 'Marcar como enviado' }).click()
  await dismissToast(page, reference)
  await expect(row).toContainText('Enviado')

  // Sending freezes the lines. The refusal is a trigger; what is asserted here is
  // that the screen stops offering the controls whose save it would refuse.
  await row.getByRole('link', { name: reference }).click()
  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9a-f-]+/)
  await expect(
    page.getByRole('checkbox', { name: `Añadir ${conceptName}` }),
  ).toBeDisabled()
  await expect(page.getByRole('button', { name: `Línea libre en ${partidaName}` })).toBeHidden()

  // Accepting creates the project, which is what makes a quote work rather than
  // paperwork. The dialog says so before it happens.
  await page.goto('/admin/quotes')
  await row.getByRole('button', { name: `Cambiar el estado de ${reference}` }).click()
  await page.getByRole('button', { name: 'Marcar como aceptado' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar como aceptado' }).click()
  await dismissToast(page, 'Proyecto creado')

  await expect(row).toContainText('Aceptado')
  await expect(row).toContainText(/P-\d{4}-\d{4}/)

  // Reopening gives the lines back and kills the link. The project stays.
  await row.getByRole('button', { name: `Cambiar el estado de ${reference}` }).click()
  await page.getByRole('button', { name: 'Volver a borrador' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Volver a borrador' }).click()
  await dismissToast(page, 'borrador')

  await expect(row).toContainText('Borrador')
  await expect(row).toContainText(/P-\d{4}-\d{4}/)
})

test('copies a quote from the list, lines included', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto(`/admin/quotes?q=${encodeURIComponent(quoteTitle)}`)

  const row = page.getByRole('row').filter({ hasText: quoteTitle })
  const reference = (await row.getByRole('link').first().textContent())!.trim()
  const lines = (await row.getByRole('cell').nth(3).textContent())!.trim()

  await row.getByRole('button', { name: `Duplicar ${reference}` }).click()
  await dismissToast(page, 'Copiado en')

  // The copy is a draft of its own, named so the two are never confused, and it
  // carries the same lines: the next quote is usually the last one with two
  // numbers changed.
  const copy = page.getByRole('row').filter({ hasText: `${quoteTitle} (copia)` })
  await expect(copy).toBeVisible()
  await expect(copy).toContainText('Borrador')
  await expect(copy.getByRole('cell').nth(3)).toHaveText(lines)
})

test('keeps what was typed when the form is refused, and creates the client from the dialog', async ({
  page,
}) => {
  await loginAsStaff(page)
  await page.goto('/admin/quotes')
  await page.getByRole('button', { name: 'Nuevo presupuesto' }).click()

  // A title of spaces passes the browser's own `required` and is refused by the
  // schema, which is the path that used to hand back an empty dialog.
  await page.getByLabel('Título *').fill('   ')
  await page.getByLabel('Válido hasta').fill('2026-10-21')
  await page.getByRole('button', { name: 'Crear y abrir' }).click()

  await expect(page.getByText('El título es obligatorio.')).toBeVisible()
  // The point of the whole change: the date is still there.
  await expect(page.getByLabel('Válido hasta')).toHaveValue('2026-10-21')

  // The client is optional, and the way to have one without leaving this dialog
  // is to type the name and create it on top.
  // By placeholder: the list screen behind the dialog has a "Cliente" filter of
  // its own, and the picker's own hidden field carries the id.
  await page.getByPlaceholder('Escribe un nombre').fill(newClientName)
  await page.getByRole('button', { name: `Crear el cliente «${newClientName}»` }).click()

  const clientDialog = page.getByRole('dialog').filter({ hasText: 'Nuevo cliente' })
  await expect(clientDialog.getByLabel('Nombre *')).toHaveValue(newClientName)
  await clientDialog.getByLabel('Correo *').fill(`nuevo-${runId}@example.test`)
  await clientDialog.getByRole('button', { name: 'Crear cliente' }).click()

  // The toast is deliberately NOT dismissed here. A Radix dialog is modal, so
  // everything outside it -- the toast stack included -- is inert while it is
  // open: the close button cannot be clicked until the dialog goes, and trying
  // is how this test spent thirty seconds. It expires on its own.
  //
  // Back on the quote dialog, with the client it just created selected. Scoped
  // to the dialog: the list screen behind it has a "Cliente" filter of its own.
  await expect(page.getByPlaceholder('Escribe un nombre')).toHaveValue(newClientName)

  await page.getByLabel('Título *').fill(`Presupuesto con cliente nuevo ${runId}`)
  await page.getByRole('button', { name: 'Crear y abrir' }).click()

  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9a-f-]+/, { timeout: 15_000 })
  await expect(page.locator('header')).toContainText(newClientName)
})

test('writes a quote with no client, and refuses to accept it until it has one', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto('/admin/quotes')

  await page.getByRole('button', { name: 'Nuevo presupuesto' }).click()
  await page.getByLabel('Título *').fill(looseQuoteTitle)
  await page.getByRole('button', { name: 'Crear y abrir' }).click()

  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9a-f-]+/, { timeout: 15_000 })
  await expect(page.locator('header')).toContainText('Sin cliente')

  const reference = (await page.getByRole('heading', { level: 1 }).textContent())!.trim()

  await page.goto('/admin/quotes')
  const row = page.getByRole('row').filter({ hasText: looseQuoteTitle })
  await expect(row).toContainText('Sin cliente')

  // It can leave the office: a price given on the phone is a real quote.
  await row.getByRole('button', { name: `Cambiar el estado de ${reference}` }).click()
  await page.getByRole('button', { name: 'Marcar como enviado' }).click()
  await dismissToast(page, reference)
  await expect(row).toContainText('Enviado')

  // Accepting is where it would become a project, and a project belongs to
  // somebody: the database refuses it and the screen says what to do.
  await row.getByRole('button', { name: `Cambiar el estado de ${reference}` }).click()
  await page.getByRole('button', { name: 'Marcar como aceptado' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar como aceptado' }).click()
  await dismissToast(page, 'Asigna un cliente')

  await expect(row).toContainText('Enviado')
})

test('lists the quote under its client and filters by status', async ({ page }) => {
  await loginAsStaff(page)

  // Straight to the filtered address rather than typing into the box: the
  // search itself is a GET form whose behaviour the price-book spec already
  // pins, and what this test is about is what the row says.
  await page.goto(`/admin/quotes?q=${encodeURIComponent(clientName)}`)

  // Not the copy the duplicate test leaves behind, whose title contains this
  // one's.
  const row = page
    .getByRole('row')
    .filter({ hasText: quoteTitle })
    .filter({ hasNotText: '(copia)' })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toContainText(clientName)
  await expect(row).toContainText('Borrador')
  await expect(row).toContainText('100,00')

  // The status filter, which is how staff find what is out of the office.
  await page.goto('/admin/quotes?status=sent')
  await expect(
    page.getByRole('row').filter({ hasText: quoteTitle }).filter({ hasNotText: '(copia)' }),
  ).toBeHidden()
  await expect(page.getByText('Estado:')).toBeVisible()
})
