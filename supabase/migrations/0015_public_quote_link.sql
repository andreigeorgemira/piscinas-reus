-- The link a client opens without an account, and what they can do from it.
--
-- `quotes.access_token` has existed since 0001_core_schema.sql and nothing has
-- ever read it. This migration is what turns it into a door: four functions,
-- each taking the token as its only credential, and a place to keep the
-- signature the client leaves on the way through.
--
-- Why functions rather than policies. A policy needs something about the
-- CALLER to match on, and this caller is anonymous by design: `anon`, no
-- session, nothing but a URL somebody forwarded them. Handing `anon` a select
-- policy on quotes would mean "any anonymous reader may see rows whose token
-- they can name", which is only safe if the token never leaves the where
-- clause -- and a policy cannot promise that, because the query is written by
-- whoever calls PostgREST. A security definer function CAN: the token is an
-- argument, the row set is fixed inside the body, and the column list is
-- written here rather than by the caller.
--
-- What that means in practice, and what every function below holds to:
--
--   * A draft is never visible. Until a quote is sent it has no reader other
--     than the office.
--   * `unit_cost`, `internal_notes` and the margin never appear. The columns
--     are not in the select lists below, the same way they are not in
--     client_quote_items (0005_quote_totals.sql).
--   * The token identifies a DOCUMENT, not a person. Returning to draft mints
--     a new one (0013_quote_lifecycle.sql), which is what makes a forwarded
--     link stop working once the figures change.

-- Where the client's answer is kept. Nothing here is a signature in the legal
-- sense on its own; together they are the record of who pressed the button,
-- when, and from what -- which is what a quote acceptance is worth in a small
-- business, and more than an email reply proves today.
alter table public.quotes
  add column signed_name       text,
  add column signed_at         timestamptz,
  add column signed_user_agent text,
  -- A drawn signature, as a PNG data URL. Capped well under a megabyte: the pad
  -- on the public page draws at a fixed size, and a value past this is not a
  -- signature but somebody using the column as storage.
  add column signature_image   text
    constraint quotes_signature_image_size check (length(signature_image) <= 300000),
  add column rejection_reason  text;

comment on column public.quotes.signed_name is
  'What the client typed as their name when accepting from the public link.';
comment on column public.quotes.signature_image is
  'PNG data URL of the drawn signature, at most 300 kB.';

/*
 * The whole document, as the person holding the link may see it.
 *
 * One JSON object rather than three functions, because a quote is read in one
 * go and three round trips would each have to re-check the token. The shape is
 * the page's: the quote, its client, its lines in the order the editor left
 * them (`position`), and totals computed by the same arithmetic as everywhere
 * else (public.quote_item_total).
 *
 * Returns null for a token that matches nothing and for a quote still in
 * draft. Same answer for both on purpose: a caller must not be able to tell a
 * wrong token from one that is not ready.
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
    'client', case when c.id is null then null else jsonb_build_object(
      'full_name', c.full_name,
      'email', c.email,
      'address', c.address,
      'city', c.city,
      'postal_code', c.postal_code
    ) end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'group_name', i.group_name,
        'name', i.name,
        'description', i.description,
        'unit', i.unit,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'discount_pct', i.discount_pct,
        'is_recommended', i.is_recommended,
        'client_selected', i.client_selected,
        'line_total', public.quote_item_total(i.quantity, i.unit_price, i.discount_pct)
      ) order by i.position, i.created_at)
      from public.quote_items i
      where i.quote_id = q.id
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'base_total', t.base_total,
      'recommended_total', t.recommended_total,
      'selected_extras_total', t.selected_extras_total,
      'grand_total', t.grand_total
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

/*
 * The client ticking an optional extra.
 *
 * The one write a client has ever been allowed to make, and it was specified
 * before any screen could make it: guard_quote_item_edit (0009, restated in
 * 0011) lets exactly this through -- a change to `client_selected`, on a
 * recommended line, while the quote is sent -- and refuses anything else on the
 * same statement by comparing the rows as jsonb minus that one key.
 *
 * So this function does not re-implement that rule; it hands the write to the
 * trigger and lets it decide. What it adds is the token check and the column
 * list, neither of which a trigger can do.
 */
