import { expect, test, type Page } from '@playwright/test'
import { adminDb, anonDb, makeAdmin, uniqueEmail } from '../integration/helpers/db'

const password = 'test-password-123'
const staffEmail = uniqueEmail('price-book-staff-e2e')
const clientEmail = uniqueEmail('price-book-client-e2e')

// Suffix shared by every group, item and code this file creates. A run
// against a database another run already touched (or seeded fresh by
// `npx supabase db reset`) can therefore never collide with leftover rows --
// every name below is unique to this run, never reused across runs.
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const csvLabel = 'Pega aquí el CSV, o el bloque de celdas copiado desde Excel'

test.beforeAll(async () => {
  const admin = adminDb()

  // Sweeps the 1001-row fixture the paging test near the end of this file
  // seeds, in case an earlier run never got to delete it. That test cleans
  // up in a `finally`, which Playwright does not guarantee runs when a test
  // hits its timeout -- and leaked 'Relleno ' rows sort ahead of every code
  // this file creates (FILL- < IMP- < PROH- < RET-), so 1001 survivors push
  // all of them past the 1000 rows the server returns and break this whole
  // file until someone runs `npx supabase db reset`. That reset is exactly
  // the prerequisite this file was changed to stop needing, so the cleanup
  // has to be unconditional rather than best-effort.
  const { error: sweepError } = await admin
    .from('price_book_items')
    .delete()
    .like('name', 'Relleno %')
  if (sweepError) throw sweepError

  const staff = await admin.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
  })
  if (staff.error) throw staff.error
  await makeAdmin(staff.data.user.id)

  const client = await admin.auth.admin.createUser({
    email: clientEmail,
    password,
    email_confirm: true,
  })
  if (client.error) throw client.error
})

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

test('redirects a client away from the price book', async ({ page }) => {
  await loginAsClient(page)

  await page.goto('/admin/price-book')
  await expect(page).toHaveURL(/\/portal/)
  await expect(page.getByRole('heading', { name: 'Tarifario' })).toBeHidden()
})

test('creates a group, adds a concept and edits its price inline', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto('/admin/price-book')

  const groupName = `Grupo E2E ${runId}`
  const itemName = `Concepto E2E ${runId}`
  const itemCode = `E2E-${runId}`

  await page.getByLabel('Nuevo grupo').fill(groupName)
  await page.getByRole('button', { name: 'Crear grupo' }).click()

  // The section is a named region only once React has mounted it with its
  // heading, which is exactly what makes it addressable without a CSS class.
  const region = page.getByRole('region', { name: groupName })
  await expect(region).toBeVisible()

  await region.getByRole('button', { name: `Añadir concepto a ${groupName}` }).click()
  await region.getByLabel('Código', { exact: true }).fill(itemCode)
  await region.getByLabel('Concepto', { exact: true }).fill(itemName)
  await region.getByLabel('Coste', { exact: true }).fill('10,00')
  await region.getByLabel('Precio', { exact: true }).fill('20,00')
  await region.getByRole('button', { name: 'Añadir', exact: true }).click()

  await expect(region.getByRole('button', { name: `Editar ${itemName}` })).toBeVisible()

  // A successful add reopens the form blank, ready for the next concept --
  // closing it again leaves exactly one set of Código/Concepto/Coste/Precio
  // fields in this region, which is what lets the edit row below be found
  // by accessible name alone instead of by DOM position.
  await region.getByRole('button', { name: `Añadir concepto a ${groupName}` }).click()

  await region.getByRole('button', { name: `Editar ${itemName}` }).click()
  // A dot, not a comma: both spellings must save as the same two-decimal
  // amount.
  await region.getByLabel('Precio', { exact: true }).fill('22.5')
  await region.getByRole('button', { name: 'Guardar' }).click()

  await expect(region.getByRole('button', { name: `Editar ${itemName}` })).toBeVisible()
  await expect(region.getByRole('cell', { name: '22,50', exact: true })).toBeVisible()
})

