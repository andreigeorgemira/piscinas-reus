-- Closes a grant-layer gap on the nine base tables, analogous to the one
-- 0007_function_grants.sql closed for functions.
--
-- Postgres needs two independent yeses before a row is touched: a table
-- privilege, and, once RLS is enabled, a policy. Plan 1 wrote the policies
-- (0003_rls_policies.sql) and never stated the privileges underneath them,
-- so both environments have been running on whatever privileges happened
-- to already be there - and they disagree.
--
-- Locally that "whatever happened to be there" is generous: the Supabase
-- development image carries a default-privileges rule (visible in
-- pg_default_acl: defaclrole = postgres, defaclnamespace = public,
-- defaclobjtype = 'r') that grants full DML on every new public-schema
-- TABLE directly to anon, authenticated and service_role at CREATE time -
-- as named-role grants, exactly like the defaclobjtype = 'f' rule
-- 0007_function_grants.sql documents for functions. So locally, anon has
-- held SELECT (and INSERT, UPDATE, DELETE) on public.profiles and every
-- other table since the moment each was created, stopped only by RLS -
-- one layer, where the rest of this schema deliberately uses two.
--
-- The hosted project carries no such rule. service_role has no privileges
-- on public tables there at all: a PATCH to /rest/v1/profiles with the
-- service role key returns `42501 permission denied for table profiles`
-- (recorded in .superpowers/sdd/2026-09-07-foundation/progress.md, "Finding
-- carried forward - hosted/local grant drift"). Neither environment states
-- its intent anywhere, so "explicit" and "accidentally matching" have been
-- indistinguishable up to this point.
--
-- As with functions, `revoke all on <table> from public` is not enough on
-- its own: the default-privileges rule records its grants against the
-- *named* roles (anon, authenticated, service_role), not against the
-- PUBLIC pseudo-role, so a revoke that only names `public` leaves those
-- grants untouched. Every role that should lose access must be named in
-- the revoke, exactly as 0007 does for functions.
--
-- The fix: revoke everything from public, anon and authenticated by name
-- on all nine base tables, then grant back only what should actually be
-- reachable, per role:
--   - authenticated and service_role: SELECT, INSERT, UPDATE, DELETE on
--     all nine tables. RLS (0003_rls_policies.sql) narrows what
--     `authenticated` actually sees and writes; this migration only states
--     the ceiling that RLS then works underneath.
--   - anon: INSERT only on public.leads, and nothing anywhere else. The
--     public contact form is the one anonymous write in this system
--     (leads_insert_public in 0003_rls_policies.sql already scoped this at
--     the policy layer); it must not be able to read a lead back either,
--     which also means it can never use `.insert(...).select()` - without
--     a SELECT grant, PostgREST cannot return the row it just wrote, insert
--     or not.
--
-- Views (0004_client_views.sql, 0005_quote_totals.sql) are untouched here:
-- they already revoke by naming anon and authenticated directly rather
-- than relying on `from public`, so the default-privileges gap never
-- applied to them (confirmed in 0007's header via
-- information_schema.role_table_grants).
revoke all on
  public.profiles,
  public.clients,
  public.projects,
  public.quotes,
  public.quote_items,
  public.price_book_groups,
  public.price_book_items,
  public.leads,
  public.reference_counters
from public, anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.clients,
  public.projects,
  public.quotes,
  public.quote_items,
  public.price_book_groups,
  public.price_book_items,
  public.leads,
  public.reference_counters
to authenticated, service_role;

grant insert on public.leads to anon;
