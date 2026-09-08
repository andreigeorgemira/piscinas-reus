-- A quote leaves the office when it is sent. From that moment its lines are
-- frozen, so the figure the client is looking at cannot change underneath
-- them. Returning the quote to draft reopens it and invalidates the link.
--
-- The one permitted change is client_selected: that is the client ticking a
-- recommended extra, which is the whole point of the sent state. Comparing
-- the rows as jsonb minus that key is exact, and stays correct when columns
-- are added later.
create or replace function public.guard_quote_item_edit()
returns trigger
language plpgsql
as $$
declare
  v_status quote_status;
  v_quote  uuid := coalesce(new.quote_id, old.quote_id);
begin
  select status into v_status from public.quotes where id = v_quote;

  if v_status is null or v_status = 'draft' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'client_selected') = (to_jsonb(old) - 'client_selected')
  then
    return new;
  end if;

  raise exception
    'Quote % is % and cannot be edited. Return it to draft first.', v_quote, v_status
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
