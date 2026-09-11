import { expect, test, type Page } from '@playwright/test'
import { adminDb, makeAdmin, uniqueEmail } from '../integration/helpers/db'

const password = 'test-password-123'
const staffEmail = uniqueEmail('staff-e2e')
const clientEmail = uniqueEmail('client-e2e')

test.beforeAll(async () => {
  const admin = adminDb()

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

/** The host the tests are pointed at, so an off-site redirect is visible. */
function siteHost(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('playwright baseURL is not configured')
  return new URL(baseURL).host
}

async function submitLogin(page: Page, email: string, secret: string) {
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(secret)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('redirects an anonymous visitor away from the dashboard', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})

test('rejects a wrong password with a visible message', async ({ page }) => {
  await page.goto('/login')
  await submitLogin(page, staffEmail, 'wrong-password')
  // Filtered by its text on purpose: Next.js injects its own route announcer
  // with role="alert" (#__next-route-announcer__) once a navigation happens,
  // so a bare getByRole('alert') passes even when the form shows nothing.
  const alert = page
    .getByRole('alert')
    .filter({ hasText: 'Correo o contraseña incorrectos.' })
  await expect(alert).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('signs an admin in and lands on the dashboard', async ({ page }) => {
  await page.goto('/login')
  await submitLogin(page, staffEmail, password)
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible()
})

test('sends a client to the portal, not the dashboard', async ({ page }) => {
  await page.goto('/login')
  await submitLogin(page, clientEmail, password)
  await expect(page).toHaveURL(/\/portal/)
  await expect(page.getByRole('heading', { name: 'Mi área' })).toBeVisible()
})

test('blocks a client from the dashboard', async ({ page }) => {
  await page.goto('/login')
  await submitLogin(page, clientEmail, password)
  await expect(page).toHaveURL(/\/portal/)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/portal/)
  await expect(page.getByRole('heading', { name: 'Panel' })).toBeHidden()
})

test('returns an admin to the page they were sent away from', async ({ page }) => {
  // /portal, not /admin: the admin's default landing page is /admin, so only
  // a different destination proves the `next` parameter was honoured at all.
  await page.goto('/portal')
  await expect(page).toHaveURL('/login?next=%2Fportal')

  await submitLogin(page, staffEmail, password)
  await expect(page).toHaveURL(/\/portal/)
})

test('refuses a dashboard destination for a client', async ({ page }) => {
  await page.goto('/login?next=%2Fadmin')
  await submitLogin(page, clientEmail, password)

  await expect(page).toHaveURL(/\/portal/)
  await expect(page.getByRole('heading', { name: 'Mi área' })).toBeVisible()
})

// Spellings that are not literally "/admin" but land a browser on /admin all
// the same. The refusal exists to stop the URL bar naming a page the visitor
// is not being shown, so it has to survive being spelled around.
const dashboardSpellings = ['/./admin', '/admin/', '/portal/../admin']

test('refuses a dashboard destination spelled around for a client', async ({
  page,
}) => {
  for (const next of dashboardSpellings) {
    await page.context().clearCookies()
    await page.goto(`/login?next=${encodeURIComponent(next)}`)
    await submitLogin(page, clientEmail, password)

    // An exact URL, not /portal/: the whole point is what the address bar
    // says, and under the bug it said /admin while showing this same page.
    await expect(page, `next=${next} was honoured`).toHaveURL('/portal')
    await expect(page.getByRole('heading', { name: 'Mi área' })).toBeVisible()
  }
})

test('refuses to land a signed-in user back on the sign-in form', async ({
  page,
}) => {
  // An empty credential form shown *after* a successful sign-in is a link
  // worth handing out: it farms a second password entry from someone who has
  // every reason to think the first one failed.
  await page.goto('/login?next=%2Flogin')
  await submitLogin(page, staffEmail, password)

  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible()
})

test('carries the query string of the page the visitor was sent away from', async ({
  page,
}) => {
  await page.goto('/portal?tab=items')
  await expect(page).toHaveURL('/login?next=%2Fportal%3Ftab%3Ditems')

  await submitLogin(page, clientEmail, password)
  await expect(page).toHaveURL('/portal?tab=items')
})

const hostile = [
  'https://evil.example/',
  '//evil.example/',
  '/\\evil.example/',
  'evil.example',
]

/** The value of the form's hidden `next` field, or null when there is none. */
async function hiddenNext(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const field = document.querySelector<HTMLInputElement>(
      'form input[name="next"]',
    )
    return field ? field.value : null
  })
}

test('keeps an off-site next out of the form it renders', async ({ page }) => {
  // The action refuses these a moment later either way, so nothing here is the
  // last line of defence. It is pinned because it is the difference between a
  // hostile string never entering the DOM and it sitting there waiting for the
  // next person to read the field back for some other purpose.

  // Positive control first: without it, deleting the field entirely would
  // satisfy every assertion in the loop.
  await page.goto('/login?next=%2Fportal')
  expect(await hiddenNext(page)).toBe('/portal')

  for (const next of hostile) {
    await page.goto(`/login?next=${encodeURIComponent(next)}`)
    expect(await hiddenNext(page), `next=${next} reached the DOM`).toBeNull()
  }
})

test('ignores an off-site next parameter in the URL', async ({ page, baseURL }) => {
  for (const next of hostile) {
    await page.context().clearCookies()
    await page.goto(`/login?next=${encodeURIComponent(next)}`)
    await submitLogin(page, staffEmail, password)

    await expect(page).toHaveURL(/\/admin/)
    expect(new URL(page.url()).host, `next=${next} escaped the site`).toBe(
      siteHost(baseURL),
    )
  }
})

test('ignores an off-site next smuggled into the form', async ({
  page,
  baseURL,
}) => {
  // The action is the security boundary, not the page: it is a POST endpoint
  // anyone can call with any body, so it cannot trust the hidden field the
  // page rendered. Appending the field by hand sends a body the page would
  // never produce, which is what an attacker would do.
  for (const next of hostile) {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.evaluate((value) => {
      const form = document.querySelector('form')
      if (!form) throw new Error('no sign-in form to tamper with')
      const field = document.createElement('input')
      field.type = 'hidden'
      field.name = 'next'
      field.value = value
      form.append(field)
    }, next)
    await submitLogin(page, staffEmail, password)

    await expect(page).toHaveURL(/\/admin/)
    expect(new URL(page.url()).host, `next=${next} escaped the site`).toBe(
      siteHost(baseURL),
    )
  }
})

test('signs out and locks the dashboard again', async ({ page }) => {
  await page.goto('/login')
  await submitLogin(page, staffEmail, password)
  await expect(page).toHaveURL(/\/admin/)

  // Signing out lives in the account menu at the foot of the sidebar now.
  await page.getByRole('button', { name: /^Cuenta de/ }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})
