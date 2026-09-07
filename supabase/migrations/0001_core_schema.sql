create extension if not exists citext;

create type user_role     as enum ('admin', 'client');
create type quote_status  as enum ('draft', 'sent', 'accepted', 'rejected');
create type project_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type lead_status   as enum ('new', 'contacted', 'quoted', 'discarded');
create type unit_type     as enum ('m2', 'ml', 'unit', 'hour', 'kg', 'lot');

-- One row per authenticated user. Populated by a trigger in migration 0006.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       user_role   not null default 'client',
  full_name  text,
  phone      text,
  created_at timestamptz not null default now()
);

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,
  email       citext not null unique,
  full_name   text   not null,
  phone       text,
  address     text,
  city        text,
  postal_code text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete restrict,
  reference          text not null unique,
  name               text not null,
  status             project_status not null default 'pending',
  start_date_planned date,
  end_date_actual    date,
  address            text,
  notes              text,
  created_at         timestamptz not null default now()
);

create table public.quotes (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,
  client_id          uuid not null references public.clients (id) on delete restrict,
  project_id         uuid references public.projects (id) on delete set null,
  title              text not null,
  status             quote_status not null default 'draft',
  start_date_planned date,
  valid_until        date,
  client_notes       text,
  internal_notes     text,
  access_token       text not null unique,
  sent_at            timestamptz,
  responded_at       timestamptz,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.price_book_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.price_book_items (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references public.price_book_groups (id) on delete set null,
  code        text unique,
  name        text not null,
  description text,
  unit        unit_type not null default 'unit',
  unit_cost   numeric(12,2) not null default 0,
  unit_price  numeric(12,2) not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Descriptive and monetary fields are snapshots, not references. Editing the
-- price book must never rewrite a quote that has already been sent.
create table public.quote_items (
  id                 uuid primary key default gen_random_uuid(),
  quote_id           uuid not null references public.quotes (id) on delete cascade,
  price_book_item_id uuid references public.price_book_items (id) on delete set null,
  group_name         text,
  name               text not null,
  description        text,
  unit               unit_type not null default 'unit',
  quantity           numeric(12,3) not null default 1 check (quantity >= 0),
  unit_cost          numeric(12,2) not null default 0,
  unit_price         numeric(12,2) not null default 0,
  discount_pct       numeric(5,2)  not null default 0
                       check (discount_pct >= 0 and discount_pct <= 100),
  tax_rate           numeric(5,2)  not null default 0
                       check (tax_rate >= 0 and tax_rate <= 100),
  is_recommended     boolean not null default false,
  client_selected    boolean not null default false,
  position           integer not null default 0,
  created_at         timestamptz not null default now()
);

create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        citext not null,
  phone        text,
  message      text,
  service_type text,
  source       text not null default 'landing',
  status       lead_status not null default 'new',
  client_id    uuid references public.clients (id) on delete set null,
  locale       text not null default 'es',
  created_at   timestamptz not null default now()
);

create index clients_user_id_idx        on public.clients (user_id);
create index projects_client_id_idx     on public.projects (client_id);
create index quotes_client_id_idx       on public.quotes (client_id);
create index quotes_status_idx          on public.quotes (status);
create index quotes_access_token_idx    on public.quotes (access_token);
create index quote_items_quote_id_idx   on public.quote_items (quote_id, position);
create index price_book_items_group_idx on public.price_book_items (group_id);
create index leads_status_idx           on public.leads (status, created_at desc);

-- Keeps updated_at honest without the application having to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();