test('reports a duplicate code in Spanish instead of crashing', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto('/admin/price-book')

  const groupName = `Grupo Duplicado ${runId}`
  const code = `DUP-${runId}`
  const firstName = `Primero ${runId}`
  const secondName = `Segundo ${runId}`

  await page.getByLabel('Nuevo grupo').fill(groupName)
  await page.getByRole('button', { name: 'Crear grupo' }).click()

  const region = page.getByRole('region', { name: groupName })
  await region.getByRole('button', { name: `Añadir concepto a ${groupName}` }).click()
  await region.getByLabel('Código', { exact: true }).fill(code)
  await region.getByLabel('Concepto', { exact: true }).fill(firstName)
  await region.getByLabel('Coste', { exact: true }).fill('5,00')
  await region.getByLabel('Precio', { exact: true }).fill('9,00')
  await region.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(region.getByRole('button', { name: `Editar ${firstName}` })).toBeVisible()

  // The add row is blank again, ready for the second (colliding) concept.
  await region.getByLabel('Código', { exact: true }).fill(code)
  await region.getByLabel('Concepto', { exact: true }).fill(secondName)
  await region.getByLabel('Coste', { exact: true }).fill('6,00')
  await region.getByLabel('Precio', { exact: true }).fill('11,00')
  await region.getByRole('button', { name: 'Añadir', exact: true }).click()

  // Filtered by its text on purpose: Next.js injects its own route
  // announcer with role="alert" once a navigation happens, so a bare
  // getByRole('alert') would pass even when this screen showed nothing.
  const alert = region.getByRole('alert').filter({ hasText: 'Ya existe un concepto con ese código.' })
  await expect(alert).toBeVisible()

  // The screen kept working: the first concept is still there, and the
  // rejected second one was never created.
  await expect(region.getByRole('button', { name: `Editar ${firstName}` })).toBeVisible()
  await expect(region.getByRole('button', { name: `Editar ${secondName}` })).toHaveCount(0)

  const { data, error } = await adminDb().from('price_book_items').select('id').eq('code', code)
  if (error) throw error
  expect(data).toHaveLength(1)
})

test('retires and reactivates a concept', async ({ page }) => {
  // Seeded here rather than read out of supabase/seed.sql. This test used to
  // drive the seed's own 'Invernaje' row, which made it depend on a database
  // that had been reset and not since been swept by `npm run test:db` -- and
  // the integration suite's resetDatabase() deletes every price_book row,
  // seed included. That put an `npx supabase db reset` in the middle of the
  // test chain as an unwritten prerequisite. Its own fixture, stamped with
  // runId like every other test in this file, removes the ordering
  // requirement rather than documenting it.
  const admin = adminDb()
  const groupName = `Grupo Retirada ${runId}`
  const itemName = `Concepto Retirada ${runId}`

  const { data: group, error: groupError } = await admin
    .from('price_book_groups')
    .insert({ name: groupName })
    .select('id')
    .single()
  if (groupError) throw groupError

  const { error: itemError } = await admin.from('price_book_items').insert({
    group_id: group!.id,
    code: `RET-${runId}`,
    name: itemName,
    unit: 'lot',
    unit_cost: 110,
    unit_price: 195,
    is_active: true,
  })
  if (itemError) throw itemError

  await loginAsStaff(page)
  await page.goto('/admin/price-book')

  const region = page.getByRole('region', { name: groupName })
  // A live filter, not a snapshot: it is re-evaluated on every assertion
  // below, so it keeps matching the same row across the Sí/No flip that
  // Retirar/Reactivar causes.
  const row = region.locator('tr').filter({ hasText: itemName })

  await expect(row.getByText('Sí', { exact: true })).toBeVisible()
  await row.getByRole('button', { name: `Retirar ${itemName}` }).click()

  await expect(row.getByRole('button', { name: `Reactivar ${itemName}` })).toBeVisible()
  await expect(row.getByText('No', { exact: true })).toBeVisible()

  await row.getByRole('button', { name: `Reactivar ${itemName}` }).click()

  await expect(row.getByRole('button', { name: `Retirar ${itemName}` })).toBeVisible()
  await expect(row.getByText('Sí', { exact: true })).toBeVisible()
})