create or replace function public.set_quote_extra_by_token(
  p_token    text,
  p_item_id  uuid,
  p_selected boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id uuid;
begin
  select id into v_quote_id
  from public.quotes
  where access_token = p_token
    and status = 'sent';

  if v_quote_id is null then
    -- Not found, not sent, or already answered. One answer for all three: a
    -- caller learns nothing about a token that is not theirs.
    return false;
  end if;

  update public.quote_items
  set client_selected = p_selected
  where id = p_item_id
    and quote_id = v_quote_id
    and is_recommended;

  return found;
end;
$$;

/*
 * next_reference, restated: same rule, and SECURITY INVOKER so the rule can see
 * who it is applying to.
 *
 * It has refused anybody who is not staff since 0006_references.sql. Accepting
 * from the public link creates a project, `projects.reference` defaults to
 * next_reference('P'), and that call now arrives from inside
 * accept_quote_by_token -- a security definer function whose caller is `anon`.
 * It was refused, and the acceptance failed.
 *
 * The carve-out is the effective user not being one of the two API roles.
 * PostgREST connects as `authenticator` and switches with SET LOCAL ROLE for
 * every request, so a call that arrives from outside runs as `anon` or
 * `authenticated` -- and one that arrives from inside a SECURITY DEFINER
 * function of this schema runs as its owner instead. A caller cannot arrange
 * that for themselves: creating a definer function needs privileges neither API
 * role has.
 *
 * Two shapes were tried before this one and both were wrong, which is worth
 * recording. `current_user = 'postgres'` inside a definer function is always
 * true, so as a DEFINER function this check would have admitted everybody.
 * `current_user <> session_user` is always true under PostgREST, because
 * session_user is `authenticator` and current_user is the switched role -- it
 * admitted every caller too. Both were caught by the assertion in
 * tests/integration/references.test.ts, which is there precisely because a
 * guard that fails open looks exactly like a guard that works.
 *
 * Losing `security definer` costs nothing it was doing: writing
 * reference_counters is allowed for an admin by the policy in 0006, and inside
 * the definer chain the effective user is the tables' owner, for whom RLS does
 * not apply. The grant layer (execute to `authenticated` only) is untouched.
 *
 * Restated in full rather than patched, because 0006 is applied in production
 * and migrations are append-only there; this file is the live definition from
 * here on.
 */
create or replace function public.next_reference(p_prefix text)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_year  integer := extract(year from now())::integer;
  v_value integer;
begin
  if not (public.is_admin() or current_user not in ('anon', 'authenticated')) then
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

revoke all on function public.next_reference(text) from public, anon, authenticated;
grant execute on function public.next_reference(text) to authenticated;

/*
 * Acceptance, from the link.
 *
 * It ends where set_quote_status ends -- status accepted, responded_at stamped,
 * a project created from the quote -- and the shared half is delegated rather
 * than copied: this function checks the token, records the signature, and calls
 * set_quote_status() for the move itself. That function refuses an accept
 * without a client (0014_quote_without_client.sql), so a quote nobody put a name
 * on cannot become a project by being forwarded to somebody.
 *
 * SECURITY DEFINER is what lets an anonymous caller through, and it is also why
 * calling set_quote_status from here works at all: that function runs with
 * invoker rights, and the invoker inside this body is the definer (postgres),
 * not `anon`.
 *
 * Returns the project's reference, so the page can tell the client the work has
 * a number now.
 */
create or replace function public.accept_quote_by_token(
  p_token      text,
  p_name       text,
  p_signature  text default null,
  p_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id  uuid;
  v_reference text;
begin
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'A signature needs a name.' using errcode = 'P0001';
  end if;

  select id into v_quote_id
  from public.quotes
  where access_token = p_token
    and status = 'sent'
  for update;

  if v_quote_id is null then
    raise exception 'That link is not open for signing.' using errcode = 'P0001';
  end if;

  update public.quotes
  set signed_name       = btrim(p_name),
      signed_at         = now(),
      signature_image   = p_signature,
      signed_user_agent = left(coalesce(p_user_agent, ''), 400)
  where id = v_quote_id;

  v_reference := public.set_quote_status(v_quote_id, 'accepted');

  return v_reference;
end;
$$;

/*
 * The other answer. A quote nobody accepts is worth recording as rejected: it
 * is what turns "no news" into a decision, and the reason is the only thing the
 * office ever learns about why.
 */
create or replace function public.reject_quote_by_token(
  p_token  text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote_id uuid;
begin
  select id into v_quote_id
  from public.quotes
  where access_token = p_token
    and status = 'sent'
  for update;

  if v_quote_id is null then
    return false;
  end if;

  update public.quotes
  set rejection_reason = nullif(left(btrim(coalesce(p_reason, '')), 2000), '')
  where id = v_quote_id;

  perform public.set_quote_status(v_quote_id, 'rejected');

  return true;
end;
$$;

-- The grant layer, stated for every role as 0007_function_grants.sql and
-- 0010_table_grants.sql insist: these four are the only functions in this schema
-- an anonymous caller may execute, and they are the reason the token is a
-- credential rather than a column.
revoke all on function public.quote_by_token(text) from public, anon, authenticated;
grant execute on function public.quote_by_token(text) to anon, authenticated;

revoke all on function public.set_quote_extra_by_token(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_quote_extra_by_token(text, uuid, boolean)
  to anon, authenticated;

revoke all on function public.accept_quote_by_token(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.accept_quote_by_token(text, text, text, text)
  to anon, authenticated;

revoke all on function public.reject_quote_by_token(text, text)
  from public, anon, authenticated;
grant execute on function public.reject_quote_by_token(text, text) to anon, authenticated;
