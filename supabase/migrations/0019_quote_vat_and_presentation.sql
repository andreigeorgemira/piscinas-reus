-- VAT on each quote, how each group of a quote is presented, and the totals
-- that follow from both.
--
-- 1. quotes.vat_rate. The rate a quote is charged at, copied from
--    company_settings.default_vat_rate (0018) when the quote is written and
--    then the quote's own: changing the setting never rewrites a sent quote.
--    Null means no VAT on the document -- which is what every quote written
--    before this migration said ("IVA no incluido"), so they keep saying it.
--
-- 2. quote_groups. A quote is printed in groups (quote_items.group_name), and
--    staff choose, per group, how much the client sees of it:
--      detailed    every line with its quantity, price and amount;
--      no_prices   every line with its quantity, and only the group's total;
--      total_only  the group's name and total, no lines at all.
--    The row also carries the group's place in the document. A group with no
--    row is detailed and sits where the catalogue order puts it. Rows are
--    keyed by the group's name, the same key the lines already use; renaming
--    goes through rename_quote_group so lines and settings move together.
--
--    "Hidden" is enforced here, not on the screen: the functions and views a
--    client reads return NO price for a line of a group that is not detailed,
--    and no line at all of a group shown as a total only. A client who calls
--    quote_by_token with their own token gets exactly what their page shows.
--    Optional extras are never hidden -- they are a choice with a price, and a
--    choice without its price is not one.
--
-- 3. quote_totals. Cost and margin now count the extras the client ticked:
--    the total did, the cost did not, so ticking an extra made the margin look
--    the whole price of the extra better than it was. And VAT: rate, amount,
--    total with VAT.

-- 1 ---------------------------------------------------------------------------

alter table public.quotes
  add column vat_rate numeric(5,2) check (vat_rate >= 0 and vat_rate <= 100);

comment on column public.quotes.vat_rate is
  'VAT percentage charged on this quote. Null: the document carries no VAT.';

-- 2 ---------------------------------------------------------------------------

create type quote_group_display as enum ('detailed', 'no_prices', 'total_only');

create table public.quote_groups (
  quote_id   uuid not null references public.quotes (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  position   integer not null default 0,
  display    quote_group_display not null default 'detailed',
  created_at timestamptz not null default now(),
  primary key (quote_id, name)
);

comment on table public.quote_groups is
  'How each group of a quote is presented to the client, and in what order. Keyed by quote_items.group_name.';

alter table public.quote_groups enable row level security;

create policy quote_groups_admin_all on public.quote_groups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.quote_groups from public, anon, authenticated;
grant select, insert, update, delete on public.quote_groups to authenticated, service_role;

/*
 * The presentation of a quote is part of the document, so it freezes with the
 * lines: a client reading a quote must not watch a group's prices vanish from
 * it. Same rule as quote_items_guard_status (0009), and the same allowance for
 * a quote that no longer exists -- that is the cascade of deleting it.
 */
create or replace function public.guard_quote_group_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status quote_status;
  v_quote  uuid := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
begin
  select status into v_status from public.quotes where id = v_quote;

  if v_status is null and tg_op = 'DELETE' then
    return old;
  end if;
  -- A settings row never changes quote: that would carry it off a frozen one.
  if tg_op = 'UPDATE' and new.quote_id is distinct from old.quote_id then
    raise exception 'A quote group cannot move to another quote.' using errcode = 'P0001';
  end if;
  if v_status is null then
    raise exception 'Quote % does not exist.', v_quote using errcode = 'P0001';
  end if;
  if v_status <> 'draft' then
    raise exception
      'Quote % is % and cannot be edited. Return it to draft first.', v_quote, v_status
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_quote_group_edit() from public, anon, authenticated;

create trigger quote_groups_guard_status
  before insert or update or delete on public.quote_groups
  for each row execute function public.guard_quote_group_edit();

/*
 * Renames a group of one quote: its lines and its settings, in one statement's
 * worth of transaction. Renaming onto a name the quote already uses merges the
 * two groups: the merged group keeps its own place, and the MORE RESTRICTIVE of
 * the two displays -- merging a group whose prices were hidden into one that
 * showed them must not put those prices in front of the client.
 *
 * p_from null is the quote's ungrouped lines (group_name is null).
 *
 * Invoker rights: RLS keeps it to staff, and the two guard triggers keep it to
 * drafts, exactly as if the two updates had been sent one by one.
 */
create or replace function public.rename_quote_group(
  p_quote_id uuid,
  p_from     text,
  p_to       text
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_to text := btrim(coalesce(p_to, ''));
begin
  if length(v_to) < 1 or length(v_to) > 80 then
    raise exception 'A group name has 1 to 80 characters.' using errcode = 'P0001';
  end if;

  if p_from is not distinct from v_to then
    return;
  end if;

  update public.quote_items
  set group_name = v_to
  where quote_id = p_quote_id
    and group_name is not distinct from p_from;

  if p_from is null then
    return;
  end if;

  if exists (select 1 from public.quote_groups where quote_id = p_quote_id and name = v_to) then
    -- The enum is declared from most to least shown, so greatest() is the
    -- stricter of the two.
    update public.quote_groups t
    set display = greatest(t.display, f.display)
    from public.quote_groups f
    where t.quote_id = p_quote_id and t.name = v_to
      and f.quote_id = p_quote_id and f.name = p_from;
    delete from public.quote_groups where quote_id = p_quote_id and name = p_from;
  else
    update public.quote_groups set name = v_to where quote_id = p_quote_id and name = p_from;
  end if;
end;
$$;

revoke all on function public.rename_quote_group(uuid, text, text) from public, anon, authenticated;
grant execute on function public.rename_quote_group(uuid, text, text) to authenticated;

-- 3 ---------------------------------------------------------------------------

/*
 * VAT on an amount, rounded once on the total the way an invoice does it.
 * Null rate: no VAT.
 */
create or replace function public.vat_amount(p_amount numeric, p_rate numeric)
returns numeric
language sql
immutable
as $$
  select case when p_rate is null then 0 else round(p_amount * p_rate / 100.0, 2) end;
$$;

revoke all on function public.vat_amount(numeric, numeric) from public, anon, authenticated;
grant execute on function public.vat_amount(numeric, numeric) to anon, authenticated;

-- Dropped and created again rather than replaced: columns change meaning, new
-- ones arrive, and nothing else depends on these three views.
drop view public.quote_totals;
drop view public.client_quote_totals;
drop view public.client_quote_items;

create view public.quote_totals
with (security_invoker = true) as
select
  q.id as quote_id,
  s.base_total,
  s.recommended_total,
  s.selected_extras_total,
  (s.base_total + s.selected_extras_total)::numeric(12,2) as grand_total,
  s.cost_total,
  (s.base_total + s.selected_extras_total - s.cost_total)::numeric(12,2) as margin,
  q.vat_rate,
  public.vat_amount(s.base_total + s.selected_extras_total, q.vat_rate)::numeric(12,2)
    as vat_total,
  (s.base_total + s.selected_extras_total
   + public.vat_amount(s.base_total + s.selected_extras_total, q.vat_rate))::numeric(12,2)
    as total_with_vat
from public.quotes q
cross join lateral (
  select
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where not i.is_recommended), 0)::numeric(12,2) as base_total,
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where i.is_recommended), 0)::numeric(12,2) as recommended_total,
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where i.is_recommended and i.client_selected), 0)::numeric(12,2)
             as selected_extras_total,
    -- What the work costs: the base, and the extras that are part of it now.
    coalesce(sum(round(i.quantity * i.unit_cost, 2))
             filter (where not i.is_recommended or i.client_selected), 0)::numeric(12,2)
             as cost_total
  from public.quote_items i
  where i.quote_id = q.id
) s;

