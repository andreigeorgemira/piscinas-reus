# Piscinas Reus — Design Document

Date: 2026-09-07
Status: Approved
Repository: https://github.com/andreigeorgemira/piscinas-reus

## 1. Context

A pool construction and maintenance company in Reus (Tarragona, Spain) needs a
public website and an internal tool to produce quotes.

End customers are private individuals, not companies. The company's daily work
is: receive an enquiry, quote it, and if accepted, build or maintain the pool.

The product has three audiences:

- **Visitors** looking for a pool builder. They arrive from Google.
- **Staff** (2-3 people) who write quotes and manage the price book.
- **Customers** who received a quote and want to review, adjust and accept it.

## 2. Goals

- Publish a bilingual (Spanish / Catalan) marketing site that ranks for local
  searches such as "piscinas Reus" or "mantenimiento piscinas Cambrils".
- Let staff assemble a quote from a reusable price book in a few minutes.
- Produce a PDF the company can send through any channel.
- Let a customer review the quote online, pick optional recommended extras,
  and accept it.
- Record enough history to answer "what did we do for this customer?"

## 3. Non-goals (this iteration)

- Invoicing, accounting, or tax reporting. Quotes carry no VAT breakdown.
- Work scheduling, crew assignment, or material stock control.
- Payments of any kind.
- A mobile application.
- Customer-visible project tracking with photos. Deferred; the data model
  leaves room for it.

## 4. Language conventions

All code, identifiers, database objects, comments, commit messages and
documentation are written in **English**. Only user-facing content is
translated (Spanish and Catalan).

This includes table names, column names, enum values and file names. The
domain vocabulary maps as follows:

| Domain (Spanish) | Code (English) |
| --- | --- |
| Presupuesto | Quote |
| Línea de presupuesto | Quote item |
| Tarifario | Price book |
| Cliente | Client |
| Proyecto | Project |
| Solicitud / Contacto | Lead |
| Recomendado | Recommended (optional extra) |

## 5. Architecture

A single Next.js 15 application (App Router, TypeScript, React Server
Components) backed by Supabase. Four zones:

| Zone | Route | Audience | Rendering |
| --- | --- | --- | --- |
| Marketing site | `/[locale]` | Public | Static / ISR |
| Admin dashboard | `/[locale]/admin` | `admin` role | Dynamic, server-rendered |
| Client portal | `/[locale]/portal` | `client` role | Dynamic, server-rendered |
| Public quote link | `/public-view/[token]` | Anonymous, token-bearing | Dynamic |

Rationale for one app instead of two: the marketing site and the dashboard
share the design system, the Supabase client, the i18n setup and the
deployment pipeline. Splitting them would triple the operational surface for
a three-person company.

### Trust boundary

**All authorization lives in PostgreSQL Row Level Security.** The React layer
decides what to *render*, never what a user is *allowed to read*. A tampered
client, a crafted API call or a leaked route still returns nothing the user
does not own.

The `service_role` key is used only for the account-linking trigger path and
never reaches the browser bundle.

### Directory layout

```
src/
  app/
    [locale]/
      (marketing)/          # landing, services, gallery, faq, contact
      admin/                # dashboard
      portal/               # client portal
    public-view/[token]/    # public quote view (one dynamic segment,
                            # not a directory per quote)
    api/
  components/
    ui/                     # design system primitives
    marketing/
    admin/
  lib/
    supabase/               # server, browser and middleware clients
    quotes/                 # totals calculation, reference generation
    pdf/
  i18n/
    messages/{es,ca}.json
supabase/
  migrations/               # versioned SQL
  seed.sql
docs/
```

