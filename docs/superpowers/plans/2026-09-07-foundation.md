# Piscinas Reus — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable Next.js application with working authentication and a
fully audited PostgreSQL schema whose Row Level Security is proven by tests.

**Architecture:** One Next.js 15 App Router application backed by Supabase.
Every authorization rule lives in PostgreSQL policies, not in React. The
database is developed locally in Docker with versioned SQL migrations, so the
same schema can be replayed onto the hosted project.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS v4, Supabase
(PostgreSQL 17), `@supabase/ssr`, Zod, Vitest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-07-piscinas-reus-design.md`

## Global Constraints

- All code, identifiers, database objects, comments and commit messages are in
  **English**. Only user-facing content is Spanish or Catalan.
- Commit messages: `type: subject`, one line. **Never** add a `Co-Authored-By`
  trailer.
- Money is `numeric(12,2)`. Quantities are `numeric(12,3)`.
- Every table has RLS enabled. There is no permissive fallback policy.
- `unit_cost`, `internal_notes`, `clients.notes` and the entire price book are
  never readable by a `client` role.
- A quote with `status <> 'draft'` is invisible to its client if it is
  `'draft'`, and immutable except for the `client_selected` flag.
- Environment variable names are fixed: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SITE_URL`.
- Node 22. Package manager: npm.

---

### Task 1: Project scaffold and test toolchain

Creates the Next.js application in the existing repository root and proves the
test runner works before any real code exists.

**Files:**
- Create: `package.json` (overwrite), `tsconfig.json`, `next.config.ts`,
  `postcss.config.mjs`, `vitest.config.ts`, `src/app/layout.tsx`,
  `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `roundMoney(value: number): number` — rounds to 2 decimals using
  half-up, the rounding every later total calculation depends on.

- [ ] **Step 1: Scaffold the application**

The repository root already contains `.git`, `.gitignore`, `docs/` and skill
directories. `create-next-app` refuses a non-empty directory, so scaffold into
a temporary directory and move the result in.

```bash
npx create-next-app@latest /tmp/prscaffold \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --no-turbopack --yes
cp -r /tmp/prscaffold/. .
rm -rf /tmp/prscaffold node_modules package-lock.json
npm install
```

- [ ] **Step 2: Install test and validation dependencies**

```bash
npm install zod @supabase/ssr @supabase/supabase-js
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths \
  @testing-library/react @testing-library/jest-dom jsdom dotenv
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/integration/**', 'node_modules/**'],
  },
})
```

Add scripts to `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Enable TypeScript strict mode**

In `tsconfig.json`, ensure `compilerOptions` contains:

```json
"strict": true,
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true
```

- [ ] **Step 5: Write the failing test**

Create `src/lib/money.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { roundMoney } from './money'

describe('roundMoney', () => {
  it('rounds to two decimals', () => {
    expect(roundMoney(10.234)).toBe(10.23)
    expect(roundMoney(10.235)).toBe(10.24)
  })

  it('rounds half away from zero, not to even', () => {
    expect(roundMoney(0.125)).toBe(0.13)
    expect(roundMoney(0.135)).toBe(0.14)
  })

  it('survives binary floating point representation', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(8.615)).toBe(8.62)
  })

  it('handles negatives symmetrically', () => {
    expect(roundMoney(-10.235)).toBe(-10.24)
  })

  it('returns zero unchanged', () => {
    expect(roundMoney(0)).toBe(0)
  })
})
```

- [ ] **Step 6: Run the test and watch it fail**

Run: `npm test -- money`
Expected: FAIL — `Failed to resolve import "./money"`.

- [ ] **Step 7: Implement**

Create `src/lib/money.ts`:

```typescript
/**
 * Rounds a monetary amount to two decimals, half away from zero.
 *
 * `Math.round` is not enough on its own: 1.005 is stored as 1.00499...,
 * so it would round down and lose a cent. Shifting through the exponent
 * notation avoids that representation error.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`roundMoney expects a finite number, received ${value}`)
  }
  const sign = value < 0 ? -1 : 1
  const shifted = Number(`${Math.abs(value)}e2`)
  return (sign * Number(`${Math.round(shifted)}e-2`)) || 0
}
```

- [ ] **Step 8: Run the test and watch it pass**

Run: `npm test -- money`
Expected: PASS, 5 tests.

- [ ] **Step 9: Verify the application builds**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js app with vitest"
```

---

### Task 2: Environment variable validation

An application that boots with a missing key and fails three screens later
wastes an afternoon. Validate once, at import time, with a readable message.

**Files:**
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Consumes: `roundMoney` — no.
- Produces: `getPublicEnv(): { supabaseUrl: string; supabasePublishableKey: string; siteUrl: string }`
  and `getServerEnv(): { serviceRoleKey: string }`. Every Supabase client
  factory in Task 3 reads its configuration from these two functions.

- [ ] **Step 1: Write the failing test**

Create `src/lib/env.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('getPublicEnv', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns the parsed public configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xyz')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')

    const { getPublicEnv } = await import('./env')
    expect(getPublicEnv()).toEqual({
      supabaseUrl: 'https://demo.supabase.co',
      supabasePublishableKey: 'sb_publishable_xyz',
      siteUrl: 'http://localhost:3000',
    })
  })

  it('names the missing variable in the error message', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xyz')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')

    const { getPublicEnv } = await import('./env')
    expect(() => getPublicEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('rejects a url that is not a url', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xyz')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')

    const { getPublicEnv } = await import('./env')
    expect(() => getPublicEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})

describe('getServerEnv', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns the service role key', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    const { getServerEnv } = await import('./env')
    expect(getServerEnv().serviceRoleKey).toBe('service-key')
  })

  it('fails loudly when the service role key is absent', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { getServerEnv } = await import('./env')
    expect(() => getServerEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/)
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -- env`
Expected: FAIL — cannot resolve `./env`.

- [ ] **Step 3: Implement**

Create `src/lib/env.ts`:

```typescript
import { z } from 'zod'

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when it is
 * referenced as a literal member expression. Destructuring or dynamic access
 * yields undefined in the browser bundle, so each variable is spelled out.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

function format(error: z.ZodError): never {
  const detail = error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${detail}`)
}

export function getPublicEnv() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  })
  if (!parsed.success) format(parsed.error)
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    siteUrl: parsed.data.NEXT_PUBLIC_SITE_URL,
  }
}

export function getServerEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
  if (!parsed.success) format(parsed.error)
  return { serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY }
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm test -- env`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: validate environment variables at startup"
```

---

### Task 3: Supabase client factories

Three different execution contexts need three different clients. Getting this
wrong is the most common source of "the user is logged in but the server
thinks they are not".

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`,
  `src/lib/supabase/admin.ts`
- Test: `src/lib/supabase/admin.test.ts`

**Interfaces:**
- Consumes: `getPublicEnv()`, `getServerEnv()` from Task 2.
- Produces:
  - `createBrowserSupabaseClient()` — for Client Components.
  - `createServerSupabaseClient()` — async, for Server Components, Route
    Handlers and Server Actions. Reads and writes the session cookie.
  - `createAdminSupabaseClient()` — service role, bypasses RLS. Task 14 uses
    it to seed test fixtures.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/admin.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('createAdminSupabaseClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xyz')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
  })

  it('builds a client when the service role key is present', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    const { createAdminSupabaseClient } = await import('./admin')
    expect(createAdminSupabaseClient().from('clients')).toBeDefined()
  })

  it('refuses to build without a service role key', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { createAdminSupabaseClient } = await import('./admin')
    expect(() => createAdminSupabaseClient()).toThrowError(
      /SUPABASE_SERVICE_ROLE_KEY/,
    )
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -- admin`
Expected: FAIL — cannot resolve `./admin`.

- [ ] **Step 3: Implement the browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { getPublicEnv } from '@/lib/env'

export function createBrowserSupabaseClient() {
  const env = getPublicEnv()
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey)
}
```

- [ ] **Step 4: Implement the server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicEnv } from '@/lib/env'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const env = getPublicEnv()

  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies. The middleware in Task 12
          // refreshes the session on every request, so ignoring this is safe.
        }
      },
    },
  })
}
```

- [ ] **Step 5: Implement the admin client**

Create `src/lib/supabase/admin.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { getPublicEnv } from '@/lib/env'
import { getServerEnv } from '@/lib/env'

/**
 * Bypasses every Row Level Security policy. Server-side only, and only where
 * acting as no particular user is genuinely required. Never import this from
 * a file that also runs in the browser.
 */
