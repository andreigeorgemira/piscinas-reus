-- Closes a grant-layer gap common to every earlier function migration in
-- this project.
--
-- Function privileges in Postgres come from two independent sources: the
-- implicit PUBLIC pseudo-role grant, and per-role grants recorded directly
-- in the object's ACL (pg_proc.proacl). Every function migration so far
-- (0002_auth_helpers.sql for is_admin/current_client_id,
-- 0006_references.sql for next_reference) followed the shape:
--
--   revoke all on function public.some_function(...) from public;
--   grant execute on function public.some_function(...) to <roles>;
--
-- on the assumption that the `revoke ... from public` fully locked the
-- function down before the `grant` reopened it deliberately. That
-- assumption is false on this project. Both the local and the hosted
-- Supabase Postgres instances carry a default-privileges rule (visible in
-- pg_default_acl: defaclrole = postgres, defaclnamespace = public,
-- defaclobjtype = 'f') that grants EXECUTE on every new public-schema
-- function directly to postgres, anon, authenticated and service_role at
-- CREATE time - as named-role grants, not as a PUBLIC grant. `revoke all
-- ... from public` only removes the PUBLIC pseudo-role's grant (which, for
-- these functions, was never even populated - the default privileges rule
-- replaces the ordinary "implicit PUBLIC EXECUTE" default). It does
-- nothing to a grant already recorded against a named role. So `anon` and
-- `authenticated` keep EXECUTE on a function regardless of a `revoke ...
-- from public` immediately after it, unless the per-role grant is also
-- revoked by name.
--
-- Verified empirically against the running local database (see
-- .superpowers/sdd/2026-09-07-foundation/task-8-report.md, "Fix round 1"
-- and "Fix round 2" for the queries and output): `pg_proc.proacl` for
-- `next_reference`, `is_admin` and `current_client_id` all list `anon`
-- despite each carrying a `revoke all ... from public`.
-- `quote_item_total` (0005_quote_totals.sql) never had a `from public`
-- revoke at all, and turned out to be directly executable by the PUBLIC
-- pseudo-role too, in addition to anon/authenticated.
--
-- The views created in 0004_client_views.sql and 0005_quote_totals.sql do
-- not have this problem: they revoke with `revoke all on <view> from
-- anon, authenticated` - naming the roles directly, not `from public` -
-- so the same default-privileges gap does not apply to them. Confirmed by
-- querying information_schema.role_table_grants for every customer-facing
-- view (see the report): none grant anything to `anon`.
--
-- The fix below: revoke explicitly from `public`, `anon` and
-- `authenticated` by name (never relying on `from public` alone), then
-- grant back only what should actually be callable by whom.

-- is_admin() / current_client_id() (0002_auth_helpers.sql): the current,
-- already-in-place anon + authenticated access is correct and stays.
-- Both are called from RLS policies and from definer-rights view bodies,
-- and both return a safe answer (false / null) to an anonymous caller.
-- Restated explicitly here (rather than left to rely on the default
-- privileges happening to already match) so the intended state is on
-- record in one place.
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

revoke all on function public.current_client_id() from public, anon, authenticated;
grant execute on function public.current_client_id() to anon, authenticated;

-- quote_item_total (0005_quote_totals.sql): pure arithmetic, touches no
-- table, so anon access was never exploitable. But it is only ever called
-- from inside quote_totals, client_quote_items and client_quote_totals,
-- none of which anon can read - so anon calling it directly serves no
-- purpose. Tightened to authenticated only, for consistency with the rest
-- of this schema.
revoke all on function public.quote_item_total(numeric, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.quote_item_total(numeric, numeric, numeric)
  to authenticated;

-- next_reference (0006_references.sql): staff only. This is the finding's
-- concrete case - anon had EXECUTE via the default-privileges gap above,
-- and was only stopped from actually allocating a reference by the
-- is_admin() check inside the function body. That runtime check stays
-- (defence in depth: both layers, not one replacing the other), but the
-- grant layer must independently refuse anon too.
revoke all on function public.next_reference(text) from public, anon, authenticated;
grant execute on function public.next_reference(text) to authenticated;

-- touch_updated_at (0001_core_schema.sql): a trigger function, fired by
-- `before update on quotes`, never invoked directly by a caller. No role
-- needs EXECUTE on it. 0001 never granted or revoked anything on it, so it
-- has carried the default postgres/anon/authenticated/service_role EXECUTE
-- grant since the moment it was created.
revoke all on function public.touch_updated_at() from public, anon, authenticated;
