import type { NextConfig } from 'next'

/**
 * The build directory is overridable so a second `next dev` can run beside a
 * developer's own.
 *
 * `next dev` takes an exclusive lock on `<distDir>/dev/lock`
 * (node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js, the
 * `Lockfile.acquireWithRetriesOrExit(path.join(distDir, 'lock'), 'next dev')`
 * call). The lock is per build directory, not per port, so a second server in
 * this repo exits with "Another next dev server is already running" whatever
 * port it is handed. Giving the e2e server its own directory gives it its own
 * lock. See `webServer.env` in playwright.config.ts.
 *
 * distDir must stay inside the project directory:
 * node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/distDir.md
 */
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
}

export default nextConfig