-- Client-facing lines: the same rows as before, minus every price a group that
-- is not detailed keeps to itself.
create view public.client_quote_items as
select
  i.id,
  i.quote_id,
  i.group_name,
  i.name,
  i.description,
  i.unit,
  i.quantity,
  case when hidden.yes then null else i.unit_price end as unit_price,
  case when hidden.yes then null else i.discount_pct end as discount_pct,
  i.is_recommended,
  i.client_selected,
  i.position,
  case when hidden.yes then null
       else public.quote_item_total(i.quantity, i.unit_price, i.discount_pct) end as line_total
from public.quote_items i
left join public.quote_groups g
  on g.quote_id = i.quote_id and g.name = i.group_name
cross join lateral (
  select (not i.is_recommended and coalesce(g.display, 'detailed') <> 'detailed') as yes
) hidden
where not (not i.is_recommended and coalesce(g.display, 'detailed') = 'total_only')
  and i.quote_id in (
  select q.id
  from public.quotes q
  where q.client_id = public.current_client_id()
    and q.status <> 'draft'
);

create view public.client_quote_totals as
select
  t.quote_id,
  t.base_total,
  t.recommended_total,
  t.selected_extras_total,
  t.grand_total,
  q.vat_rate,
  public.vat_amount(t.grand_total, q.vat_rate)::numeric(12,2) as vat_total,
  (t.grand_total + public.vat_amount(t.grand_total, q.vat_rate))::numeric(12,2)
    as total_with_vat
from public.quotes q
join lateral (
  select
    q.id as quote_id,
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where not i.is_recommended), 0)::numeric(12,2) as base_total,
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where i.is_recommended), 0)::numeric(12,2) as recommended_total,
    coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
             filter (where i.is_recommended and i.client_selected), 0)::numeric(12,2)
             as selected_extras_total,
    (coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
              filter (where not i.is_recommended), 0)
     + coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
              filter (where i.is_recommended and i.client_selected), 0)
    )::numeric(12,2) as grand_total
  from public.quote_items i
  where i.quote_id = q.id
) t on true
where q.client_id = public.current_client_id()
  and q.status <> 'draft';