test('refuses the import screen and its writes to a non-admin', async ({ page }) => {
  const admin = adminDb()
  const groupName = `Grupo Prohibido ${runId}`
  const itemName = `Concepto Prohibido ${runId}`

  await loginAsClient(page)

  await page.goto('/admin/price-book/import')
  await expect(page).toHaveURL(/\/portal/)
  await expect(page.getByLabel(csvLabel)).toHaveCount(0)

  // The redirect above only proves the screen does not render. What has to
  // refuse is the layer underneath: previewImport and commitImport are POST
  // endpoints reachable without ever loading that page, requireAdmin is
  // defence in depth rather than the boundary, and the boundary is RLS on
  // the caller's own session. So the two writes commitImport makes are
  // issued directly, on the very session this browser is signed in with.
  //
  // Posting to the Server Functions themselves would mean hand-building
  // Next's internal Action-RPC request, which breaks on a framework upgrade
  // and pins nothing about this system; the database refusal is the part
  // that has to hold either way.
  const clientDb = anonDb()
  const signIn = await clientDb.auth.signInWithPassword({ email: clientEmail, password })
  if (signIn.error) throw signIn.error

  const groupWrite = await clientDb.from('price_book_groups').insert({ name: groupName })
  expect(groupWrite.error?.code).toBe('42501')

  const itemWrite = await clientDb.from('price_book_items').insert({
    code: `PROH-${runId}`,
    name: itemName,
    unit: 'hour',
    unit_cost: 1,
    unit_price: 2,
    is_active: true,
  })
  expect(itemWrite.error?.code).toBe('42501')

  // Read back with the service role, which RLS does not bind: an error on
  // the client's side would mean nothing if a row had landed anyway.
  const { data: groups, error: groupsError } = await admin
    .from('price_book_groups')
    .select('id')
    .eq('name', groupName)
  if (groupsError) throw groupsError
  expect(groups).toHaveLength(0)

  const { data: items, error: itemsError } = await admin
    .from('price_book_items')
    .select('id')
    .eq('name', itemName)
  if (itemsError) throw itemsError
  expect(items).toHaveLength(0)
})