## 6. Technology choices

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15, App Router | Server rendering for SEO; one deployment |
| Language | TypeScript, strict mode | |
| Database / Auth / Storage | Supabase (PostgreSQL) | RLS gives authorization at the data layer |
| Auth client | `@supabase/ssr` | Cookie-based sessions that work in RSC and middleware |
| Styling | Tailwind CSS v4 | |
| Admin components | shadcn/ui | Speed of use matters more than personality here |
| Marketing design | Bespoke, via `design-taste-frontend` | Must not read as a template |
| Tables | TanStack Table | Sorting, filtering, pagination on the quote list |
| Forms | React Hook Form + Zod | One schema validates client and server side |
| i18n | `next-intl` | Locale-prefixed routes, correct `hreflang` |
| PDF | `@react-pdf/renderer` | Runs in serverless; no Chromium binary |
| Email | Resend | Quote links and account invitations |
| Unit tests | Vitest | |
| End-to-end tests | Playwright | |
| Hosting | Vercel | |

## 7. Data model

Eight tables. Money is `numeric(12,2)`; quantities are `numeric(12,3)`.

```
clients ──┬── projects ──┐
          │              │
          └── quotes ────┘        (quotes.project_id is nullable)
                │
           quote_items ←── price_book_items ──── price_book_groups

profiles (role)                    leads
```

### Enumerated types

```sql
create type user_role     as enum ('admin', 'client');
create type quote_status  as enum ('draft', 'sent', 'accepted', 'rejected');
create type project_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type lead_status   as enum ('new', 'contacted', 'quoted', 'discarded');
create type unit_type     as enum ('m2', 'ml', 'unit', 'hour', 'kg', 'lot');
```

### `profiles`

One row per authenticated user, created by a trigger on `auth.users`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | references `auth.users(id)` on delete cascade |
| `role` | `user_role` | default `'client'`. Only an admin can change it |
| `full_name` | `text` | |
| `phone` | `text` | |
| `created_at` | `timestamptz` | default `now()` |

### `clients`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `user_id` | `uuid` null | references `auth.users(id)`. Null until the person registers |
| `email` | `citext` unique not null | The linking key |
| `full_name` | `text` not null | |
| `phone` | `text` | |
| `address` | `text` | |
| `city` | `text` | |
| `postal_code` | `text` | |
| `notes` | `text` | Internal. Never exposed to the client |
| `created_at` | `timestamptz` | |

`email` is `citext` so `Juan@Gmail.com` and `juan@gmail.com` are the same
person. A partial unique index on `user_id` prevents two client rows sharing
one account.

### `projects`

Created automatically when a quote is accepted. Never filled in by hand.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `client_id` | `uuid` not null | references `clients` |
| `reference` | `text` unique not null | `P-2026-0001` |
| `name` | `text` not null | |
| `status` | `project_status` | default `'pending'` |
| `start_date_planned` | `date` | Copied from the accepted quote |
| `end_date_actual` | `date` | |
| `address` | `text` | The site address, which may differ from the client's |
| `notes` | `text` | Internal |
| `created_at` | `timestamptz` | |

### `quotes`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `reference` | `text` unique not null | `Q-2026-0001` |
| `client_id` | `uuid` not null | references `clients` |
| `project_id` | `uuid` null | references `projects`. Set on acceptance |
| `title` | `text` not null | e.g. "Piscina 8x4 con gresite" |
| `status` | `quote_status` | default `'draft'` |
| `start_date_planned` | `date` | Expected start of work |
| `valid_until` | `date` | Shown on the PDF |
| `client_notes` | `text` | Terms and conditions shown to the client |
| `internal_notes` | `text` | **Never leaves the admin zone** |
| `access_token` | `text` unique not null | 32 random bytes, base64url |
| `sent_at` | `timestamptz` | |
| `responded_at` | `timestamptz` | Acceptance or rejection timestamp |
| `created_by` | `uuid` | references `auth.users` |
| `created_at` / `updated_at` | `timestamptz` | |

`reference` is generated by a database function using a per-year sequence, so
two staff members creating a quote at the same moment cannot collide.

### `quote_items`