export function createAdminSupabaseClient() {
  const { supabaseUrl } = getPublicEnv()
  const { serviceRoleKey } = getServerEnv()

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `npm test -- admin`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add supabase client factories"
```

---

### Task 4: Local Supabase and the core schema

The first migration. From here on the database is developed locally and
replayed onto the hosted project, never edited by hand in the dashboard.

**Files:**
- Create: `supabase/config.toml` (generated), `supabase/migrations/0001_core_schema.sql`
- Test: `tests/integration/schema.test.ts`, `tests/integration/helpers/db.ts`,
  `vitest.integration.config.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: tables `profiles`, `clients`, `projects`, `quotes`, `quote_items`,
  `price_book_groups`, `price_book_items`, `leads`, and the enums
  `user_role`, `quote_status`, `project_status`, `lead_status`, `unit_type`.
  Every later database task builds on these names.

- [ ] **Step 1: Initialise and start Supabase locally**

```bash
npx supabase init
npx supabase start
```

`supabase start` prints an API URL, a publishable/anon key and a service role
key. These are fixed local development values, identical on every machine, and
are safe to commit in the test configuration.

- [ ] **Step 2: Configure the integration test runner**

Create `vitest.integration.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
```

Add the script to `package.json`:

```json
"test:db": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 3: Write the database test helper**

Create `tests/integration/helpers/db.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Fixed local development credentials printed by `supabase start`. They are
 * identical on every machine and grant access to nothing but the local
 * container, so committing them is intentional.
 */
export const LOCAL_URL = 'http://127.0.0.1:54321'
export const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
export const LOCAL_ANON_KEY =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

/** Service-role client. Bypasses RLS. Use it only to arrange fixtures. */
export function adminDb(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Anonymous client. Exactly what an unauthenticated visitor gets. */
export function anonDb(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Creates a confirmed auth user and returns a client authenticated as them.
 * Confirming immediately mirrors production, where the account-linking
 * trigger only fires once the email is verified.
 */
export async function createUser(
  email: string,
  password = 'test-password-123',
): Promise<{ id: string; db: SupabaseClient }> {
  const admin = adminDb()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const db = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signIn = await db.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error

  return { id: data.user.id, db }
}

/** Promotes a user to the admin role. */
export async function makeAdmin(userId: string): Promise<void> {
  const { error } = await adminDb()
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId)
  if (error) throw error
}

/** Deletes every row created by tests, in foreign-key-safe order. */
export async function resetDatabase(): Promise<void> {
  const admin = adminDb()
  for (const table of [
    'quote_items',
    'quotes',
    'projects',
    'leads',
    'price_book_items',
    'price_book_groups',
    'clients',
  ]) {
    const { error } = await admin
      .from(table)
      .delete()
      .gte('created_at', '1900-01-01')
    if (error && error.code !== 'PGRST116') throw error
  }
  const { data } = await admin.auth.admin.listUsers()
  for (const user of data?.users ?? []) {
    await admin.auth.admin.deleteUser(user.id)
  }
}

/** Unique email per test run, so parallel runs never collide. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/integration/schema.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, resetDatabase, uniqueEmail } from './helpers/db'

describe('core schema', () => {
  beforeAll(resetDatabase)
  afterAll(resetDatabase)

  it('stores a client and returns it', async () => {
    const email = uniqueEmail('ana')
    const { data, error } = await adminDb()
      .from('clients')
      .insert({ email, full_name: 'Ana Ruiz', city: 'Reus' })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data?.full_name).toBe('Ana Ruiz')
    expect(data?.user_id).toBeNull()
  })

  it('treats client email as case insensitive and unique', async () => {
    const db = adminDb()
    const email = uniqueEmail('Carlos')
    await db.from('clients').insert({ email, full_name: 'Carlos' })

    const { error } = await db
      .from('clients')
      .insert({ email: email.toUpperCase(), full_name: 'Carlos again' })

    expect(error?.code).toBe('23505')
  })

  it('rejects a quote whose status is not in the enum', async () => {
    const db = adminDb()
    const { data: client } = await db
      .from('clients')
      .insert({ email: uniqueEmail('eva'), full_name: 'Eva' })
      .select()
      .single()

    const { error } = await db.from('quotes').insert({
      client_id: client!.id,
      reference: 'Q-2026-9001',
      title: 'Piscina 8x4',
      status: 'pendiente',
      access_token: 'token-enum-check',
    })

    expect(error).not.toBeNull()
  })

  it('allows a quote with no project, and links one later', async () => {
    const db = adminDb()
    const { data: client } = await db
      .from('clients')
      .insert({ email: uniqueEmail('luis'), full_name: 'Luis' })
      .select()
      .single()

    const { data: quote, error } = await db
      .from('quotes')
      .insert({
        client_id: client!.id,
        reference: 'Q-2026-9002',
        title: 'Mantenimiento anual',
        access_token: 'token-nullable-project',
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(quote?.project_id).toBeNull()
    expect(quote?.status).toBe('draft')
  })

  it('deletes quote items when their quote is deleted', async () => {
    const db = adminDb()
    const { data: client } = await db
      .from('clients')
      .insert({ email: uniqueEmail('mar'), full_name: 'Mar' })
      .select()
      .single()
    const { data: quote } = await db
      .from('quotes')
      .insert({
        client_id: client!.id,
        reference: 'Q-2026-9003',
        title: 'Reforma',
        access_token: 'token-cascade',
      })
      .select()
      .single()
    await db.from('quote_items').insert({
      quote_id: quote!.id,
      name: 'Gresite',
      unit: 'm2',
      quantity: 40,
      unit_price: 32.5,
      position: 1,
    })

    await db.from('quotes').delete().eq('id', quote!.id)

    const { data: orphans } = await db
      .from('quote_items')
      .select()
      .eq('quote_id', quote!.id)
    expect(orphans).toEqual([])
  })

  it('refuses a discount outside 0 to 100', async () => {
    const db = adminDb()
    const { data: client } = await db
      .from('clients')
      .insert({ email: uniqueEmail('nuria'), full_name: 'Nuria' })
      .select()
      .single()
    const { data: quote } = await db
      .from('quotes')
      .insert({
        client_id: client!.id,
        reference: 'Q-2026-9004',
        title: 'Depuradora',
        access_token: 'token-discount',
      })
      .select()
      .single()

    const { error } = await db.from('quote_items').insert({
      quote_id: quote!.id,
      name: 'Bomba',
      unit: 'unit',
      quantity: 1,
      unit_price: 400,
      discount_pct: 150,
      position: 1,
    })

    expect(error?.code).toBe('23514')
  })
})
```

- [ ] **Step 5: Run the test and watch it fail**

Run: `npm run test:db -- schema`
Expected: FAIL — the `clients` relation does not exist.

- [ ] **Step 6: Write the migration**

Create `supabase/migrations/0001_core_schema.sql`:

```sql
create extension if not exists citext;

create type user_role     as enum ('admin', 'client');
create type quote_status  as enum ('draft', 'sent', 'accepted', 'rejected');
create type project_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type lead_status   as enum ('new', 'contacted', 'quoted', 'discarded');
create type unit_type     as enum ('m2', 'ml', 'unit', 'hour', 'kg', 'lot');

-- One row per authenticated user. Populated by a trigger in migration 0006.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       user_role   not null default 'client',
  full_name  text,
  phone      text,
  created_at timestamptz not null default now()
);

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,
  email       citext not null unique,
  full_name   text   not null,
  phone       text,
  address     text,
  city        text,
  postal_code text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete restrict,
  reference          text not null unique,
  name               text not null,
  status             project_status not null default 'pending',
  start_date_planned date,
  end_date_actual    date,
  address            text,
  notes              text,
  created_at         timestamptz not null default now()
);

create table public.quotes (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,
  client_id          uuid not null references public.clients (id) on delete restrict,
  project_id         uuid references public.projects (id) on delete set null,
  title              text not null,
  status             quote_status not null default 'draft',
  start_date_planned date,
  valid_until        date,
  client_notes       text,
  internal_notes     text,
  access_token       text not null unique,
  sent_at            timestamptz,
  responded_at       timestamptz,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.price_book_groups (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  position integer not null default 0
);

create table public.price_book_items (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references public.price_book_groups (id) on delete set null,
  code        text unique,
  name        text not null,
  description text,
  unit        unit_type not null default 'unit',
  unit_cost   numeric(12,2) not null default 0,
  unit_price  numeric(12,2) not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Descriptive and monetary fields are snapshots, not references. Editing the
-- price book must never rewrite a quote that has already been sent.
create table public.quote_items (
  id                 uuid primary key default gen_random_uuid(),
  quote_id           uuid not null references public.quotes (id) on delete cascade,
  price_book_item_id uuid references public.price_book_items (id) on delete set null,
  group_name         text,
  name               text not null,
  description        text,
  unit               unit_type not null default 'unit',
  quantity           numeric(12,3) not null default 1 check (quantity >= 0),
  unit_cost          numeric(12,2) not null default 0,
  unit_price         numeric(12,2) not null default 0,
  discount_pct       numeric(5,2)  not null default 0
                       check (discount_pct >= 0 and discount_pct <= 100),
  tax_rate           numeric(5,2)  not null default 0
                       check (tax_rate >= 0 and tax_rate <= 100),
  is_recommended     boolean not null default false,
  client_selected    boolean not null default false,
  position           integer not null default 0,
  created_at         timestamptz not null default now()
);

create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        citext not null,
  phone        text,
  message      text,
  service_type text,
  source       text not null default 'landing',
  status       lead_status not null default 'new',
  client_id    uuid references public.clients (id) on delete set null,
  locale       text not null default 'es',
  created_at   timestamptz not null default now()
);

create index clients_user_id_idx        on public.clients (user_id);
create index projects_client_id_idx     on public.projects (client_id);
create index quotes_client_id_idx       on public.quotes (client_id);
create index quotes_status_idx          on public.quotes (status);
create index quotes_access_token_idx    on public.quotes (access_token);
create index quote_items_quote_id_idx   on public.quote_items (quote_id, position);
create index price_book_items_group_idx on public.price_book_items (group_id);
create index leads_status_idx           on public.leads (status, created_at desc);

-- Keeps updated_at honest without the application having to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();
```

- [ ] **Step 7: Apply the migration**

```bash
npx supabase migration up
```

- [ ] **Step 8: Run the test and watch it pass**

Run: `npm run test:db -- schema`
Expected: PASS, 6 tests.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add core database schema"
```

---

### Task 5: Authorization helper functions

Two functions that every policy in Task 6 calls. They must be `security
definer`: a policy on `profiles` that queries `profiles` through a plain
function would recurse until PostgreSQL gives up.

**Files:**
- Create: `supabase/migrations/0002_auth_helpers.sql`
- Test: `tests/integration/auth-helpers.test.ts`

**Interfaces:**
- Consumes: `profiles`, `clients` from Task 4.
- Produces: `public.is_admin() returns boolean` and
  `public.current_client_id() returns uuid`, both callable from RLS policies
  and from PostgREST via `rpc`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/auth-helpers.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'

describe('authorization helpers', () => {
  beforeAll(resetDatabase)
  afterAll(resetDatabase)

  it('reports false for a plain user', async () => {
    const { db } = await createUser(uniqueEmail('plain'))
    const { data } = await db.rpc('is_admin')
    expect(data).toBe(false)
  })

  it('reports true once the profile role is admin', async () => {
    const { id, db } = await createUser(uniqueEmail('boss'))
    await makeAdmin(id)
    const { data } = await db.rpc('is_admin')
    expect(data).toBe(true)
  })

  it('reports false for an anonymous caller', async () => {
    const { data } = await anonDb().rpc('is_admin')
    expect(data).toBe(false)
  })

  it('resolves null for a caller with no client row', async () => {
    const { data } = await anonDb().rpc('current_client_id')
    expect(data).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:db -- auth-helpers`
Expected: FAIL — function `is_admin` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0002_auth_helpers.sql`:

```sql
-- security definer is mandatory here. A policy on profiles that queried
-- profiles through an invoker-rights function would trigger the policy again
-- and recurse. Running as the owner reads the table without policy checks.
--
-- search_path is pinned so a caller cannot shadow `profiles` with a table of
-- their own and lie about being an admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
  from public.clients
  where user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.current_client_id() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_client_id() to anon, authenticated;
```

- [ ] **Step 4: Apply and run the test**

```bash
npx supabase migration up
npm run test:db -- auth-helpers
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add authorization helper functions"
```

---

### Task 6: Row Level Security policies

The security boundary of the whole product. Every table gets RLS enabled and
explicit policies; nothing is left open.

**Files:**
- Create: `supabase/migrations/0003_rls_policies.sql`
- Test: `tests/integration/rls.test.ts`

**Interfaces:**
- Consumes: `is_admin()`, `current_client_id()` from Task 5.
- Produces: enforced access rules. No new callable names.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/rls.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminDb,
  anonDb,
  createUser,
  makeAdmin,
  resetDatabase,
  uniqueEmail,
} from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient
let clientA: SupabaseClient
let clientB: SupabaseClient
let clientAId: string
let clientBId: string
let quoteAId: string
let draftAId: string

beforeAll(async () => {
  await resetDatabase()
  const db = adminDb()

  const boss = await createUser(uniqueEmail('staff'))
  await makeAdmin(boss.id)
  staff = boss.db

  const a = await createUser(uniqueEmail('clienta'))
  const b = await createUser(uniqueEmail('clientb'))
  clientA = a.db
  clientB = b.db

  const { data: rowA } = await db.from('clients').select().eq('user_id', a.id).single()
  const { data: rowB } = await db.from('clients').select().eq('user_id', b.id).single()
  clientAId = rowA!.id
  clientBId = rowB!.id

  // Built as a draft, then promoted. Task 10 adds a trigger that rejects any
  // line item written to a quote that has already been sent, so fixtures must
  // fill the quote first and change its status afterwards.
  const { data: sent } = await db
    .from('quotes')
    .insert({
      client_id: clientAId,
      reference: 'Q-2026-8001',
      title: 'Piscina de A',
      access_token: 'token-a-sent',
      internal_notes: 'margen bajo, no bajar mas',
    })
    .select()
    .single()
  quoteAId = sent!.id

  const { data: draft } = await db
    .from('quotes')
    .insert({
      client_id: clientAId,
      reference: 'Q-2026-8002',
      title: 'Borrador de A',
      status: 'draft',
      access_token: 'token-a-draft',
    })
    .select()
    .single()
  draftAId = draft!.id

  await db.from('quote_items').insert({
    quote_id: quoteAId,
    name: 'Gresite',
    unit: 'm2',
    quantity: 40,
    unit_cost: 18,
    unit_price: 32.5,
    position: 1,
  })
  await db.from('quotes').update({ status: 'sent' }).eq('id', quoteAId)

  await db.from('price_book_groups').insert({ name: 'Albanileria' })
})

afterAll(resetDatabase)

describe('clients table', () => {
  it('lets a client read only their own row', async () => {
    const { data } = await clientA.from('clients').select('id')
    expect(data).toHaveLength(1)
    expect(data![0]!.id).toBe(clientAId)
  })

  it('hides client A from client B', async () => {
    const { data } = await clientB.from('clients').select('id').eq('id', clientAId)
    expect(data).toEqual([])
  })

  it('lets an admin read every client', async () => {
    const { data } = await staff.from('clients').select('id')
    expect(data!.length).toBeGreaterThanOrEqual(2)
  })

  it('returns nothing to an anonymous caller', async () => {
    const { data } = await anonDb().from('clients').select('id')
    expect(data).toEqual([])
  })

  it('refuses a client trying to rewrite their own email', async () => {
    const { error } = await clientA
      .from('clients')
      .update({ email: 'hijack@example.test' })
      .eq('id', clientAId)
      .select()
    const { data } = await adminDb().from('clients').select('email').eq('id', clientAId).single()
    expect(data!.email).not.toBe('hijack@example.test')
  })
})

describe('quotes table', () => {
  it('shows a sent quote to its own client', async () => {
    const { data } = await clientA.from('quotes').select('id').eq('id', quoteAId)
    expect(data).toHaveLength(1)
  })

  it('hides a draft quote from its own client', async () => {
    const { data } = await clientA.from('quotes').select('id').eq('id', draftAId)
    expect(data).toEqual([])
  })

  it('hides client A quotes from client B', async () => {
    const { data } = await clientB.from('quotes').select('id')
    expect(data).toEqual([])
  })

  it('refuses a client changing the status directly', async () => {
    await clientA.from('quotes').update({ status: 'accepted' }).eq('id', quoteAId)
    const { data } = await adminDb().from('quotes').select('status').eq('id', quoteAId).single()
    expect(data!.status).toBe('sent')
  })
})

describe('quote_items table', () => {
  it('gives a client no direct access at all', async () => {
    const { data } = await clientA.from('quote_items').select('id')
    expect(data).toEqual([])
  })

  it('lets an admin read the cost', async () => {
    const { data } = await staff.from('quote_items').select('unit_cost')
    expect(data![0]!.unit_cost).toBe(18)
  })
})

describe('price book', () => {
  it('is invisible to clients', async () => {
    const groups = await clientA.from('price_book_groups').select('id')
    const items = await clientA.from('price_book_items').select('id')
    expect(groups.data).toEqual([])
    expect(items.data).toEqual([])
  })

  it('is fully visible to admins', async () => {
    const { data } = await staff.from('price_book_groups').select('id')
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})

describe('leads table', () => {
  it('accepts an anonymous submission', async () => {
    const { error } = await anonDb().from('leads').insert({
      full_name: 'Visitante',
      email: uniqueEmail('visitor'),
      message: 'Quiero presupuesto para una piscina de 8x4',
    })
    expect(error).toBeNull()
  })

  it('does not let anonymous callers read leads back', async () => {
    const { data } = await anonDb().from('leads').select('id')
    expect(data).toEqual([])
  })

  it('lets an admin read leads', async () => {
    const { data } = await staff.from('leads').select('id')
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})

describe('profiles table', () => {
  it('lets a user read their own profile only', async () => {
    const { data } = await clientA.from('profiles').select('id')
    expect(data).toHaveLength(1)
  })

  it('refuses a client promoting themselves to admin', async () => {
    const { data: before } = await clientA.from('profiles').select('id').single()
    await clientA.from('profiles').update({ role: 'admin' }).eq('id', before!.id)
    const { data } = await adminDb().from('profiles').select('role').eq('id', before!.id).single()
    expect(data!.role).toBe('client')
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:db -- rls`
Expected: FAIL — with RLS not yet enabled, clients can read everything.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0003_rls_policies.sql`:

```sql
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.projects          enable row level security;
alter table public.quotes            enable row level security;
alter table public.quote_items       enable row level security;
alter table public.price_book_groups enable row level security;
alter table public.price_book_items  enable row level security;
alter table public.leads             enable row level security;

-- profiles ------------------------------------------------------------------
-- A user reads their own profile. Only an admin may write any profile, which
-- is what stops a client promoting themselves.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- clients -------------------------------------------------------------------
create policy clients_admin_all on public.clients
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy clients_select_own on public.clients
  for select to authenticated
  using (user_id = auth.uid());

-- projects ------------------------------------------------------------------
create policy projects_admin_all on public.projects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy projects_select_own on public.projects
  for select to authenticated
  using (client_id = public.current_client_id());

-- quotes --------------------------------------------------------------------
create policy quotes_admin_all on public.quotes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Drafts are deliberately excluded: a half-written quote must never be
-- visible to the person it is being written for.
create policy quotes_select_own on public.quotes
  for select to authenticated
  using (
    client_id = public.current_client_id()
    and status <> 'draft'
  );

-- quote_items ---------------------------------------------------------------
-- Admin only. The column unit_cost lives here, so clients get no policy at
-- all and read through the client_quote_items view instead (migration 0004).
create policy quote_items_admin_all on public.quote_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- price book ----------------------------------------------------------------
create policy price_book_groups_admin_all on public.price_book_groups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy price_book_items_admin_all on public.price_book_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- leads ---------------------------------------------------------------------
-- The only anonymous write in the system: the public contact form.
create policy leads_insert_public on public.leads
  for insert to anon, authenticated
  with check (true);

create policy leads_admin_all on public.leads
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 4: Apply and run the test**

```bash
npx supabase migration up
npm run test:db -- rls
```

Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: enforce row level security on every table"
```

---

### Task 7: Client-safe views

Clients need to see their line items and totals, but never `unit_cost` or
`margin`. A view solves it; the subtlety is which security mode it uses.

**Files:**
- Create: `supabase/migrations/0004_client_views.sql`
- Test: `tests/integration/views.test.ts`

**Interfaces:**
- Consumes: `quote_items`, `quotes`, `current_client_id()`.
- Produces: views `client_quote_items`, `quote_totals` (admin, includes cost
  and margin) and `client_quote_totals` (no cost). Task 3 of the Admin Core
  plan reads `quote_totals` for the dashboard list.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/views.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient
let client: SupabaseClient
let quoteId: string

beforeAll(async () => {
  await resetDatabase()
  const db = adminDb()

  const boss = await createUser(uniqueEmail('staff'))
  await makeAdmin(boss.id)
  staff = boss.db

  const person = await createUser(uniqueEmail('client'))
  client = person.db
  const { data: row } = await db.from('clients').select().eq('user_id', person.id).single()

  const { data: quote } = await db
    .from('quotes')
    .insert({
      client_id: row!.id,
      reference: 'Q-2026-7001',
      title: 'Piscina con extras',
      access_token: 'token-views',
    })
    .select()
    .single()
  quoteId = quote!.id

  await db.from('quote_items').insert([
    // 40 * 32.50 = 1300.00
    { quote_id: quoteId, name: 'Gresite', unit: 'm2', quantity: 40,
      unit_cost: 18, unit_price: 32.5, position: 1 },
    // 1 * 2000 with 10% off = 1800.00
    { quote_id: quoteId, name: 'Excavacion', unit: 'lot', quantity: 1,
      unit_cost: 1200, unit_price: 2000, discount_pct: 10, position: 2 },
    // recommended, excluded from the base total
    { quote_id: quoteId, name: 'Cobertor termico', unit: 'unit', quantity: 1,
      unit_cost: 300, unit_price: 650, is_recommended: true, position: 3 },
    // recommended and selected by the client
    { quote_id: quoteId, name: 'Iluminacion LED', unit: 'unit', quantity: 2,
      unit_cost: 60, unit_price: 145, is_recommended: true,
      client_selected: true, position: 4 },
  ])

  // Sent only now: Task 10 freezes line items once a quote leaves draft.
  await db.from('quotes').update({ status: 'sent' }).eq('id', quoteId)
})

afterAll(resetDatabase)

describe('client_quote_items', () => {
  it('does not expose unit_cost', async () => {
    const { data } = await client.from('client_quote_items').select('*')
    expect(data!.length).toBe(4)
    expect(Object.keys(data![0]!)).not.toContain('unit_cost')
  })

  it('returns nothing for a quote belonging to somebody else', async () => {
    const other = await createUser(uniqueEmail('other'))
    const { data } = await other.db.from('client_quote_items').select('*')
    expect(data).toEqual([])
  })
})

describe('quote_totals', () => {
  it('sums only non-recommended lines into the base total', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.base_total)).toBe(3100)
  })

  it('keeps recommended lines in their own total', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.recommended_total)).toBe(940)
  })

  it('counts only the extras the client selected', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.selected_extras_total)).toBe(290)
  })

  it('adds selected extras to the grand total', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.grand_total)).toBe(3390)
  })

  it('reports cost and margin to an admin', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.cost_total)).toBe(1920)
    expect(Number(data!.margin)).toBe(1180)
  })
})

describe('client_quote_totals', () => {
  it('gives the client totals without cost or margin', async () => {
    const { data } = await client.from('client_quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.grand_total)).toBe(3390)
    expect(Object.keys(data!)).not.toContain('cost_total')
    expect(Object.keys(data!)).not.toContain('margin')
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:db -- views`
Expected: FAIL — relation `client_quote_items` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0004_client_views.sql`:

```sql
-- Line arithmetic, defined once so the view, the PDF and the screen can never
-- disagree. Rounded per line before summing, matching how a person adds up an
-- invoice on paper.
create or replace function public.quote_item_total(
  p_quantity numeric,
  p_unit_price numeric,
  p_discount_pct numeric
)
returns numeric
language sql
immutable
as $$
  select round(p_quantity * p_unit_price * (1 - p_discount_pct / 100.0), 2);
$$;

-- Admin-facing totals. security_invoker means the caller's own policies on
-- quote_items apply, so only an admin gets rows. Cost and margin are safe
-- here for exactly that reason.
create view public.quote_totals
with (security_invoker = true) as
select
  q.id as quote_id,
  coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
           filter (where not i.is_recommended), 0)::numeric(12,2) as base_total,
  coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
           filter (where i.is_recommended), 0)::numeric(12,2) as recommended_total,
  coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
           filter (where i.is_recommended and i.client_selected), 0)::numeric(12,2)
           as selected_extras_total,
  (coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
            filter (where not i.is_recommended), 0)
   + coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
            filter (where i.is_recommended and i.client_selected), 0)
  )::numeric(12,2) as grand_total,
  coalesce(sum(round(i.quantity * i.unit_cost, 2))
           filter (where not i.is_recommended), 0)::numeric(12,2) as cost_total,
  (coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
            filter (where not i.is_recommended), 0)
   - coalesce(sum(round(i.quantity * i.unit_cost, 2))
            filter (where not i.is_recommended), 0)
  )::numeric(12,2) as margin
from public.quotes q
left join public.quote_items i on i.quote_id = q.id
group by q.id;

-- Client-facing line items.
--
-- This view is deliberately security definer (the default). With
-- security_invoker = true it would be evaluated under the caller's own
-- permissions, hit the admin-only policy on quote_items and return nothing.
-- Ownership is therefore enforced inside the view body instead.
--
-- Column-level grants are not an alternative: admins and clients are both the
-- `authenticated` role, so revoking a column would hide cost from staff too.
create view public.client_quote_items as
select
  i.id,
  i.quote_id,
  i.group_name,
  i.name,
  i.description,
  i.unit,
  i.quantity,
  i.unit_price,
  i.discount_pct,
  i.is_recommended,
  i.client_selected,
  i.position,
  public.quote_item_total(i.quantity, i.unit_price, i.discount_pct) as line_total
from public.quote_items i
where i.quote_id in (
  select q.id
  from public.quotes q
  where q.client_id = public.current_client_id()
    and q.status <> 'draft'
);

create view public.client_quote_totals as
select
  t.quote_id,
  t.base_total,
  t.recommended_total,
  t.selected_extras_total,
  t.grand_total
from public.quotes q
join lateral (
  select
    q.id as quote_id,
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where not i.is_recommended), 0)::numeric(12,2) as base_total,
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where i.is_recommended), 0)::numeric(12,2) as recommended_total,
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where i.is_recommended and i.client_selected), 0)::numeric(12,2)
             as selected_extras_total,
    (coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
              filter (where not i.is_recommended), 0)
     + coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
              filter (where i.is_recommended and i.client_selected), 0)
    )::numeric(12,2) as grand_total
  from public.quote_items i
  where i.quote_id = q.id
) t on true
where q.client_id = public.current_client_id()
  and q.status <> 'draft';

revoke all on public.quote_totals         from anon, authenticated;
revoke all on public.client_quote_items   from anon, authenticated;
revoke all on public.client_quote_totals  from anon, authenticated;

grant select on public.quote_totals        to authenticated;
grant select on public.client_quote_items  to authenticated;
grant select on public.client_quote_totals to authenticated;

grant execute on function public.quote_item_total(numeric, numeric, numeric)
  to anon, authenticated;
```

- [ ] **Step 4: Apply and run the test**

```bash
npx supabase migration up
npm run test:db -- views
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add client-safe quote views"
```

---

### Task 8: Reference number generation

`Q-2026-0001`. Two staff members clicking "new quote" at the same second must
not receive the same number.

**Files:**
- Create: `supabase/migrations/0005_references.sql`
- Test: `tests/integration/references.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.next_reference(p_prefix text) returns text`. The Admin
  Core plan calls it with `'Q'` for quotes and `'P'` for projects.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/references.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient

beforeAll(async () => {
  await resetDatabase()
  await adminDb().from('reference_counters').delete().gte('year', 0)
  const boss = await createUser(uniqueEmail('staff'))
  await makeAdmin(boss.id)
  staff = boss.db
})

afterAll(async () => {
  await adminDb().from('reference_counters').delete().gte('year', 0)
  await resetDatabase()
})

describe('next_reference', () => {
  it('formats the reference with prefix, year and four digits', async () => {
    const { data } = await staff.rpc('next_reference', { p_prefix: 'Q' })
    const year = new Date().getFullYear()
    expect(data).toBe(`Q-${year}-0001`)
  })

  it('increments on each call', async () => {
    const second = await staff.rpc('next_reference', { p_prefix: 'Q' })
    const third = await staff.rpc('next_reference', { p_prefix: 'Q' })
    const year = new Date().getFullYear()
    expect(second.data).toBe(`Q-${year}-0002`)
    expect(third.data).toBe(`Q-${year}-0003`)
  })

  it('counts each prefix separately', async () => {
    const { data } = await staff.rpc('next_reference', { p_prefix: 'P' })
    const year = new Date().getFullYear()
    expect(data).toBe(`P-${year}-0001`)
  })

  it('never issues the same reference twice under concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => staff.rpc('next_reference', { p_prefix: 'C' })),
    )
    const values = results.map((r) => r.data as string)
    expect(new Set(values).size).toBe(25)
  })

  it('is not callable by an anonymous visitor', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { LOCAL_URL, LOCAL_ANON_KEY } = await import('./helpers/db')
    const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY)
    const { error } = await anon.rpc('next_reference', { p_prefix: 'Q' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:db -- references`
Expected: FAIL — function `next_reference` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0005_references.sql`:

```sql
create table public.reference_counters (
  prefix     text    not null,
  year       integer not null,
  last_value integer not null default 0,
  primary key (prefix, year)
);

alter table public.reference_counters enable row level security;

create policy reference_counters_admin_all on public.reference_counters
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A single INSERT ... ON CONFLICT DO UPDATE is atomic: PostgreSQL takes a row
-- lock on conflict, so concurrent callers queue rather than read the same
-- value twice. A read-then-write pair here would hand out duplicates.
create or replace function public.next_reference(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year  integer := extract(year from now())::integer;
  v_value integer;
begin
  if not public.is_admin() then
    raise exception 'Only staff may allocate references'
      using errcode = '42501';
  end if;

  insert into public.reference_counters (prefix, year, last_value)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year)
    do update set last_value = public.reference_counters.last_value + 1
  returning last_value into v_value;

  return p_prefix || '-' || v_year || '-' || lpad(v_value::text, 4, '0');
end;
$$;

revoke all on function public.next_reference(text) from public;
grant execute on function public.next_reference(text) to authenticated;
```

- [ ] **Step 4: Apply and run the test**

```bash
npx supabase migration up
npm run test:db -- references
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add atomic reference number generation"
```

---

### Task 9: Account linking on email confirmation

Ties an auth account to a client record by verified email, in both
directions and retroactively.

**Files:**
- Create: `supabase/migrations/0006_account_linking.sql`
- Test: `tests/integration/account-linking.test.ts`

**Interfaces:**
- Consumes: `profiles`, `clients`.
- Produces: trigger `on_auth_user_confirmed` on `auth.users`. No callable
  name; its effect is that `clients.user_id` and `profiles` are populated.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/account-linking.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  LOCAL_ANON_KEY,
  LOCAL_URL,
  adminDb,
  createUser,
  resetDatabase,
  uniqueEmail,
} from './helpers/db'
import { createClient } from '@supabase/supabase-js'

beforeAll(resetDatabase)
afterAll(resetDatabase)

describe('account linking', () => {
  it('creates a profile with the client role', async () => {
    const { id } = await createUser(uniqueEmail('newcomer'))
    const { data } = await adminDb().from('profiles').select().eq('id', id).single()
    expect(data!.role).toBe('client')
  })

  it('lets current_client_id resolve the linked record', async () => {
    const { id, db } = await createUser(uniqueEmail('resolver'))
    const { data: client } = await adminDb()
      .from('clients')
      .select()
      .eq('user_id', id)
      .single()

    const { data } = await db.rpc('current_client_id')
    expect(data).toBe(client!.id)
  })

  it('creates a client row for a brand new registration', async () => {
    const email = uniqueEmail('fresh')
    const { id } = await createUser(email)
    const { data } = await adminDb().from('clients').select().eq('user_id', id).single()
    expect(data!.email.toLowerCase()).toBe(email.toLowerCase())
  })

  it('adopts a client record that staff created earlier', async () => {
    const email = uniqueEmail('quoted-first')
    const { data: existing } = await adminDb()
      .from('clients')
      .insert({ email, full_name: 'Presupuestado antes' })
      .select()
      .single()
    expect(existing!.user_id).toBeNull()

    const { id } = await createUser(email)

    const { data: linked } = await adminDb()
      .from('clients')
      .select()
      .eq('id', existing!.id)
      .single()
    expect(linked!.user_id).toBe(id)
    expect(linked!.full_name).toBe('Presupuestado antes')
  })

  it('matches the existing record regardless of letter case', async () => {
    const email = uniqueEmail('MixedCase')
    await adminDb().from('clients').insert({ email: email.toUpperCase(), full_name: 'Mixta' })
    const { id } = await createUser(email.toLowerCase())
    const { data } = await adminDb().from('clients').select().eq('user_id', id)
    expect(data).toHaveLength(1)
  })

  it('leaves quotes written before registration attached to the adopted record', async () => {
    const email = uniqueEmail('history')
    const { data: client } = await adminDb()
      .from('clients')
      .insert({ email, full_name: 'Con historial' })
      .select()
      .single()
    await adminDb().from('quotes').insert({
      client_id: client!.id,
      reference: 'Q-2026-6001',
      title: 'Presupuesto anterior al registro',
      status: 'sent',
      access_token: 'token-history',
    })

    const { db } = await createUser(email)
    const { data: visible } = await db.from('quotes').select('reference')

    expect(visible).toHaveLength(1)
    expect(visible![0]!.reference).toBe('Q-2026-6001')
  })

  it('does not link an unconfirmed account', async () => {
    const email = uniqueEmail('unconfirmed')
    const { data, error } = await adminDb().auth.admin.createUser({
      email,
      password: 'test-password-123',
      email_confirm: false,
    })
    expect(error).toBeNull()

    const { data: rows } = await adminDb().from('clients').select().eq('user_id', data!.user!.id)
    expect(rows).toEqual([])
  })

  it('does not steal a client already linked to somebody else', async () => {
    const email = uniqueEmail('taken')
    const first = await createUser(email)
    const { data: before } = await adminDb().from('clients').select().eq('user_id', first.id).single()

    // A second account cannot exist for the same email in Supabase auth, so
    // assert instead that the link is stable and singular.
    const { data: all } = await adminDb().from('clients').select().eq('email', email)
    expect(all).toHaveLength(1)
    expect(all![0]!.id).toBe(before!.id)
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:db -- account-linking`
Expected: FAIL — no profile row is created.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0006_account_linking.sql`:

```sql
-- Runs when an account is created already confirmed, and when an existing
-- account becomes confirmed. Email confirmation is the entire basis of the
-- link: an unverified address proves nothing about who owns it.
create or replace function public.handle_confirmed_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linked_id uuid;
  v_name      text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, role, full_name)
  values (new.id, 'client', v_name)
  on conflict (id) do nothing;

  -- Adopt a record staff created while quoting this address.
  update public.clients
     set user_id = new.id
   where email = new.email::citext
     and user_id is null
  returning id into v_linked_id;

  -- Otherwise this is a first-time visitor registering on their own.
  if v_linked_id is null then
    insert into public.clients (email, full_name, user_id)
    values (new.email::citext, v_name, new.id)
    on conflict (email) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_confirmed_user();
```

- [ ] **Step 4: Apply and run the tests**

```bash
npx supabase migration up
npm run test:db -- account-linking
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: link accounts to clients by verified email"
```

---

### Task 10: Sent quotes are immutable

Without this, editing a sent quote silently changes the price the client sees
through a link they already have.

**Files:**
- Create: `supabase/migrations/0007_quote_immutability.sql`
- Test: `tests/integration/immutability.test.ts`

**Interfaces:**
- Consumes: `quotes`, `quote_items`.
- Produces: trigger `quote_items_guard_status` on `quote_items`. The Admin
  Core plan must return a quote to `draft` before editing it.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/immutability.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient
let sentQuoteId: string
let draftQuoteId: string
let sentItemId: string

beforeAll(async () => {
  await resetDatabase()
  const db = adminDb()
  const boss = await createUser(uniqueEmail('staff'))
  await makeAdmin(boss.id)
  staff = boss.db

  const { data: client } = await db
    .from('clients')
    .insert({ email: uniqueEmail('frozen'), full_name: 'Cliente' })
    .select()
    .single()

  const { data: sent } = await db
    .from('quotes')
    .insert({
      client_id: client!.id,
      reference: 'Q-2026-5001',
      title: 'Enviado',
      access_token: 'token-frozen',
    })
    .select()
    .single()
  sentQuoteId = sent!.id

  const { data: draft } = await db
    .from('quotes')
    .insert({
      client_id: client!.id,
      reference: 'Q-2026-5002',
      title: 'Borrador',
      access_token: 'token-open',
    })
    .select()
    .single()
  draftQuoteId = draft!.id

  const { data: item } = await db
    .from('quote_items')
    .insert({
      quote_id: sentQuoteId,
      name: 'Gresite',
      unit: 'm2',
      quantity: 40,
      unit_cost: 18,
      unit_price: 32.5,
      is_recommended: true,
      position: 1,
    })
    .select()
    .single()
  sentItemId = item!.id

  // The line exists first; only then is the quote sent and frozen. Inserting
  // into an already-sent quote is exactly what this task forbids.
  await db.from('quotes').update({ status: 'sent' }).eq('id', sentQuoteId)
})

afterAll(resetDatabase)

describe('sent quote immutability', () => {
  it('refuses a price change on a sent quote', async () => {
    const { error } = await staff
      .from('quote_items')
      .update({ unit_price: 99 })
      .eq('id', sentItemId)
      .select()
    expect(error).not.toBeNull()
  })

  it('refuses a new line on a sent quote', async () => {
    const { error } = await staff.from('quote_items').insert({
      quote_id: sentQuoteId,
      name: 'Extra colado',
      unit: 'unit',
      quantity: 1,
      unit_price: 10,
      position: 9,
    })
    expect(error).not.toBeNull()
  })

  it('refuses deleting a line from a sent quote', async () => {
    const { error } = await staff.from('quote_items').delete().eq('id', sentItemId).select()
    expect(error).not.toBeNull()
  })

  it('still allows toggling the client extras selection', async () => {
    const { error } = await adminDb()
      .from('quote_items')
      .update({ client_selected: true })
      .eq('id', sentItemId)
    expect(error).toBeNull()
  })

  it('allows every edit while the quote is a draft', async () => {
    const { error } = await staff.from('quote_items').insert({
      quote_id: draftQuoteId,
      name: 'Linea libre',
      unit: 'hour',
      quantity: 8,
      unit_price: 35,
      position: 1,
    })
    expect(error).toBeNull()
  })

  it('allows editing again after the quote returns to draft', async () => {
    await adminDb().from('quotes').update({ status: 'draft' }).eq('id', sentQuoteId)
    const { error } = await staff
      .from('quote_items')
      .update({ unit_price: 30 })
      .eq('id', sentItemId)
      .select()
    expect(error).toBeNull()
    await adminDb().from('quotes').update({ status: 'sent' }).eq('id', sentQuoteId)
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:db -- immutability`
Expected: FAIL — the price change succeeds.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0007_quote_immutability.sql`:

```sql
-- A quote leaves the office when it is sent. From that moment its lines are
-- frozen, so the figure the client is looking at cannot change underneath
-- them. Returning the quote to draft reopens it and invalidates the link.
--
-- The one permitted change is client_selected: that is the client ticking a
-- recommended extra, which is the whole point of the sent state. Comparing
-- the rows as jsonb minus that key is exact, and stays correct when columns
-- are added later.
create or replace function public.guard_quote_item_edit()
returns trigger
language plpgsql
as $$
declare
  v_status quote_status;
  v_quote  uuid := coalesce(new.quote_id, old.quote_id);
begin
  select status into v_status from public.quotes where id = v_quote;

  if v_status is null or v_status = 'draft' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'client_selected') = (to_jsonb(old) - 'client_selected')
  then
    return new;
  end if;

  raise exception
    'Quote % is % and cannot be edited. Return it to draft first.', v_quote, v_status
    using errcode = 'P0001';
end;
$$;

create trigger quote_items_guard_status
  before insert or update or delete on public.quote_items
  for each row execute function public.guard_quote_item_edit();
```

- [ ] **Step 4: Apply and run the test**

```bash
npx supabase migration up
npm run test:db -- immutability
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Run the whole database suite**

Run: `npm run test:db`
Expected: every file passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: freeze quote items once the quote is sent"
```

---

### Task 11: Seed data

Realistic Spanish pool-trade data, so screens are developed against something
that looks like the real thing rather than "Test Item 1".

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Consumes: every table.
- Produces: a populated local database. Not used by tests, which arrange
  their own fixtures.

- [ ] **Step 1: Write the seed**

Create `supabase/seed.sql`:

```sql
insert into public.price_book_groups (name, position) values
  ('Movimiento de tierras', 1),
  ('Estructura',            2),
  ('Revestimiento',         3),
  ('Depuracion',            4),
  ('Iluminacion',           5),
  ('Mano de obra',          6),
  ('Mantenimiento',         7);

insert into public.price_book_items (group_id, code, name, description, unit, unit_cost, unit_price)
select g.id, v.code, v.name, v.description, v.unit::unit_type, v.cost, v.price
from (values
  ('Movimiento de tierras', 'EXC-001', 'Excavacion vaso piscina',   'Excavacion con retroexcavadora y retirada de tierras', 'm2',   28.00,  48.00),
  ('Movimiento de tierras', 'EXC-002', 'Transporte de tierras',     'Portes a vertedero autorizado',                        'lot', 220.00, 380.00),
  ('Estructura',            'EST-001', 'Hormigon gunitado',         'Proyeccion de hormigon, espesor 15 cm',                'm2',   62.00, 105.00),
  ('Estructura',            'EST-002', 'Encofrado y ferralla',      'Armado de muros y solera',                             'm2',   34.00,  58.00),
  ('Revestimiento',         'REV-001', 'Gresite 2,5x2,5',           'Colocacion de gresite, incluye material',              'm2',   18.00,  32.50),
  ('Revestimiento',         'REV-002', 'Borada',                    'Rejuntado epoxi de gresite',                           'm2',    6.50,  12.00),
  ('Revestimiento',         'REV-003', 'Coronacion piedra natural', 'Remate perimetral en piedra',                          'ml',   26.00,  45.00),
  ('Depuracion',            'DEP-001', 'Depuradora 8 m3/h',         'Bomba y filtro de arena, instalados',                  'unit', 480.00, 790.00),
  ('Depuracion',            'DEP-002', 'Clorador salino',           'Electrolisis salina hasta 75 m3',                      'unit', 620.00, 980.00),
  ('Iluminacion',           'ILU-001', 'Foco LED blanco',           'Foco empotrado 18 W con nicho',                        'unit',  60.00, 145.00),
  ('Iluminacion',           'ILU-002', 'Foco LED RGB',              'Foco de color con mando',                              'unit',  95.00, 210.00),
  ('Mano de obra',          'MDO-001', 'Oficial de primera',        'Hora de oficial',                                      'hour',  19.00,  35.00),
  ('Mano de obra',          'MDO-002', 'Peon',                      'Hora de peon',                                         'hour',  14.00,  26.00),
  ('Mantenimiento',         'MAN-001', 'Mantenimiento mensual',     'Limpieza, analisis y ajuste de producto',              'unit',  45.00,  90.00),
  ('Mantenimiento',         'MAN-002', 'Invernaje',                 'Preparacion de la piscina para el invierno',           'lot',  110.00, 195.00)
) as v(group_name, code, name, description, unit, cost, price)
join public.price_book_groups g on g.name = v.group_name;

insert into public.clients (email, full_name, phone, address, city, postal_code) values
  ('ana.ruiz@example.test',    'Ana Ruiz Mora',       '655112233', 'Carrer de Sant Joan 14', 'Reus',     '43201'),
  ('jordi.pons@example.test',  'Jordi Pons Vila',     '655445566', 'Avinguda Diagonal 3',    'Cambrils', '43850'),
  ('marta.sole@example.test',  'Marta Sole Ferrer',   '655778899', 'Carrer del Mar 27',      'Salou',    '43840');
```

- [ ] **Step 2: Reset the database with the seed applied**

```bash
npx supabase db reset
```

Expected: every migration replays cleanly, then the seed loads. This also
proves the migrations work from empty, which is how the hosted project will
receive them.

- [ ] **Step 3: Verify the seed loaded**

```bash
npx supabase db reset && npm run test:db
```

Expected: migrations apply, tests still pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add price book seed data"
```

---

### Task 12: Session middleware

Supabase access tokens expire. Without a middleware refreshing them, a user
appears logged in to the browser and logged out to the server.

**Files:**
- Create: `src/lib/supabase/middleware.ts`, `src/middleware.ts`
- Test: `tests/e2e/auth.spec.ts` (written in Task 13)

**Interfaces:**
- Consumes: `getPublicEnv()`.
- Produces: `updateSession(request: NextRequest): Promise<NextResponse>` and
  the route matcher. Protects `/admin` and `/portal` for every later plan.

- [ ] **Step 1: Implement the session updater**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicEnv } from '@/lib/env'

const ADMIN_PREFIX = '/admin'
const PORTAL_PREFIX = '/portal'

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })
  const env = getPublicEnv()

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser revalidates the token against Supabase. getSession only reads the
  // cookie, which a client can forge, so it must not be used for a decision.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = path.startsWith(ADMIN_PREFIX) || path.startsWith(PORTAL_PREFIX)

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (path.startsWith(ADMIN_PREFIX) && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
```

- [ ] **Step 2: Register the middleware**

Create `src/middleware.ts`:

```typescript
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files. The session must be
     * refreshed on navigation, not on every icon request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: refresh sessions and guard protected routes"
```

---

### Task 13: Login, sign out and the protected shells

The smallest real screens: sign in, land somewhere according to role, sign
out.

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/login-form.tsx`,
  `src/app/auth/actions.ts`, `src/app/admin/page.tsx`,
  `src/app/portal/page.tsx`, `src/app/page.tsx` (modify)
- Test: `tests/e2e/auth.spec.ts`, `playwright.config.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient()`, `createBrowserSupabaseClient()`.
- Produces: server actions `signIn(formData: FormData)` and `signOut()`.

- [ ] **Step 1: Install and configure Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

Add to `package.json`:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 2: Write the failing test**

Create `tests/e2e/auth.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const admin = createClient(LOCAL_URL, SERVICE_KEY)
const password = 'test-password-123'
const staffEmail = `staff-e2e-${Date.now()}@example.test`
const clientEmail = `client-e2e-${Date.now()}@example.test`

test.beforeAll(async () => {
  const staff = await admin.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
  })
  await admin.from('profiles').update({ role: 'admin' }).eq('id', staff.data.user!.id)

  await admin.auth.admin.createUser({
    email: clientEmail,
    password,
    email_confirm: true,
  })
})

test('redirects an anonymous visitor away from the dashboard', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})

test('rejects a wrong password with a visible message', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(staffEmail)
  await page.getByLabel('Contraseña').fill('wrong-password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
})

test('signs an admin in and lands on the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(staffEmail)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible()
})

test('sends a client to the portal, not the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(clientEmail)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/portal/)
})

test('blocks a client from the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(clientEmail)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/portal/)
})

test('signs out and locks the dashboard again', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(staffEmail)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin/)

  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npm run test:e2e`
Expected: FAIL — `/login` returns 404.

- [ ] **Step 4: Write the auth server actions**

Create `src/app/auth/actions.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type SignInState = { error: string | null }

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Introduce tu correo y tu contraseña.' }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" tells an attacker which addresses are registered.
    return { error: 'Correo o contraseña incorrectos.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  revalidatePath('/', 'layout')
  redirect(profile?.role === 'admin' ? '/admin' : '/portal')
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

- [ ] **Step 5: Write the login form**

Create `src/app/login/login-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { signIn, type SignInState } from '@/app/auth/actions'

const initialState: SignInState = { error: null }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState)

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border px-3 py-2"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 6: Write the login page**

Create `src/app/login/page.tsx`:

```tsx
import { LoginForm } from './login-form'

export const metadata = { title: 'Acceso' }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Acceso</h1>
      <LoginForm />
    </main>
  )
}
```

- [ ] **Step 7: Write the two protected shells**

Create `src/app/admin/page.tsx`:

```tsx
import { signOut } from '@/app/auth/actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AdminHomePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Panel</h1>
        <form action={signOut}>
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">
            Salir
          </button>
        </form>
      </div>
      <p className="text-sm text-slate-600">Sesión iniciada como {user?.email}</p>
    </main>
  )
}
```

Create `src/app/portal/page.tsx`:

```tsx
import { signOut } from '@/app/auth/actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function PortalHomePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mi área</h1>
        <form action={signOut}>
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">
            Salir
          </button>
        </form>
      </div>
      <p className="text-sm text-slate-600">Sesión iniciada como {user?.email}</p>
    </main>
  )
}
```

- [ ] **Step 8: Replace the scaffold home page**

Replace `src/app/page.tsx` with a placeholder; the real marketing site is
Plan 5.

```tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Piscinas Reus</h1>
      <p className="text-slate-600">Sitio en construcción.</p>
      <Link href="/login" className="underline">
        Acceso
      </Link>
    </main>
  )
}
```

- [ ] **Step 9: Run the test and watch it pass**

Run: `npm run test:e2e`
Expected: PASS, 6 tests.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add login, sign out and role-based landing"
```

---

### Task 14: Continuous integration

Every check that has been run by hand so far, run automatically on every push.

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `typecheck`, `lint`, `test`, `test:db` and `test:e2e` scripts.
- Produces: a green check on the repository.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Start Supabase
        run: npx supabase start

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm test

      - name: Database tests
        run: npm run test:db

      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium

      - name: End-to-end tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
          SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
          NEXT_PUBLIC_SITE_URL: http://127.0.0.1:3000

      - name: Stop Supabase
        if: always()
        run: npx supabase stop
```

The keys above are Supabase's published local development values, identical in
every installation. They grant access to the throwaway container inside the
runner and to nothing else.

- [ ] **Step 2: Push and confirm the workflow runs**

```bash
git add -A
git commit -m "ci: run type, lint, unit, database and e2e checks"
git push
gh run watch
```

Expected: all steps green.

---

### Task 15: Deploy and apply migrations to the hosted project

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: a live URL and a hosted database matching the local schema.

- [ ] **Step 1: Confirm the hosted auth setting**

In the Supabase dashboard, Authentication → Providers → Email, verify
**Confirm email is enabled**. The account-linking trigger from Task 9 treats a
confirmed address as proof of ownership; without confirmation anyone could
register with somebody else's address and read their quotes.

Also set Authentication → URL Configuration → Site URL to the Vercel domain
once it exists.

- [ ] **Step 2: Link and push the schema**

```bash
npx supabase link --project-ref xnpljpbyylcgwepajhzw
npx supabase db push
```

Expected: all seven migrations apply. The seed is not pushed; production
starts empty.

- [ ] **Step 3: Deploy to Vercel**

Import the GitHub repository in Vercel and set the environment variables
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 4: Create the first staff account**

Register through the deployed site, confirm the email, then in the Supabase
dashboard run:

```sql
update public.profiles set role = 'admin' where id = (
  select id from auth.users where email = 'the-staff-address@example.com'
);
```

- [ ] **Step 5: Verify against production**

Sign in with the staff account and confirm the dashboard loads. Sign in with a
second, non-promoted account and confirm it lands on `/portal` and is bounced
away from `/admin`.

- [ ] **Step 6: Write the README**

Replace `README.md`:

````markdown
# Piscinas Reus

Marketing site, quoting dashboard and client portal for a pool construction
and maintenance company in Reus.

## Requirements

- Node 22
- Docker (for the local Supabase stack)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values
npx supabase start
npx supabase db reset        # applies migrations and the seed
npm run dev
```

## Checks

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Database and Row Level Security tests |
| `npm run test:e2e` | Browser tests (Playwright) |

## Database

Migrations live in `supabase/migrations` and are applied in order. Never edit
the schema through the Supabase dashboard: write a migration, apply it locally
with `npx supabase migration up`, and push it with `npx supabase db push`.

## Documentation

- Design: `docs/superpowers/specs/2026-09-07-piscinas-reus-design.md`
- Plans: `docs/superpowers/plans/`
````

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: add readme"
git push
```

---

## Definition of done

- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db` and
      `npm run test:e2e` all pass locally and in CI.
- [ ] `npx supabase db reset` replays every migration from empty without error.
- [ ] A client account can read neither another client's rows, nor any draft
      quote, nor `unit_cost`, nor the price book — proven by tests, not by
      inspection.
- [ ] The deployed site authenticates, routes by role and blocks a client from
      `/admin`.
- [ ] Email confirmation is enabled on the hosted Supabase project.