test('imports a CSV that creates its own group and price', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto('/admin/price-book/import')

  const groupName = `Grupo Importado ${runId}`
  const itemName = `Concepto Importado ${runId}`
  const csv = `concepto;unidad;coste;precio;grupo\n${itemName};hora;12,00;18,00;${groupName}`

  await page.getByLabel(csvLabel).fill(csv)
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click()

  await expect(page.getByRole('cell', { name: itemName, exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Importar 1 conceptos', exact: true }).click()
  await expect(
    page.getByText(
      'Importación completada: 1 grupos nuevos, 1 conceptos nuevos sin código, 0 conceptos con código creados o actualizados.',
    ),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Ver el tarifario' }).click()
  await expect(page).toHaveURL(/\/admin\/price-book$/)

  const region = page.getByRole('region', { name: groupName })
  await expect(region.getByRole('cell', { name: '18,00', exact: true })).toBeVisible()
})

test('reports a bad price by line number and hides the import button', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto('/admin/price-book/import')

  const csv = `concepto;unidad;coste;precio\nItem malo ${runId};hora;abc;30,00`
  await page.getByLabel(csvLabel).fill(csv)
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click()

  const alert = page.getByRole('alert').filter({ hasText: 'Línea 2:' })
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('El coste no es un número válido.')

  await expect(page.getByRole('button', { name: /^Importar \d+ conceptos$/ })).toHaveCount(0)
})

test('re-importing the same file keeps the coded row, duplicates the codeless one and reuses the group', async ({
  page,
}) => {
  const admin = adminDb()

  // A coded item that is retired and already carries a description --
  // exactly the state the last review round's fix protects, and the state
  // one hand test currently is the only thing proving it.
  const code = `IMP-A-${runId}`
  const description = `Descripción original ${runId}`
  const { data: seeded, error: seedError } = await admin
    .from('price_book_items')
    .insert({
      code,
      name: `Nombre original ${runId}`,
      description,
      unit: 'hour',
      unit_cost: 1,
      unit_price: 2,
      is_active: false,
    })
    .select('id')
    .single()
  if (seedError) throw seedError
  const seededId = seeded!.id

  const groupName = `Grupo Reimportado ${runId}`
  const codelessName = `Codeless A ${runId}`
  // No descripcion column, on purpose: the coded row's own description must
  // survive untouched, since the file cannot express clearing it.
  const csv =
    'concepto;unidad;coste;precio;grupo;codigo\n' +
    `Nombre actualizado ${runId};hora;20,00;30,00;${groupName};${code}\n` +
    `${codelessName};hora;5,00;8,00;${groupName};`

  await loginAsStaff(page)
  await page.goto('/admin/price-book/import')
  const textarea = page.getByLabel(csvLabel)

  await textarea.fill(csv)
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click()
  await page.getByRole('button', { name: 'Importar 2 conceptos', exact: true }).click()
  await expect(page.getByText(/Importación completada/)).toBeVisible()

  const { data: afterFirst, error: firstError } = await admin
    .from('price_book_items')
    .select('id, is_active, description, unit_cost, unit_price')
    .eq('code', code)
    .single()
  if (firstError) throw firstError
  expect(afterFirst!.id).toBe(seededId)
  expect(afterFirst!.is_active).toBe(false)
  expect(afterFirst!.description).toBe(description)
  expect(afterFirst!.unit_cost).toBe(20)
  expect(afterFirst!.unit_price).toBe(30)

  const { data: groupsAfterFirst, error: groupsFirstError } = await admin
    .from('price_book_groups')
    .select('id')
    .eq('name', groupName)
  if (groupsFirstError) throw groupsFirstError
  expect(groupsAfterFirst).toHaveLength(1)
  const groupId = groupsAfterFirst![0]!.id

  const { data: codelessAfterFirst, error: codelessFirstError } = await admin
    .from('price_book_items')
    .select('id')
    .eq('name', codelessName)
  if (codelessFirstError) throw codelessFirstError
  expect(codelessAfterFirst).toHaveLength(1)

  // Re-run the exact same file.
  await page.goto('/admin/price-book/import')
  await textarea.fill(csv)
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click()
  await page.getByRole('button', { name: 'Importar 2 conceptos', exact: true }).click()
  await expect(page.getByText(/Importación completada/)).toBeVisible()

  const { data: afterSecond, error: secondError } = await admin
    .from('price_book_items')
    .select('id')
    .eq('code', code)
  if (secondError) throw secondError
  expect(afterSecond).toHaveLength(1)
  expect(afterSecond![0]!.id).toBe(seededId)

  const { data: codelessAfterSecond, error: codelessSecondError } = await admin
    .from('price_book_items')
    .select('id')
    .eq('name', codelessName)
  if (codelessSecondError) throw codelessSecondError
  expect(codelessAfterSecond).toHaveLength(2)

  const { data: groupsAfterSecond, error: groupsSecondError } = await admin
    .from('price_book_groups')
    .select('id')
    .eq('name', groupName)
  if (groupsSecondError) throw groupsSecondError
  expect(groupsAfterSecond).toHaveLength(1)
  expect(groupsAfterSecond![0]!.id).toBe(groupId)
})

test('commits what the preview showed, not what the textarea holds when Importar is pressed', async ({
  page,
}) => {
  await loginAsStaff(page)
  await page.goto('/admin/price-book/import')

  const previewedName = `Concepto Previsto ${runId}`
  const editedName = `Concepto Alterado ${runId}`
  const previewedCsv = `concepto;unidad;coste;precio\n${previewedName};hora;10,00;20,00`
  const editedCsv = `concepto;unidad;coste;precio\n${editedName};hora;99,00;99,00`

  const textarea = page.getByLabel(csvLabel)
  await textarea.fill(previewedCsv)
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click()
  await expect(page.getByRole('cell', { name: previewedName, exact: true })).toBeVisible()

  // Edited after Comprobar already ran. The commit form's hidden `text`
  // field carries the snapshot the preview parsed, not this textarea's
  // current DOM value, so this edit must have no effect on what gets
  // written.
  await textarea.fill(editedCsv)

  await page.getByRole('button', { name: 'Importar 1 conceptos', exact: true }).click()
  await expect(page.getByText(/Importación completada/)).toBeVisible()

  const admin = adminDb()
  const { data: previewed, error: previewedError } = await admin
    .from('price_book_items')
    .select('unit_price')
    .eq('name', previewedName)
  if (previewedError) throw previewedError
  expect(previewed).toHaveLength(1)
  expect(previewed![0]!.unit_price).toBe(20)

  const { data: edited, error: editedError } = await admin
    .from('price_book_items')
    .select('id')
    .eq('name', editedName)
  if (editedError) throw editedError
  expect(edited).toHaveLength(0)
})

test('pages through a catalogue too big for one screen', async ({ page }) => {
  // The one screen-level proof that a catalogue past PostgREST's max_rows
  // (1000, supabase/config.toml) is reachable rather than silently cut off:
  // the screen asks for a page at a time and the pager walks the rest.
  //
  // Seeded and torn down inside this test. 1001 extra concepts push every
  // other row this file creates off the first page, so leaving them behind
  // would break the tests around it. That is safe here because tests in one
  // file run serially (fullyParallel: false in playwright.config.ts) and
  // auth.spec.ts -- the only file that can run alongside this one -- never
  // opens this screen.
  const admin = adminDb()
  const marker = `Relleno ${runId}`
  const bulk = Array.from({ length: 1001 }, (_, index) => ({
    code: `FILL-${runId}-${String(index).padStart(4, '0')}`,
    name: `${marker} ${index}`,
    unit: 'unit' as const,
    unit_cost: 1,
    unit_price: 2,
    is_active: true,
  }))

  const { error: seedError } = await admin.from('price_book_items').insert(bulk)
  if (seedError) throw seedError

  try {
    await loginAsStaff(page)
    await page.goto('/admin/price-book')

    const pager = page.getByRole('navigation', { name: 'Páginas del tarifario' })
    await expect(pager.getByText(/Mostrando 50 de \d+ conceptos/)).toBeVisible()
    await expect(pager.getByText('1 /')).toBeVisible()

    const firstCode = `FILL-${runId}-0000`
    await expect(page.getByRole('cell', { name: firstCode, exact: true })).toBeVisible()

    await pager.getByRole('link', { name: 'Siguiente' }).click()

    // A different page, not the same one re-rendered: page two starts where
    // page one stopped, and the row that opened page one is gone from it.
    await expect(pager.getByText('2 /')).toBeVisible()
    await expect(page.getByRole('cell', { name: firstCode, exact: true })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: `FILL-${runId}-0050`, exact: true })).toBeVisible()
  } finally {
    const { error: cleanupError } = await admin
      .from('price_book_items')
      .delete()
      .like('name', `${marker} %`)
    if (cleanupError) throw cleanupError
  }
})