Line items. **Every descriptive and monetary field is a copy, not a
reference.** Editing the price book must never rewrite a quote that has
already been sent.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `quote_id` | `uuid` not null | references `quotes` on delete cascade |
| `price_book_item_id` | `uuid` null | Provenance only. Nullable for free-text lines |
| `group_name` | `text` | Snapshot, used to group the PDF |
| `name` | `text` not null | Snapshot |
| `description` | `text` | Snapshot, editable per quote |
| `unit` | `unit_type` | Snapshot |
| `quantity` | `numeric(12,3)` not null | |
| `unit_cost` | `numeric(12,2)` | What it costs us. **Admin only** |
| `unit_price` | `numeric(12,2)` not null | What the client pays |
| `discount_pct` | `numeric(5,2)` | default `0`, range 0-100 |
| `tax_rate` | `numeric(5,2)` | default `0`. Reserved; not shown in the UI |
| `is_recommended` | `boolean` | default `false`. Excluded from the total |
| `client_selected` | `boolean` | default `false`. The client ticked this extra |
| `position` | `integer` not null | Display order |

### `price_book_groups` and `price_book_items`

The reusable catalogue: excavation, tiling, filtration, labour, chemicals.

`price_book_groups`: `id`, `name`, `position`.

`price_book_items`: `id`, `group_id`, `code` (unique), `name`, `description`,
`unit`, `unit_cost`, `unit_price`, `is_active`, `created_at`.

Both `unit_cost` and `unit_price` are entered by hand. There is no margin
calculation: the company sets both numbers directly.

### `leads`

Enquiries from the contact form and from the portal's "request a quote"
action.

`id`, `full_name`, `email`, `phone`, `message`, `service_type`, `source`
(`landing` or `portal`), `status` (`lead_status`), `client_id` (nullable, set
when converted), `locale`, `created_at`.

### Totals

Totals are **computed, never stored**, in a view named `quote_totals`. Storing
them invites drift between the stored number and the lines.

Per line, rounded to two decimals before summing:

```
line_total = round(quantity * unit_price * (1 - discount_pct / 100), 2)
```

Aggregated per quote:

| Field | Definition |
| --- | --- |
| `base_total` | Sum of `line_total` where `is_recommended = false` |
| `recommended_total` | Sum of `line_total` where `is_recommended = true` |
| `selected_extras_total` | Sum where `is_recommended` and `client_selected` |
| `grand_total` | `base_total + selected_extras_total` |
| `cost_total` | Sum of `quantity * unit_cost` where not recommended. **Admin only** |
| `margin` | `base_total - cost_total`. **Admin only** |

## 8. Security model

### Roles

`admin` reads and writes everything. `client` reads only rows tied to their
own `clients` row, and writes only the extras selection and the accept or
reject decision.

Registration is open: anyone may create an account to request a quote.

### Account linking

The link between an auth account and a client record is the **verified email
address**.

1. A person registers. Supabase sends a confirmation email.
2. **Email confirmation is mandatory.** Until `email_confirmed_at` is set, the
   account is linked to nothing and sees nothing.
3. On confirmation, an `after insert or update of email_confirmed_at on
   auth.users` trigger runs `security definer`:
   - If a `clients` row with that email exists and has `user_id is null`, it
     sets `user_id`.
   - Otherwise it inserts a new `clients` row for that email.
   - It also inserts the `profiles` row with role `'client'`.

This works retroactively and in both directions. Staff can quote an email
address that has no account; when that person registers months later, their
quotes are already waiting. Equally, someone can register first and be quoted
afterwards.

The security of this scheme rests entirely on email confirmation being
enabled. It is the single setting that must never be turned off.

Admin accounts are never created this way. A staff account is promoted by
setting `profiles.role = 'admin'` directly in Supabase.

### Row Level Security policies

RLS is enabled on every table. There is no permissive fallback policy.

Two helper functions, both `security definer` and `stable`:

```sql
is_admin()          -- current user's profile role is 'admin'
current_client_id() -- the clients.id owned by the current user, or null
```

