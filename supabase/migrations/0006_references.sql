-- Atomic reference number generation.
--
-- Naming note: the task brief that specced this work was written before
-- 0004_client_views.sql (a security fix) and 0005_quote_totals.sql (the
-- previous task) were inserted ahead of it, so this migration is 0006
-- rather than the 0005 the brief names.
--
-- next_reference(p_prefix) hands out references like 'Q-2026-0001': prefix,
-- current year, four-digit sequence, reset per prefix per year via the
-- (prefix, year) primary key on reference_counters.
--
-- The insert ... on conflict do update ... returning below is a single
-- statement, and that is the whole point: PostgreSQL takes a row lock on
-- conflict, so concurrent callers queue on that lock rather than both
-- reading the same last_value before either writes. A read-then-write pair
-- (select last_value, then update) would let two concurrent callers read
-- the same value and hand out the same reference. Do not split this into
-- two statements.
create table public.reference_counters (
  prefix     text    not null,
  year       integer not null,
  last_value integer not null default 0,
  primary key (prefix, year)
);

alter table public.reference_counters enable row level security;

create policy reference_counters_admin_all on public.reference_counters
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.next_reference(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year  integer := extract(year from now())::integer;
  v_value integer;
begin
  if not public.is_admin() then
    raise exception 'Only staff may allocate references'
      using errcode = '42501';
  end if;

  insert into public.reference_counters (prefix, year, last_value)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year)
    do update set last_value = public.reference_counters.last_value + 1
  returning last_value into v_value;

  return p_prefix || '-' || v_year || '-' || lpad(v_value::text, 4, '0');
end;
$$;

revoke all on function public.next_reference(text) from public;
grant execute on function public.next_reference(text) to authenticated;
