-- Everything a quote needs that the screen must not be trusted to supply:
-- its reference, its access token, and the rules for moving between statuses.
--
-- Until now `quotes.reference` and `quotes.access_token` were `not null` with
-- no default, so the only way to write a quote was to invent both in
-- application code. Both are load-bearing in a way a form field is not: the
-- reference is what the company calls the document out loud, and the token is
-- the whole authentication of the public link a client opens without signing
-- in (docs/superpowers/specs/2026-09-07-piscinas-reus-design.md, section 8).
-- A token minted in JavaScript is a token whose entropy depends on which
-- runtime happened to execute the action, and a reference allocated with a
-- separate round trip is a reference that can be allocated twice when the
-- insert that was meant to consume it fails. Both belong here.

-- 32 random bytes, base64url, matching what the spec asks of the public link.
--
-- Built from two UUIDs rather than pgcrypto's gen_random_bytes on purpose.
-- gen_random_uuid() lives in pg_catalog and resolves under any search_path;
-- gen_random_bytes() is pgcrypto, which Supabase installs into the
-- `extensions` schema, so it would only resolve if every function using it
-- widened its pinned search_path to include that schema. Pinning the path is
-- the pattern the rest of this schema follows (0002_auth_helpers.sql), and
-- widening it to reach one function is a worse trade than assembling the
-- bytes from a source that is always in scope. Two v4 UUIDs carry 122 random
-- bits each; stripped of their dashes and read as hex they are exactly the 32
-- bytes asked for.
--
-- translate() with three source characters and two replacements deletes the
-- third: '+' becomes '-', '/' becomes '_', and '=' padding is dropped. That
-- is base64url, so the token survives a URL, an email client and a copy-paste
-- out of a chat app without escaping.
create or replace function public.new_access_token()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select translate(
    encode(
      decode(
        replace(gen_random_uuid()::text, '-', '') ||
        replace(gen_random_uuid()::text, '-', ''),
        'hex'
      ),
      'base64'
    ),
    '+/=',
    '-_'
  );
$$;

revoke all on function public.new_access_token() from public, anon, authenticated;
grant execute on function public.new_access_token() to authenticated;

-- The defaults. A column default is only evaluated when the INSERT omits the
-- column, so every existing fixture that states its own reference and token
-- (tests/integration/*.test.ts) keeps working untouched, and so does any
-- service-role insert that supplies both.
--
-- Consequence worth stating: next_reference() refuses a caller who is not
-- staff (0006_references.sql), so a service-role insert that OMITS reference
-- now fails with 42501 rather than the older 23502 not-null violation.
-- Service role has no auth.uid() and is therefore not an admin. Fixtures that
-- want a reference allocated for them must run as a signed-in admin, which is
-- what the application always is.
--
-- Second consequence: references are allocated by the default expression,
-- which Postgres evaluates before the row is checked against RLS or any
-- constraint. A refused insert therefore burns a number and the sequence
-- shows a gap. Deliberate: a quote is not an invoice, gaps in Q-2026-nnnn
-- carry no legal meaning, and the alternative (allocate, then insert, then
-- compensate on failure) is a distributed transaction written in a Server
-- Action to protect a number nobody audits.
alter table public.quotes    alter column access_token set default public.new_access_token();
alter table public.quotes    alter column reference    set default public.next_reference('Q');
alter table public.projects  alter column reference    set default public.next_reference('P');

-- Moving a quote between statuses, with every side effect that move implies.
--
-- This is a function rather than four UPDATE statements in a Server Action
-- because two of the moves are not single writes: accepting a quote also
-- creates the project the work will be tracked as, and reopening one also
-- invalidates the link already in a client's hands. Half of either pair is
-- worse than neither half -- an accepted quote with no project is invisible
-- to the dashboard that lists work in progress, and a quote reopened without
-- rotating its token is a quote whose old link still renders numbers that are
-- being edited underneath the reader. A function makes each pair one
-- statement, so it either all happens or none of it does.
--
-- INVOKER rights, unlike is_admin() and guard_quote_item_edit(): the point is
-- that the caller's own policies apply. quotes_admin_all and
-- projects_admin_all (0003_rls_policies.sql) are what stop a client from
-- accepting their own quote, and a security definer version would bypass
-- exactly the check this function relies on. The `select ... into` below
-- therefore finds no row for a non-admin caller and raises "does not exist",
-- which is also the right answer for a quote id that is simply wrong: neither
-- caller learns which of the two it was.
--
-- The search_path is pinned anyway. Invoker rights do not protect against a
-- caller who prepends a schema of their own containing a table called
-- `quotes`; only the pin does.
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
  -- FOR UPDATE, so two staff members pressing "Aceptar" at the same moment
  -- cannot both find project_id null and create two projects for one quote.
  select * into v_quote
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote % does not exist.', p_quote_id using errcode = 'P0001';
  end if;

  -- Asking for the status it already has is a no-op, not an error: two clicks
  -- on the same button, or a reload that re-posts, must not raise. It returns
  -- the project reference all the same, because the caller wants to know what
  -- the quote looks like now, not what this call changed.
  if v_quote.status = p_status then
    select * into v_project from public.projects where id = v_quote.project_id;
    return v_project.reference;
  end if;

  -- Which moves exist. Returning to draft is always legal - it is how a
  -- mistake in a sent quote is corrected, and how a client who changed their
  -- mind is served. Everything else must pass through 'sent', because
  -- 'accepted' means a client accepted something, and nothing was sent to
  -- them from a draft.
  if not (
    p_status = 'draft'
    or (v_quote.status = 'draft' and p_status = 'sent')
    or (v_quote.status = 'sent' and p_status in ('accepted', 'rejected'))
  ) then
    raise exception 'A quote cannot go from % to %.', v_quote.status, p_status
      using errcode = 'P0001';
  end if;

  if p_status = 'draft' then
    -- The link dies here. quotes.access_token carries a unique constraint and
    -- nothing else, so the old value is simply replaced; whoever holds the old
    -- URL now gets nothing rather than a stale figure. sent_at and
    -- responded_at go with it: the quote has not been sent, in its current
    -- shape, to anybody.
    --
    -- project_id is deliberately left alone. If this quote was accepted and a
    -- project was created, that project exists in the world - materials
    -- ordered, dates promised - and reopening the paperwork does not undo it.
    update public.quotes
    set status       = 'draft',
        sent_at      = null,
        responded_at = null,
        access_token = public.new_access_token()
    where id = p_quote_id;

  elsif p_status = 'sent' then
    -- From here the lines are frozen: quote_items_guard_status (0009) refuses
    -- every write to a line whose quote is not draft. Nothing here enforces
    -- that; it is why the trigger exists.
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

    -- Acceptance is where a quote becomes work. The project carries its own
    -- reference (P-2026-nnnn, allocated by the default this migration adds),
    -- the quote's title as its name, and the address the client's record
    -- holds: staff quoting for a job at a second property overwrite it on the
    -- project, which is the row that then owns the address.
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

  -- A quote that already had a project keeps it, and the caller still wants
  -- its reference back: the screen prints "Proyecto P-2026-0004" beside the
  -- status whatever this particular call did.
  if v_project.id is null and v_quote.project_id is not null then
    select * into v_project from public.projects where id = v_quote.project_id;
  end if;

  return v_project.reference;
end;
$$;

revoke all on function public.set_quote_status(uuid, quote_status)
  from public, anon, authenticated;
grant execute on function public.set_quote_status(uuid, quote_status) to authenticated;
