-- A quote leaves the office when it is sent. From that moment its lines are
-- frozen, so the figure the client is looking at cannot change underneath
-- them. Returning the quote to draft reopens it and invalidates the link.
--
-- The one permitted change is client_selected, and only on a recommended
-- line while the quote is sent (docs/superpowers/specs/
-- 2026-09-07-piscinas-reus-design.md:394-395): that is the client ticking a
-- recommended extra, which is the whole point of the sent state. Comparing
-- the rows as jsonb minus that key is exact, and stays correct when columns
-- are added later.
--
-- quote_items has no updated_at column and carries no other row trigger
-- today, so this whole-row jsonb comparison has no firing-order hazard. If
-- an updated_at column and a touch_updated_at trigger (see
-- 0001_core_schema.sql) are ever added to this table, ordering becomes
-- load-bearing: quote_items_guard_status sorts alphabetically before
-- quote_items_touch_updated_at, so this guard would run first and see the
-- row before updated_at changes - correct, but by luck of trigger-name
-- ordering rather than by design. Whoever adds that trigger should read
-- this comment.
--
-- security definer and a pinned search_path, matching is_admin() and
-- current_client_id() in 0002_auth_helpers.sql: this function must see
-- public.quotes regardless of the calling session's RLS visibility into
-- that table. quotes_select_own was dropped in 0004_client_views.sql, so an
-- invoker-rights version of this function would see zero rows there for any
-- caller who is not an admin. Today that caller doesn't exist -
-- quote_items is admin-only (0003_rls_policies.sql) - but the day a
-- migration opens a non-admin write path onto quote_items, an
-- invoker-rights lookup would silently return v_status = null for that
-- caller, and null used to mean "allow". It no longer does; see below. The
-- pinned search_path stops a caller from shadowing public.quotes with a
-- table of their own and lying about its status.
create or replace function public.guard_quote_item_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status     quote_status;
  v_old_status quote_status;
begin
  if tg_op = 'DELETE' then
    select status into v_status from public.quotes where id = old.quote_id;

    -- A null parent on DELETE is the on-delete-cascade path, not an RLS
    -- artifact (this function is security definer) and not a bug: deleting
    -- a quote cascades to its items via `on delete cascade`, and the RI
    -- cascade fires this BEFORE DELETE trigger after the parent row is
    -- already gone from public.quotes in the same command, so the lookup
    -- above finds nothing. Deleting a whole quote is deliberately legal
    -- even once sent - the client's access token dies with it, so there is
    -- no silent price change left for a client to see - so this permits
    -- it, the same as an ordinary draft-quote delete.
    if v_status is null or v_status = 'draft' then
      return old;
    end if;

    raise exception
      'Quote % is % and cannot be edited. Return it to draft first.', old.quote_id, v_status
      using errcode = 'P0001';
  end if;

  -- INSERT or UPDATE from here down. A null parent can no longer be read as
  -- "not visible to me" now that this function runs security definer - it
  -- means the referenced quote genuinely does not exist, and must raise
  -- rather than fall through to the draft-quote fast path below.
  select status into v_status from public.quotes where id = new.quote_id;
  if v_status is null then
    raise exception 'Quote % does not exist.', new.quote_id using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and new.quote_id is distinct from old.quote_id then
    -- Reparenting a line moves it out of one quote and into another. On
    -- UPDATE, new.quote_id is never null, so checking only the new parent
    -- (as the very first version of this function did) never consults the
    -- old parent at all - a line can be pulled out of a sent quote into a
    -- draft one, passing the draft fast path below, and the sent quote's
    -- total silently drops. Both ends of the move must be draft.
    select status into v_old_status from public.quotes where id = old.quote_id;
    if v_old_status is null then
      raise exception 'Quote % does not exist.', old.quote_id using errcode = 'P0001';
    end if;

    if v_status = 'draft' and v_old_status = 'draft' then
      return new;
    end if;

    raise exception
      'Quote % is % and quote % is %; a line can only move between two draft quotes.',
      old.quote_id, v_old_status, new.quote_id, v_status
      using errcode = 'P0001';
  end if;

  if v_status = 'draft' then
    return new;
  end if;

  -- The one permitted change on a non-draft quote: the client ticking a
  -- recommended extra, and only while the quote is sent - not accepted or
  -- rejected, and not on a base (non-recommended) line. Comparing the rows
  -- as jsonb minus client_selected is exact: it refuses a price change
  -- smuggled into the same statement as the toggle, because removing only
  -- client_selected still leaves the changed price behind and the two
  -- sides no longer match.
  if tg_op = 'UPDATE'
     and v_status = 'sent'
     and old.is_recommended
     and (to_jsonb(new) - 'client_selected') = (to_jsonb(old) - 'client_selected')
  then
    return new;
  end if;

  raise exception
    'Quote % is % and cannot be edited. Return it to draft first.', new.quote_id, v_status
    using errcode = 'P0001';
end;
$$;

create trigger quote_items_guard_status
  before insert or update or delete on public.quote_items
  for each row execute function public.guard_quote_item_edit();

-- This function is never called directly by any role; it only runs as a
-- trigger on public.quote_items. Follows the explicit-roles pattern from
-- 0007_function_grants.sql (never a bare `from public`) rather than relying
-- on Supabase's default per-role grants to be absent.
revoke all on function public.guard_quote_item_edit() from public, anon, authenticated;
