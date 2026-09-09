import { z } from 'zod'

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when it is
 * referenced as a literal member expression. Destructuring or dynamic access
 * yields undefined in the browser bundle, so each variable is spelled out.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

/**
 * `SITE_URL` is the deployment's own origin, used to build absolute links for
 * PDFs, public quote links and email. It is not a secret, but it is read on
 * the server only: it carries no `NEXT_PUBLIC_` prefix so it stays out of the
 * browser bundle, and it lives apart from `getServerEnv` so that needing one
 * does not force the other to be set.
 */
const siteSchema = z.object({
  SITE_URL: z.url(),
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
  })
  if (!parsed.success) format(parsed.error)
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }
}

export function getServerEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
  if (!parsed.success) format(parsed.error)
  return { serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY }
}

export function getSiteUrl() {
  const parsed = siteSchema.safeParse({ SITE_URL: process.env.SITE_URL })
  if (!parsed.success) format(parsed.error)
  return parsed.data.SITE_URL
}
