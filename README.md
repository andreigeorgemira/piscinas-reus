# Piscinas Reus

Marketing site, quoting dashboard and client portal for a pool construction and
maintenance company in Reus, Tarragona.

## Requirements

- Node 22
- Docker, for the local Supabase stack

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values
npx supabase start
npx supabase db reset        # applies every migration, then the seed
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

`npm run test:db` and `npm run test:e2e` need the local Supabase stack running.
Both pin `http://127.0.0.1:54321` in code, with no environment override, so
neither can reach the hosted project no matter what `.env.local` says.

The end-to-end suite starts its own dev server on port 3100 and builds into
`.next-e2e`, so it runs alongside a development server on port 3000 rather than
fighting it for Next's per-directory dev lock.

## Database

Migrations live in `supabase/migrations` and are applied in order. Never change
the schema through the Supabase dashboard: write a migration, apply it locally
with `npx supabase migration up`, and push it with `npx supabase db push`.

Row Level Security is the authorization layer, not a second line of defence
behind the application. Customers hold no policy on the base tables at all; they
read `security definer` views that name their columns explicitly, which is what
keeps internal notes and cost prices out of reach. A policy that returns a row
returns every column of it, so any new customer-facing read goes through a view.

## Documentation

- Design: `docs/superpowers/specs/2026-09-07-piscinas-reus-design.md`
- Plans: `docs/superpowers/plans/`
