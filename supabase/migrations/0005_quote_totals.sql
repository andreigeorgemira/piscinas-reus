-- Quote totals and client-safe line items.
--
-- Naming note: this was planned as migration 0004, but a security review
-- (see 0004_client_views.sql) claimed that number first to fix a
-- column-exposure flaw in 0003. This migration is 0005 instead.
--
-- That also means the comment on quote_items_admin_all in 0003 is now
-- stale: it says clients "read through the client_quote_items view instead
-- (migration 0004)". client_quote_items does not live in 0004 — it is
-- created below, in 0005. Migrations are append-only once applied, so 0003
-- cannot be edited to fix the comment; this note is the correction.
--
-- Two views read quote_items, with deliberately different security modes:
--
-- * quote_totals is admin-facing and uses `security_invoker = true`. The
--   query runs as the caller, so the caller's own RLS policy on quote_items
--   applies: an admin passes quote_items_admin_all and sees every row
--   (cost included); anyone else has no policy at all on quote_items and
--   sees nothing. Cost and margin are safe here for exactly that reason.
--
-- * client_quote_items is customer-facing and is deliberately security
--   definer (the default — no `security_invoker`), exactly like
--   client_quotes, client_projects and client_profile in 0004. With
--   security_invoker = true it would run as the customer, hit the
--   admin-only policy on quote_items, and return nothing. Running as the
--   definer bypasses RLS, so the ownership filter (and the draft
--   exclusion) is reimplemented inside the view body instead of being
--   inherited from a table policy. The column list omits unit_cost
--   entirely, which is what keeps cost invisible to customers even though
--   they share the `authenticated` role with staff.
--
-- client_quote_totals is the customer-facing counterpart of quote_totals:
-- same arithmetic, minus cost_total and margin.

-- Line arithmetic, defined once so the view, the PDF and the screen can never
-- disagree. Rounded per line before summing, matching how a person adds up an
-- invoice on paper.
create or replace function public.quote_item_total(
  p_quantity numeric,
  p_unit_price numeric,
  p_discount_pct numeric
)
returns numeric
language sql
immutable
as $$
  select round(p_quantity * p_unit_price * (1 - p_discount_pct / 100.0), 2);
$$;

-- Admin-facing totals. security_invoker means the caller's own policies on
-- quote_items apply, so only an admin gets rows. Cost and margin are safe
-- here for exactly that reason.
create view public.quote_totals
with (security_invoker = true) as
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
  )::numeric(12,2) as grand_total,
  coalesce(sum(round(i.quantity * i.unit_cost, 2))
           filter (where not i.is_recommended), 0)::numeric(12,2) as cost_total,
  (coalesce(sum(public.quote_item_total(i.quantity, i.unit_price, i.discount_pct))
            filter (where not i.is_recommended), 0)
   - coalesce(sum(round(i.quantity * i.unit_cost, 2))
            filter (where not i.is_recommended), 0)
  )::numeric(12,2) as margin
from public.quotes q
left join public.quote_items i on i.quote_id = q.id
group by q.id;

-- Client-facing line items.
--
-- This view is deliberately security definer (the default). With
-- security_invoker = true it would be evaluated under the caller's own
-- permissions, hit the admin-only policy on quote_items and return nothing.
-- Ownership is therefore enforced inside the view body instead.
--
-- Column-level grants are not an alternative: admins and clients are both the
-- `authenticated` role, so revoking a column would hide cost from staff too.
create view public.client_quote_items as
select
  i.id,
  i.quote_id,
  i.group_name,
  i.name,
  i.description,
  i.unit,
  i.quantity,
  i.unit_price,
  i.discount_pct,
  i.is_recommended,
  i.client_selected,
  i.position,
  public.quote_item_total(i.quantity, i.unit_price, i.discount_pct) as line_total
from public.quote_items i
where i.quote_id in (
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
  t.grand_total
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

revoke all on public.quote_totals         from anon, authenticated;
revoke all on public.client_quote_items   from anon, authenticated;
revoke all on public.client_quote_totals  from anon, authenticated;

grant select on public.quote_totals        to authenticated;
grant select on public.client_quote_items  to authenticated;
grant select on public.client_quote_totals to authenticated;

grant execute on function public.quote_item_total(numeric, numeric, numeric)
  to anon, authenticated;
