create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  external_reference text unique not null,
  user_id uuid null,
  business_id uuid null,
  payer_email text not null,
  provider text not null default 'mercado_pago',
  provider_subscription_id text unique,
  status text not null default 'pending',
  checkout_url text,
  next_billing_date timestamptz,
  last_payment_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  phone text,
  timezone text not null default 'America/Recife',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_business_id_fkey'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_business_id_fkey
      foreign key (business_id) references public.businesses(id) on delete set null;
  end if;
end $$;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes between 10 and 480),
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  unique (business_id, weekday)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id),
  professional_id uuid not null references public.professionals(id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled','completed','no_show')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_email_idx on public.subscriptions (payer_email);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists businesses_owner_idx on public.businesses (owner_id);
create index if not exists services_business_idx on public.services (business_id);
create index if not exists professionals_business_idx on public.professionals (business_id);
create index if not exists appointments_business_idx on public.appointments (business_id, start_time);
create index if not exists appointments_professional_idx on public.appointments (professional_id, start_time);

alter table public.subscriptions enable row level security;
alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.professionals enable row level security;
alter table public.business_hours enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "subscriptions_own_select" on public.subscriptions;
create policy "subscriptions_own_select"
on public.subscriptions for select
to authenticated
using (
  user_id = auth.uid()
  or lower(payer_email) = lower(coalesce(auth.jwt()->>'email',''))
);

drop policy if exists "businesses_owner_all" on public.businesses;
create policy "businesses_owner_all"
on public.businesses for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "services_owner_all" on public.services;
create policy "services_owner_all"
on public.services for all
to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = services.business_id and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = services.business_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "professionals_owner_all" on public.professionals;
create policy "professionals_owner_all"
on public.professionals for all
to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = professionals.business_id and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = professionals.business_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "hours_owner_all" on public.business_hours;
create policy "hours_owner_all"
on public.business_hours for all
to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = business_hours.business_id and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = business_hours.business_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "appointments_owner_select" on public.appointments;
create policy "appointments_owner_select"
on public.appointments for select
to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = appointments.business_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "appointments_owner_update" on public.appointments;
create policy "appointments_owner_update"
on public.appointments for update
to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = appointments.business_id and b.owner_id = auth.uid()
  )
);

alter table public.appointments
  add column if not exists google_event_id text;

create table if not exists public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  provider text not null default 'google',
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  scope text,
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oauth_states_expiry_idx
on public.oauth_states (expires_at);

alter table public.oauth_states enable row level security;
alter table public.calendar_integrations enable row level security;
