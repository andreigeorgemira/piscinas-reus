import { defineConfig, devices } from '@playwright/test'
import {
  LOCAL_ANON_KEY,
  LOCAL_SERVICE_KEY,
  LOCAL_URL,
} from './tests/integration/helpers/db'

/**
 * Not port 3000, and never a reused server. `.env.local` on a developer
 * machine points `next dev` at the hosted Supabase project, while these
 * tests arrange their fixtures in the local container. A dev server started
 * by hand would therefore authenticate against the wrong database, and
 * `reuseExistingServer` would silently adopt it. Playwright starts its own
 * server on its own port with the local credentials injected instead.
 *
 * The injection works because `process.env` outranks every `.env` file:
 * node_modules/next/dist/docs/01-app/02-guides/environment-variables.md,
 * "Environment Variable Load Order".
 */
const PORT = 3100
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // --hostname pins the origin the dev server considers its own. Without
    // it the server binds 0.0.0.0 and treats only `localhost` as local, so
    // every HMR request from 127.0.0.1 is logged as a blocked cross-origin
    // request to a dev resource (see the allowedDevOrigins doc in
    // node_modules/next/dist/docs/01-app/03-api-reference/05-config/).
    command: 'npm run dev -- --hostname 127.0.0.1',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  },
})
