-- The company's own details: who the quote is from, and how VAT is charged.
--
-- Until now "Piscinas Reus, Construcción y mantenimiento de piscinas, Reus,
-- Tarragona" was typed into the PDF, the public page and the email, and every
-- document said "IVA no incluido" whether it was or not. A quote is a
-- commercial document: it carries the issuer's legal name and tax id, and VAT
-- is either charged on it or explicitly left out.
--
-- One row, enforced by the primary key: `id` is a boolean that can only be
-- true. The row is created here so nothing ever has to handle its absence.
--
-- VAT is a DEFAULT. Each quote keeps its own rate (0019), copied from here when
-- it is created, so changing the setting never rewrites a quote already sent.
-- Null means "no VAT on this document": the figures are shown as they are and
-- the document says VAT is not included.

create table public.company_settings (
  id               boolean primary key default true check (id),
  trade_name       text not null default 'Piscinas Reus'
                     check (length(btrim(trade_name)) between 1 and 120),
  tagline          text check (length(tagline) <= 200),
  legal_name       text check (length(legal_name) <= 200),
  tax_id           text check (length(tax_id) <= 20),
  address          text check (length(address) <= 200),
  postal_code      text check (length(postal_code) <= 10),
  city             text check (length(city) <= 120),
  province         text check (length(province) <= 120),
  phone            text check (length(phone) <= 40),
  email            text check (length(email) <= 200),
  website          text check (length(website) <= 200),
  default_vat_rate numeric(5,2) default 21
                     check (default_vat_rate >= 0 and default_vat_rate <= 100),
  quote_footer     text check (length(quote_footer) <= 600),
  updated_at       timestamptz not null default now()
);

comment on table public.company_settings is
  'The issuer of every quote: legal and contact details, default VAT rate, document footer. Exactly one row.';
comment on column public.company_settings.default_vat_rate is
  'VAT percentage a new quote starts with. Null: new quotes carry no VAT.';

insert into public.company_settings (
  trade_name, tagline, city, province, default_vat_rate, quote_footer
) values (
  'Piscinas Reus',
  'Construcción y mantenimiento de piscinas',
  'Reus',
  'Tarragona',
  21,
  'Las cantidades pueden ajustarse tras el replanteo en obra; cualquier cambio se comunica antes de ejecutarlo.'
);

create trigger company_settings_touch_updated_at
  before update on public.company_settings
  for each row execute function public.touch_updated_at();

alter table public.company_settings enable row level security;

create policy company_settings_admin_all on public.company_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Read and update only: the row is never created or removed from the API.
revoke all on public.company_settings from public, anon, authenticated;
grant select, update on public.company_settings to authenticated;
grant select, insert, update, delete on public.company_settings to service_role;

/*
 * The part of the settings a client may see, as one JSON object.
 *
 * Everything on a quote's letterhead and nothing else -- the default VAT rate
 * is the office's business, the rate on THEIR quote is on the quote. Used by
 * quote_by_token (0019); not granted to anybody on its own.
 */
create or replace function public.company_letterhead()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'trade_name',   s.trade_name,
    'tagline',      s.tagline,
    'legal_name',   s.legal_name,
    'tax_id',       s.tax_id,
    'address',      s.address,
    'postal_code',  s.postal_code,
    'city',         s.city,
    'province',     s.province,
    'phone',        s.phone,
    'email',        s.email,
    'website',      s.website,
    'quote_footer', s.quote_footer
  )
  from public.company_settings s
  where s.id;
$$;

revoke all on function public.company_letterhead() from public, anon, authenticated;
