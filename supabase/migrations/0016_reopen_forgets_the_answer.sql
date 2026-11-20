-- Reopening a quote forgets what the client answered.
--
-- 0015_public_quote_link.sql gave a quote somewhere to keep the client's
-- answer -- signed_name, signed_at, signed_user_agent, signature_image,
-- rejection_reason -- but set_quote_status (last restated in
-- 0014_quote_without_client.sql) predates those columns and never clears them.
-- Neither does it clear `client_selected` on the extras.
--
-- So a quote accepted at one price, reopened, repriced and sent again still
-- carried the first signature, and the PDF printed "Presupuesto aceptado,
-- firmado por ..." under figures nobody had signed. A reopened quote is a new
-- version of the document, and a new version starts unanswered: no signature,
-- no reason for a refusal, and no extras ticked on the client's behalf.
--
-- What is NOT forgotten is the project an acceptance created: reopening the
-- paperwork does not undo the work (the screen says so before the move).
--
-- Restated in full, as every earlier restatement was: 0014 is applied in
-- production and migrations are append-only there.

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

  if p_status = 'accepted' and v_quote.client_id is null then
    raise exception 'Quote % has no client and cannot be accepted.', p_quote_id
      using errcode = 'P0001';
  end if;

  if p_status = 'draft' then
    update public.quotes
    set status            = 'draft',
        sent_at           = null,
        responded_at      = null,
        access_token      = public.new_access_token(),
        signed_name       = null,
        signed_at         = null,
        signed_user_agent = null,
        signature_image   = null,
        rejection_reason  = null
    where id = p_quote_id;

    -- After the status, not before: quote_items_guard_status (0009, restated in
    -- 0011) lets any write through on a draft, and refuses this one on a quote
    -- that is still accepted or rejected.
    update public.quote_items
    set client_selected = false
    where quote_id = p_quote_id
      and client_selected;

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
