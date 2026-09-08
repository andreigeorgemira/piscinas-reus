-- Ties an auth account to a customer record by verified email address.
--
-- Numbering note: this was planned as migration 0006 (see
-- docs/superpowers/plans/2026-09-07-foundation.md, Task 9). Migrations
-- 0004_client_views.sql, 0005_quote_totals.sql and 0006_references.sql
-- claimed that number and the two after it first, for reasons recorded in
-- each of their own headers. This migration is 0008 instead. The stale
-- "Populated by a trigger in migration 0006" comment on public.profiles in
-- 0001_core_schema.sql is the same kind of leftover: migrations are
-- append-only once applied, so 0001 cannot be edited to fix it. This note
-- is the correction.
--
-- Runs when an account is created already confirmed, and when an existing
-- account becomes confirmed. Email confirmation is the entire basis of the
-- link: an unverified address proves nothing about who owns it, so the
-- function returns immediately when email_confirmed_at is null.
--
-- SECURITY: the role stored in public.profiles is hard-coded to 'client'
-- below and must stay that way. It is never read from
-- new.raw_user_meta_data or any other signup-supplied field.
-- raw_user_meta_data is attacker-controlled: it is whatever JSON payload
-- the caller of the signup endpoint chose to send. Deriving the role from
-- it would let anyone register with {"role":"admin"} in their metadata and
-- walk straight into the staff dashboard with access to every customer,
-- every quote and every cost figure. full_name is read from the same
-- metadata a few lines below, which is safe by contrast: it is a display
-- string with no access-control meaning, not a permission.
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

  -- Adopt a record staff created while quoting this address. clients.email
  -- is citext, so this comparison is already case-insensitive.
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

-- Grants: this function is never called directly by any role; it only
-- runs as a trigger on auth.users, which callers cannot write to except
-- through the auth API. Follows the explicit-roles pattern from
-- 0007_function_grants.sql (never a bare `from public`) rather than
-- relying on Supabase's default per-role grants to be absent.
revoke all on function public.handle_confirmed_user() from public, anon, authenticated;
