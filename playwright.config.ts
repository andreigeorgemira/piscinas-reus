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

/**
 * Its own build directory, because `next dev` locks one per directory rather
 * than per port: without this the suite refuses to start whenever the developer
 * already has `npm run dev` running. See the comment in next.config.ts, which
 * reads NEXT_DIST_DIR. Keep the value in .gitignore.
 */
const E2E_DIST_DIR = '.next-e2e'

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
    // This list has to stay exhaustive. It overrides rather than replaces -
    // Playwright spawns the server with `{...process.env, ...env}`
    // (node_modules/playwright/lib/runner/index.js, `launchProcess`) - so every
    // variable not named here still reaches the dev server from the developer's
    // `.env.local`, which points at the hosted project and at real third-party
    // services. A variable that would reach a live service has to be
    // neutralised here explicitly, even when it is empty today: the run that
    // breaks the rule is the one after somebody fills it in. Adding an
    // integration means adding its variables here in the same commit.
    env: {
      PORT: String(PORT),
      NEXT_DIST_DIR: E2E_DIST_DIR,
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      // Plan 5 wires Resend up. Blank so an e2e run cannot send real email on
      // the developer's account.
      RESEND_API_KEY: '',
      RESEND_FROM_EMAIL: '',
    },
  },
})
