-- Fixes a column-exposure flaw in migration 0003.
--
-- Row Level Security filters ROWS, not COLUMNS. clients_select_own,
-- projects_select_own and quotes_select_own granted the owning customer
-- SELECT on the entire row, and Supabase grants the `authenticated` role
-- table-level SELECT on every column. Nothing stopped a customer's own
-- session from doing `select('internal_notes')` on their own quote, or
-- `select('notes')` on their own client/project row — exactly the kind of
-- staff-only, margin/triage commentary those columns hold.
--
-- A column-level `revoke` cannot fix this. Staff and customers are both the
-- same Postgres role, `authenticated`; the only thing that tells them apart
-- is `profiles.role`, which policies can see but a plain GRANT/REVOKE
-- cannot. Revoking a column from `authenticated` would blind staff too.
--
-- The fix already exists in this schema for `quote_items.unit_cost`: give
-- the customer NO policy on the base table, and let them read through a
-- view that carries the ownership filter in its own body and simply omits
-- the internal column from its column list. This migration extends that
-- same pattern to `clients`, `projects` and `quotes`, so all four
-- customer-facing tables are governed by one rule instead of two.
--
-- Each view below is created WITHOUT `security_invoker = true`, i.e. it
-- keeps Postgres's default view behavior of running with the privileges
-- (and RLS exemption) of the view owner rather than the querying user. This
-- is not incidental, it is required: after step 1 drops the customer select
-- policies, the base tables are admin-only. A `security_invoker` view would
-- run the query as the customer, hit those admin-only policies, and return
-- nothing. Running as the (table-owning) definer bypasses RLS the same way
-- `public.is_admin()` and `public.current_client_id()` already do, which is
-- why the ownership check has to be re-implemented inside the view's WHERE
-- clause instead of being inherited from a table policy.
--
-- Every view below lists its columns explicitly rather than `select *`.
-- That is what makes the omission auditable: a column added to the base
-- table later does not silently appear to customers just because it exists.

-- 1. Remove the customer read policies on the base tables --------------------
-- After these drops, clients, projects, quotes, quote_items and the price
-- book are all admin-only at the table level. Customers read the first
-- three through the views created below.
drop policy clients_select_own on public.clients;
drop policy projects_select_own on public.projects;
drop policy quotes_select_own on public.quotes;

-- 2. Customer-facing views ----------------------------------------------------

-- client_quotes: every quotes column except internal_notes. The draft
-- exclusion from the old quotes_select_own policy is preserved here — it is
-- a separate security requirement (a half-written quote must never be
-- visible to the person it is being written for) and this view is now the
-- only path a customer has to their own quotes.
create view public.client_quotes as
select
  id,
  reference,
  client_id,
  project_id,
  title,
  status,
  start_date_planned,
  valid_until,
  client_notes,
  access_token,
  sent_at,
  responded_at,
  created_by,
  created_at,
  updated_at
from public.quotes
where client_id = public.current_client_id()
  and status <> 'draft';

-- client_projects: every projects column except notes.
create view public.client_projects as
select
  id,
  client_id,
  reference,
  name,
  status,
  start_date_planned,
  end_date_actual,
  address,
  created_at
from public.projects
where client_id = public.current_client_id();

-- client_profile: every clients column except notes.
create view public.client_profile as
select
  id,
  user_id,
  email,
  full_name,
  phone,
  address,
  city,
  postal_code,
  created_at
from public.clients
where user_id = auth.uid();

-- 3. Grants --------------------------------------------------------------
-- Customers only. Anonymous visitors have no session to own a row with, so
-- they get nothing on any of these views.
revoke all on public.client_quotes from anon, authenticated;
revoke all on public.client_projects from anon, authenticated;
revoke all on public.client_profile from anon, authenticated;

grant select on public.client_quotes to authenticated;
grant select on public.client_projects to authenticated;
grant select on public.client_profile to authenticated;

-- 4. Tighten the public lead-intake policy ------------------------------
-- `with check (true)` let an anonymous visitor set any column on insert,
-- including status (skipping triage) and client_id (attributing the lead to
-- an existing customer they don't own). Replace it with a check that pins
-- both to their only legitimate values for a fresh, unowned enquiry.
drop policy leads_insert_public on public.leads;

create policy leads_insert_public on public.leads
  for insert to anon, authenticated
  with check (status = 'new' and client_id is null);
