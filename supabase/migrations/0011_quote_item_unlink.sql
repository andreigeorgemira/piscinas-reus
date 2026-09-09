-- Corrects guard_quote_item_edit() (0009_quote_immutability.sql), analogous
-- to how 0007_function_grants.sql and 0010_table_grants.sql each corrected
-- an earlier migration with a new one rather than editing it in place. 0009
-- is already applied on the hosted production database (Plan 1 shipped: PR
-- #1 was merged, and piscinas-reus.vercel.app is live on the schema that
-- migration produced). Supabase records applied migrations by version, so
-- an in-place edit to 0009's file would never run there -- it would only
-- ever apply locally, on a fresh `npx supabase db reset`, which is exactly
-- the hosted/local divergence class 0010's header already describes for
-- table grants. The fix belongs in a new, sequenced migration instead.
--
-- What 0009 does: freezes every quote_items row once its parent quote
-- leaves 'draft', so the figure a client is looking at cannot change
-- underneath them. It already carves out one exception -- the client
-- ticking a recommended extra (client_selected, only on a recommended line
-- while the quote is sent) -- by comparing the row as jsonb minus that one
-- key.
--
-- The concrete failure this migration fixes: quote_items.price_book_item_id
-- is `on delete set null` (0001_core_schema.sql). Postgres implements that
-- FK action as an ordinary `UPDATE quote_items SET price_book_item_id =
-- NULL ...`, which fires this same BEFORE UPDATE trigger like any other
-- edit -- and 0009's only carve-out does not cover this column changing. So
-- deleting a price_book_items row that had ever been copied onto a
-- non-draft quote's line raised P0001 and the whole DELETE failed. A
-- catalogue item, once used on any quote that was ever sent, accepted or
-- rejected, became permanently undeletable -- retiring it (is_active =
-- false) was the only option left, which is not what "delete" is supposed
-- to mean (src/app/admin/price-book/actions.ts, deleteItem).
--
-- Why the carve-out is safe: every descriptive and monetary field on
-- quote_items is already a snapshot, copied at the moment the line was
-- added, not a live reference (see the comment on quote_items in
-- 0001_core_schema.sql). price_book_item_id turning from an id into null
-- only loosens the pointer back to the catalogue; it cannot smuggle a price
-- or description change past this guard, because the jsonb-diff comparison
-- below still requires every other column to be byte-identical. That is
-- the same reasoning 0009's client_selected carve-out already relies on.
--
-- Why it applies at any non-draft status, unlike the client_selected
-- carve-out (which is 'sent' only): client_selected is a client-facing
-- action that only makes sense while a quote is still open for the client
-- to act on. Unlinking a deleted catalogue item is a staff-facing catalogue
-- operation with no such window -- a quote can sit 'sent', 'accepted' or
-- 'rejected' indefinitely, and the catalogue item behind one of its lines
-- must stay deletable throughout, since nothing about deleting it is able
-- to alter what the client has already seen.
--
-- Because this replaces the whole function body, the pre-existing
-- client_selected carve-out is restated verbatim below rather than lost.
-- Both are exercised by tests/integration/immutability.test.ts (the
-- 'still allows toggling the client extras selection' case pins
-- client_selected) and tests/integration/price-book.test.ts (the
-- 'deleting a price book item' block pins this one).
--
-- The trigger quote_items_guard_status (0009_quote_immutability.sql) binds
-- to this function by name and does not need recreating; `create or
-- replace function` swaps the body under it in place. Grants are likewise
-- untouched by a `create or replace` -- 0009's own
-- `revoke all on function public.guard_quote_item_edit() from public, anon,
-- authenticated` still holds and needs no restating.
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
    -- even once sent: it destroys the record rather than silently altering
    -- the figure under a client who is looking at it, which is what this
    -- guard exists to stop. It does not retire the access token, only frees
    -- it - quotes.access_token carries a unique constraint and nothing
    -- more, so a later quote could reuse the same token and a link already
    -- in a client's hands would then resolve to different numbers. That is
    -- a concern for whoever builds quote deletion in the admin UI, not for
    -- this trigger.
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
  --
  -- Side effect worth knowing: an orphan insert used to surface as the
  -- foreign key's own 23503 (PostgREST renders that as HTTP 409). This
  -- BEFORE trigger runs ahead of the FK check, so it now surfaces as P0001
  -- (HTTP 400). Nothing consumes the distinction today, but admin-UI code
  -- that special-cases foreign-key violations will not see one here.
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

  -- The one permitted change on a non-draft quote (restated verbatim from
  -- 0009_quote_immutability.sql): the client ticking a recommended extra,
  -- and only while the quote is sent - not accepted or rejected, and not on
  -- a base (non-recommended) line. Comparing the rows as jsonb minus
  -- client_selected is exact: it refuses a price change smuggled into the
  -- same statement as the toggle, because removing only client_selected
  -- still leaves the changed price behind and the two sides no longer
  -- match.
  if tg_op = 'UPDATE'
     and v_status = 'sent'
     and old.is_recommended
     and (to_jsonb(new) - 'client_selected') = (to_jsonb(old) - 'client_selected')
  then
    return new;
  end if;

  -- The second permitted change, added by this migration, at any
  -- non-draft status: a catalogue item being deleted unlinks this line's
  -- price_book_item_id via `on delete set null` and touches nothing else.
  -- Without this carve-out that cascading UPDATE hits this guard and
  -- raises, and the DELETE on price_book_items fails outright. See this
  -- file's header for why the transition is safe and why it is not
  -- restricted to 'sent' the way client_selected is.
  if tg_op = 'UPDATE'
     and old.price_book_item_id is not null
     and new.price_book_item_id is null
     and (to_jsonb(new) - 'price_book_item_id') = (to_jsonb(old) - 'price_book_item_id')
  then
    return new;
  end if;

  raise exception
    'Quote % is % and cannot be edited. Return it to draft first.', new.quote_id, v_status
    using errcode = 'P0001';
end;
$$;