revoke all on public.quote_totals        from public, anon, authenticated;
revoke all on public.client_quote_items  from public, anon, authenticated;
revoke all on public.client_quote_totals from public, anon, authenticated;
grant select on public.quote_totals        to authenticated;
grant select on public.client_quote_items  to authenticated;
grant select on public.client_quote_totals to authenticated;

/*
 * The whole document behind a token, restated from 0015 with:
 *   - `company`: the letterhead (0018);
 *   - `vat_rate` and, in `totals`, `vat_total` and `total_with_vat`;
 *   - `groups`: the document's groups in order (as staff placed them, then by
 *     the lines' positions), each with its display and its subtotal. The
 *     subtotal comes from here because the lines of a group that is not
 *     detailed arrive without prices;
 *   - no price, discount or amount on a line of such a group, and no line at
 *     all of a group shown as a total only.
 *
 * Still null for a token that matches nothing and for a draft.
 */
create or replace function public.quote_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', q.id,
    'reference', q.reference,
    'title', q.title,
    'status', q.status,
    'start_date_planned', q.start_date_planned,
    'valid_until', q.valid_until,
    'client_notes', q.client_notes,
    'sent_at', q.sent_at,
    'responded_at', q.responded_at,
    'signed_name', q.signed_name,
    'signed_at', q.signed_at,
    'rejection_reason', q.rejection_reason,
    'vat_rate', q.vat_rate,
    'company', public.company_letterhead(),
    'client', case when c.id is null then null else jsonb_build_object(
      'full_name', c.full_name,
      'email', c.email,
      'address', c.address,
      'city', c.city,
      'postal_code', c.postal_code
    ) end,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', x.group_name,
        'display', x.display,
        'subtotal', x.subtotal
      ) order by x.placed nulls last, x.first_position, x.first_created)
      from (
        select
          i.group_name,
          coalesce(g.display, 'detailed') as display,
          sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))::numeric(12,2)
            as subtotal,
          g.position as placed,
          min(i.position) as first_position,
          min(i.created_at) as first_created
        from public.quote_items i
        left join public.quote_groups g
          on g.quote_id = i.quote_id and g.name = i.group_name
        where i.quote_id = q.id
          and not i.is_recommended
        group by i.group_name, g.display, g.position
      ) x
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'group_name', i.group_name,
        'name', i.name,
        'description', i.description,
        'unit', i.unit,
        'quantity', i.quantity,
        'unit_price', case when hidden.yes then null else i.unit_price end,
        'discount_pct', case when hidden.yes then null else i.discount_pct end,
        'is_recommended', i.is_recommended,
        'client_selected', i.client_selected,
        'line_total', case when hidden.yes then null
                           else public.quote_item_total(i.quantity, i.unit_price, i.discount_pct) end
      ) order by i.position, i.created_at)
      from public.quote_items i
      left join public.quote_groups g
        on g.quote_id = i.quote_id and g.name = i.group_name
      cross join lateral (
        select (not i.is_recommended and coalesce(g.display, 'detailed') <> 'detailed') as yes
      ) hidden
      where i.quote_id = q.id
        -- A group shown as a total only sends its total and nothing of its lines.
        and not (not i.is_recommended and coalesce(g.display, 'detailed') = 'total_only')
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'base_total', t.base_total,
      'recommended_total', t.recommended_total,
      'selected_extras_total', t.selected_extras_total,
      'grand_total', t.grand_total,
      'vat_total', public.vat_amount(t.grand_total, q.vat_rate)::numeric(12,2),
      'total_with_vat', (t.grand_total + public.vat_amount(t.grand_total, q.vat_rate))::numeric(12,2)
    )
  )
  from public.quotes q
  left join public.clients c on c.id = q.client_id
  cross join lateral (
    select
      coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
               filter (where not i.is_recommended), 0)::numeric(12,2) as base_total,
      coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
               filter (where i.is_recommended), 0)::numeric(12,2) as recommended_total,
      coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
               filter (where i.is_recommended and i.client_selected), 0)::numeric(12,2)
               as selected_extras_total,
      (coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
                filter (where not i.is_recommended), 0)
       + coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
                filter (where i.is_recommended and i.client_selected), 0)
      )::numeric(12,2) as grand_total
    from public.quote_items i
    where i.quote_id = q.id
  ) t
  where q.access_token = p_token
    and q.status <> 'draft';
$$;

revoke all on function public.quote_by_token(text) from public, anon, authenticated;
grant execute on function public.quote_by_token(text) to anon, authenticated;

/*
 * The drawn signature, for the client's own copy of what they signed.
 *
 * Kept out of quote_by_token on purpose: it can weigh 300 kB and the page
 * itself never draws it, so only the PDF asks. Only for an accepted quote --
 * there is nothing to show before that, and after a reopening there is nothing
 * left (0016).
 */
create or replace function public.quote_signature_by_token(p_token text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.signature_image
  from public.quotes q
  where q.access_token = p_token
    and q.status = 'accepted';
$$;

revoke all on function public.quote_signature_by_token(text) from public, anon, authenticated;
grant execute on function public.quote_signature_by_token(text) to anon, authenticated;
