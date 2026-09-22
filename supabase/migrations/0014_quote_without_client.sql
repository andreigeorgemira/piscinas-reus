-- A quote can be opened before anybody knows whose it is.
--
-- `quotes.client_id` has been `not null` since 0001_core_schema.sql, which
-- forced the order of a conversation: somebody rings, asks what a pool costs,
-- and the first thing the screen wanted was a client record. That is paperwork
-- standing in front of the work. Staff price the job first and put a name on it
-- when the name exists.
--
-- Nothing else has to change for it. The two client-facing views filter with
-- `where client_id = public.current_client_id()` (0004_client_views.sql,
-- 0005_quote_totals.sql), and a null never equals anything, so an unassigned
-- quote is invisible to every customer by the same rule that hides other
-- people's quotes -- it is not a new exception.
--
-- What does have to change is acceptance. A project is what a quote becomes on
-- acceptance and `projects.client_id` is `not null`: there is no such thing as
-- work for nobody. So the moment is pushed to the one place it can be refused
-- honestly, with a message that says what to do.
alter table public.quotes alter column client_id drop not null;

-- set_quote_status, restated with that one guard added. The rest of the body is
-- 0013_quote_lifecycle.sql unchanged; read that file for why the function
-- exists, why it runs with invoker rights and what each move does. Migrations
-- are append-only once applied, so the whole function comes along rather than
-- the difference.
create or replace function public.set_quote_status(
  p_quote_id uuid,
  p_status   quote_status
)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_quote   public.quotes;
  v_project public.projects;
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote % does not exist.', p_quote_id using errcode = 'P0001';
  end if;

  if v_quote.status = p_status then
    select * into v_project from public.projects where id = v_quote.project_id;
    return v_project.reference;
  end if;

  if not (
    p_status = 'draft'
    or (v_quote.status = 'draft' and p_status = 'sent')
    or (v_quote.status = 'sent' and p_status in ('accepted', 'rejected'))
  ) then
    raise exception 'A quote cannot go from % to %.', v_quote.status, p_status
      using errcode = 'P0001';
  end if;

  -- The new rule. It guards acceptance only: a quote with no client can be
  -- written, sent (by hand, on paper, to somebody who has not given their
  -- details yet) and rejected. Accepting is where it becomes work, and work
  -- belongs to somebody.
  if p_status = 'accepted' and v_quote.client_id is null then
    raise exception 'Quote % has no client and cannot be accepted.', p_quote_id
      using errcode = 'P0001';
  end if;

  if p_status = 'draft' then
    update public.quotes
    set status       = 'draft',
        sent_at      = null,
        responded_at = null,
        access_token = public.new_access_token()
    where id = p_quote_id;

  elsif p_status = 'sent' then
    update public.quotes
    set status       = 'sent',
        sent_at      = now(),
        responded_at = null
    where id = p_quote_id;

  else
    update public.quotes
    set status       = p_status,
        responded_at = now()
    where id = p_quote_id;

    if p_status = 'accepted' and v_quote.project_id is null then
      insert into public.projects (client_id, name, start_date_planned, address)
      select v_quote.client_id,
             v_quote.title,
             v_quote.start_date_planned,
             c.address
      from public.clients c
      where c.id = v_quote.client_id
      returning * into v_project;

      update public.quotes set project_id = v_project.id where id = p_quote_id;
    end if;
  end if;

  if v_project.id is null and v_quote.project_id is not null then
    select * into v_project from public.projects where id = v_quote.project_id;
  end if;

  return v_project.reference;
end;
$$;

revoke all on function public.set_quote_status(uuid, quote_status)
  from public, anon, authenticated;
grant execute on function public.set_quote_status(uuid, quote_status) to authenticated;