| Table | `admin` | `client` | anonymous |
| --- | --- | --- | --- |
| `profiles` | all | own row, read only | none |
| `clients` | all | own row, read only | none |
| `projects` | all | own rows, read only | none |
| `quotes` | all | own rows, **status <> 'draft'**, read | none |
| `quote_items` | all | via view only (see below) | none |
| `price_book_*` | all | **none** | none |
| `leads` | all | insert only | insert only |

Three rules that must not be got wrong:

1. **Drafts are invisible.** A client sees a quote only once `status <>
   'draft'`. Half-written quotes never leak.
2. **Cost never leaves the building.** `quote_items` contains `unit_cost`.
   Its select policy admits `admin` only. Clients read `client_quote_items`,
   a view that omits `unit_cost`, `tax_rate` and `price_book_item_id`.

   The view is `security definer` (it must be: with `security_invoker = true`
   a client would hit the admin-only policy and get zero rows), so ownership
   is enforced *inside* the view definition rather than by the caller's
   policies:

   ```sql
   create view client_quote_items as
     select id, quote_id, group_name, name, description, unit,
            quantity, unit_price, discount_pct,
            is_recommended, client_selected, position
     from quote_items
     where quote_id in (
       select id from quotes
       where client_id = current_client_id()
         and status <> 'draft'
     );
   ```

   Column-level grants cannot solve this instead: `admin` and `client` are
   both the Supabase `authenticated` role, so a per-column grant would hide
   cost from staff too. `internal_notes`, `clients.notes` and the whole price
   book are withheld by the same view-shaped pattern.
3. **Token access is anonymous but narrow.** `/public-view/[token]` calls a single
   `security definer` function, `get_quote_by_token(p_token text)`, which
   returns the quote and its client-safe lines only when the token matches
   exactly and the status is not `draft`. The anonymous role gets no direct
   table access. Tokens are 32 random bytes and are compared in full.

### Client write permissions

A client may update exactly two things, through `security definer` functions
that validate ownership and status:

- `set_quote_extra(p_quote_id, p_item_id, p_selected)` — toggles
  `client_selected` on a recommended line, only while `status = 'sent'`.
- `respond_to_quote(p_quote_id, p_accepted)` — moves `sent` to `accepted` or
  `rejected`, stamps `responded_at`, and on acceptance creates the project row
  and links it. Rejects any other transition.

**A recipient who has no account can do both.** Otherwise the emailed link
would be a dead end and the whole point of it is lost. Each function therefore
has a token-bearing twin — `set_quote_extra_by_token(p_token, ...)` and
`respond_to_quote_by_token(p_token, ...)` — which authorizes on an exact token
match instead of on `current_client_id()`. Both paths share one internal
routine, so the status-transition rules cannot drift apart between them.

This is a deliberate trade: whoever holds the link can accept the quote. That
matches how the company works today, where a signed PDF returned by email
carries the same weight. The token is 32 random bytes, is never listed
anywhere, and grants access to exactly one quote.

Neither function accepts a status change on an already-answered quote, by
token or by session.

## 9. Key flows

### Enquiry to accepted quote

1. A visitor submits the contact form. A `leads` row is inserted. Anonymous
   insert is the only anonymous write allowed anywhere, and the endpoint is
   rate-limited and protected against spam.
2. An admin sees the lead in the dashboard and converts it: a `clients` row is
   created or matched by email, and a draft quote is opened.
3. The admin assembles lines from the price book: search, pick, set quantity,
   adjust the price for this job, optionally set a discount, and flag some
   lines as recommended extras.
4. The admin generates the PDF and marks the quote as sent, which stamps
   `sent_at` and produces the shareable link.
5. The client opens the link, or signs in to the portal. They tick the
   recommended extras they want and watch the total update.
6. The client accepts. The status changes, a project is created from the
   quote, and the admin sees it in the dashboard.

### Quote numbering

`Q-{year}-{sequence}`, zero-padded to four digits, allocated by a database
function so concurrent inserts cannot produce a duplicate. The sequence
restarts each year. Projects use `P-{year}-{sequence}`.