test('finds a concept by code and keeps the search in the address', async ({ page }) => {
  const groupName = `Grupo Buscado ${runId}`
  const code = `SEA-${runId}`
  const itemName = `Concepto buscado ${runId}`

  await loginAsStaff(page)
  await page.goto('/admin/price-book')

  await page.getByLabel('Nuevo grupo').fill(groupName)
  await page.getByRole('button', { name: 'Crear grupo' }).click()

  const region = page.getByRole('region', { name: groupName })
  await region.getByRole('button', { name: `Añadir concepto a ${groupName}` }).click()
  await region.getByLabel('Código', { exact: true }).fill(code)
  await region.getByLabel('Concepto', { exact: true }).fill(itemName)
  await region.getByLabel('Coste', { exact: true }).fill('7,00')
  await region.getByLabel('Precio', { exact: true }).fill('14,00')
  await region.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(region.getByRole('button', { name: `Editar ${itemName}` })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Buscar en el tarifario' }).fill(code)
  await page.getByRole('searchbox', { name: 'Buscar en el tarifario' }).press('Enter')

  // A GET form, so the search is in the URL and the page is linkable.
  await expect(page).toHaveURL(new RegExp(`[?&]q=${code}`))
  await expect(page.getByRole('cell', { name: code, exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: itemName, exact: true })).toHaveCount(1)

  // Nothing else survived the filter: the seed catalogue is still there, it
  // is simply not on this screen.
  await expect(page.getByRole('region', { name: 'Estructura' })).toHaveCount(0)
})