## 10. Internationalization

Locales `es` (default) and `ca`, with `next-intl`. Routes are prefixed:
`/es/...` and `/ca/...`. Marketing pages emit `hreflang` alternates and a
locale-aware sitemap.

Only the marketing site is translated in this iteration. The admin dashboard
ships in Spanish. Translating an internal tool used by three people is work
without a reader.

Message files live in `src/i18n/messages/{es,ca}.json` with a flat namespaced
key structure. No user content is stored per-locale; `leads.locale` records
which language the enquiry came in, so replies match.

## 11. PDF

### Storage

Nothing is stored. Vercel has no persistent filesystem, and a saved PDF would
eventually contradict the rows it came from. The document is rendered on every
request, server-side by `@react-pdf/renderer` in a route handler, from the
same totals logic as the screen.

That creates one hazard: a quote edited after it was sent would silently show
the client a different price through the same link. So **a quote is immutable
once `status = 'sent'`**. Line items reject writes in that state. To change a
sent quote, an admin explicitly returns it to `draft`, which invalidates the
link until it is sent again. This is enforced in the database, not the UI.

Supabase Storage is used only for gallery photographs on the marketing site.

### Content

The document contains: company header and
logo, quote reference and dates, client details, line items grouped by
`group_name` with quantity, unit price and line total, the base total, then a
clearly separated "Opciones recomendadas" block listing extras with their
individual prices and an explicit note that they are not included in the
total, followed by terms from `client_notes`.

No cost, margin or internal note ever reaches the PDF. A single shared
serializer builds the client-safe payload for the PDF, the portal and the
token page, so there is one place to audit rather than three.

## 12. Design direction

The marketing site is built with the `design-taste-frontend` skill. It must
not look like a generic contractor template: no stock hero with a blue
gradient, no three identical icon cards. Photography of real work carries the
page; the pool imagery is the product.

The admin dashboard optimizes for speed of entry: dense tables, keyboard-
friendly quote editing, no decorative motion. Consistency with the marketing
palette, but a different information density.

Accessibility is not a later pass. Colour contrast, focus states, form labels
and keyboard reachability are part of each component as it is written.

## 13. Testing

| Level | Tool | Coverage |
| --- | --- | --- |
| Unit | Vitest | Totals, discounts, rounding, extras selection, reference generation |
| Integration | Vitest + local Supabase | Each RLS policy, both allow and deny |
| End-to-end | Playwright | Sign in, build a quote, send, accept via token, portal view |

The rounding and discount arithmetic is where a defect costs the company
money, so it is specified by tests first.

One integration test is non-negotiable: **client A must not be able to read
any row belonging to client B**, asserted directly against the database for
every table.

## 14. Delivery phases

Each phase ends with a working, deployed application.

| Phase | Deliverable | Value on completion |
| --- | --- | --- |
| 0 | Next.js scaffold, Supabase clients, auth, middleware, CI | Deployable shell |
| 1 | Schema, enums, RLS, helper functions, seed data | Database ready and audited |
| 2 | Price book CRUD | Staff load their real prices |
| 3 | Clients, quotes list, quote editor | **Staff quote for real** |
| 4 | PDF generation | Quotes are sent by any channel |
| 5 | Public token link, extras selection, acceptance, email | Clients respond online |
| 6 | Client portal, registration, account linking, lead capture | Self-service |
| 7 | Bilingual marketing site, gallery, FAQ, SEO | Public launch |

Phase 3 is the point at which the tool replaces whatever the company uses
today. Phases 4 to 7 add reach, not capability.

## 15. Deferred, with room reserved

- VAT: `quote_items.tax_rate` exists and defaults to zero.
- Project tracking with photos for clients: `projects` and Supabase Storage
  are in place.
- A `commercial` role that cannot see cost: `profiles.role` is an enum and
  the cost-hiding view already exists.
- Quote revisions and expiry: `valid_until` is recorded but not enforced.
