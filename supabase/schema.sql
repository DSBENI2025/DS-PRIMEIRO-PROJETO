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

create extension if not exists btree_gist;

alter table public.businesses
  add column if not exists deposit_enabled boolean not null default false,
  add column if not exists deposit_percent integer not null default 50;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_deposit_percent_check'
  ) then
    alter table public.businesses
      add constraint businesses_deposit_percent_check
      check (deposit_percent between 10 and 100);
  end if;
end $$;

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id),
  professional_id uuid not null references public.professionals(id),
  appointment_id uuid null references public.appointments(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  service_price_cents integer not null check (service_price_cents >= 0),
  deposit_percent integer not null check (deposit_percent between 1 and 100),
  amount_cents integer not null check (amount_cents > 0),
  provider text not null default 'mercado_pago',
  provider_payment_id text unique,
  external_reference text unique not null,
  status text not null default 'pending'
    check (status in ('pending','approved','cancelled','expired','rejected','refunded','conflict')),
  qr_code text,
  ticket_url text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists booking_payment_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_booking_payment_id_key'
  ) then
    alter table public.appointments
      add constraint appointments_booking_payment_id_key
      unique (booking_payment_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_booking_payment_id_fkey'
  ) then
    alter table public.appointments
      add constraint appointments_booking_payment_id_fkey
      foreign key (booking_payment_id)
      references public.booking_payments(id)
      on delete set null;
  end if;
end $$;

create index if not exists booking_payments_provider_idx
on public.booking_payments (provider_payment_id);

create index if not exists booking_payments_slot_idx
on public.booking_payments (professional_id, start_time, end_time, status, expires_at);

alter table public.booking_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_no_overlap'
  ) then
    alter table public.appointments
      add constraint appointments_no_overlap
      exclude using gist (
        professional_id with =,
        tstzrange(start_time, end_time, '[)') with &&
      )
      where (status <> 'cancelled');
  end if;
end $$;

create or replace function public.create_booking_payment_hold(
  p_business_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_service_price_cents integer,
  p_deposit_percent integer,
  p_amount_cents integer,
  p_expires_at timestamptz,
  p_external_reference text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text, 0));

  update public.booking_payments
  set status = 'expired', updated_at = now()
  where professional_id = p_professional_id
    and status = 'pending'
    and expires_at <= now();

  if exists (
    select 1
    from public.appointments a
    where a.professional_id = p_professional_id
      and a.status <> 'cancelled'
      and a.start_time < p_end_time
      and a.end_time > p_start_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  if exists (
    select 1
    from public.booking_payments bp
    where bp.professional_id = p_professional_id
      and bp.status = 'pending'
      and bp.expires_at > now()
      and bp.start_time < p_end_time
      and bp.end_time > p_start_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  insert into public.booking_payments (
    business_id,
    service_id,
    professional_id,
    customer_name,
    customer_phone,
    customer_email,
    start_time,
    end_time,
    service_price_cents,
    deposit_percent,
    amount_cents,
    external_reference,
    expires_at
  )
  values (
    p_business_id,
    p_service_id,
    p_professional_id,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_start_time,
    p_end_time,
    p_service_price_cents,
    p_deposit_percent,
    p_amount_cents,
    p_external_reference,
    p_expires_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.finalize_booking_payment(
  p_provider_payment_id text,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.booking_payments%rowtype;
  v_appointment_id uuid;
begin
  select *
  into v_payment
  from public.booking_payments
  where provider_payment_id = p_provider_payment_id
  for update;

  if not found then
    raise exception 'booking_payment_not_found';
  end if;

  if v_payment.appointment_id is not null then
    return v_payment.appointment_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_payment.professional_id::text, 0));

  if exists (
    select 1
    from public.appointments a
    where a.professional_id = v_payment.professional_id
      and a.status <> 'cancelled'
      and a.start_time < v_payment.end_time
      and a.end_time > v_payment.start_time
  ) then
    update public.booking_payments
    set status = 'conflict', updated_at = now()
    where id = v_payment.id;

    raise exception 'slot_conflict_after_payment';
  end if;

  insert into public.appointments (
    business_id,
    service_id,
    professional_id,
    customer_name,
    customer_phone,
    customer_email,
    start_time,
    end_time,
    status,
    booking_payment_id
  )
  values (
    v_payment.business_id,
    v_payment.service_id,
    v_payment.professional_id,
    v_payment.customer_name,
    v_payment.customer_phone,
    v_payment.customer_email,
    v_payment.start_time,
    v_payment.end_time,
    'confirmed',
    v_payment.id
  )
  returning id into v_appointment_id;

  update public.booking_payments
  set
    status = 'approved',
    appointment_id = v_appointment_id,
    paid_at = p_paid_at,
    updated_at = now()
  where id = v_payment.id;

  return v_appointment_id;
end;
$$;

revoke all on public.booking_payments from anon, authenticated;
grant select, insert, update, delete on public.booking_payments to service_role;

revoke execute on function public.create_booking_payment_hold(
  uuid, uuid, uuid, text, text, text, timestamptz, timestamptz,
  integer, integer, integer, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.create_booking_payment_hold(
  uuid, uuid, uuid, text, text, text, timestamptz, timestamptz,
  integer, integer, integer, timestamptz, text
) to service_role;

revoke execute on function public.finalize_booking_payment(text, timestamptz)
from public, anon, authenticated;
grant execute on function public.finalize_booking_payment(text, timestamptz)
to service_role;

grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.professionals to authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;
grant select, update on public.appointments to authenticated;

grant select, insert, update, delete on public.oauth_states to service_role;
grant select, insert, update, delete on public.calendar_integrations to service_role;
grant select, insert, update, delete on public.subscriptions to service_role;
grant select, insert, update, delete on public.businesses to service_role;
grant select, insert, update, delete on public.services to service_role;
grant select, insert, update, delete on public.professionals to service_role;
grant select, insert, update, delete on public.business_hours to service_role;
grant select, insert, update, delete on public.appointments to service_role;

alter table public.oauth_states
  add column if not exists code_verifier_encrypted text;

create table if not exists public.mercadopago_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  seller_user_id text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mercadopago_integrations enable row level security;

revoke all on public.mercadopago_integrations from anon, authenticated;
grant select, insert, update, delete on public.mercadopago_integrations to service_role;

drop policy if exists "appointments_owner_update" on public.appointments;
create policy "appointments_owner_update"
on public.appointments for update
to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = appointments.business_id and b.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = appointments.business_id and b.owner_id = (select auth.uid())
  )
);

alter table public.businesses
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_reminder_minutes integer not null default 60,
  add column if not exists whatsapp_followup_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_whatsapp_reminder_minutes_check'
  ) then
    alter table public.businesses
      add constraint businesses_whatsapp_reminder_minutes_check
      check (whatsapp_reminder_minutes between 15 and 1440);
  end if;
end $$;

alter table public.appointments
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_consent_at timestamptz;

alter table public.booking_payments
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_consent_at timestamptz;

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid null references public.appointments(id) on delete cascade,
  booking_payment_id uuid null references public.booking_payments(id) on delete cascade,
  channel text not null default 'whatsapp',
  notification_type text not null
    check (notification_type in ('pix_pending','booking_confirmed','reminder','followup')),
  recipient text not null,
  provider_message_id text,
  status text not null
    check (status in ('processing','sent','failed','skipped')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_logs
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists notification_logs_appointment_once_idx
on public.notification_logs (appointment_id, notification_type)
where appointment_id is not null;

create unique index if not exists notification_logs_payment_once_idx
on public.notification_logs (booking_payment_id, notification_type)
where booking_payment_id is not null;

create index if not exists notification_logs_business_idx
on public.notification_logs (business_id, created_at desc);

alter table public.notification_logs enable row level security;
revoke all on public.notification_logs from anon, authenticated;
grant select, insert, update, delete on public.notification_logs to service_role;

create or replace function public.finalize_booking_payment(
  p_provider_payment_id text,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.booking_payments%rowtype;
  v_appointment_id uuid;
begin
  select *
  into v_payment
  from public.booking_payments
  where provider_payment_id = p_provider_payment_id
  for update;

  if not found then
    raise exception 'booking_payment_not_found';
  end if;

  if v_payment.appointment_id is not null then
    return v_payment.appointment_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_payment.professional_id::text, 0));

  if exists (
    select 1
    from public.appointments a
    where a.professional_id = v_payment.professional_id
      and a.status <> 'cancelled'
      and a.start_time < v_payment.end_time
      and a.end_time > v_payment.start_time
  ) then
    update public.booking_payments
    set status = 'conflict', updated_at = now()
    where id = v_payment.id;

    raise exception 'slot_conflict_after_payment';
  end if;

  insert into public.appointments (
    business_id,
    service_id,
    professional_id,
    customer_name,
    customer_phone,
    customer_email,
    start_time,
    end_time,
    status,
    booking_payment_id,
    whatsapp_opt_in,
    whatsapp_consent_at
  )
  values (
    v_payment.business_id,
    v_payment.service_id,
    v_payment.professional_id,
    v_payment.customer_name,
    v_payment.customer_phone,
    v_payment.customer_email,
    v_payment.start_time,
    v_payment.end_time,
    'confirmed',
    v_payment.id,
    v_payment.whatsapp_opt_in,
    v_payment.whatsapp_consent_at
  )
  returning id into v_appointment_id;

  update public.booking_payments
  set
    status = 'approved',
    appointment_id = v_appointment_id,
    paid_at = p_paid_at,
    updated_at = now()
  where id = v_payment.id;

  return v_appointment_id;
end;
$$;


create table if not exists public.professional_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, weekday)
);

create index if not exists professional_hours_professional_idx
on public.professional_hours (professional_id, weekday);

alter table public.professional_hours enable row level security;

drop policy if exists "professional_hours_owner_all" on public.professional_hours;
create policy "professional_hours_owner_all"
on public.professional_hours for all
to authenticated
using (
  exists (
    select 1
    from public.professionals p
    join public.businesses b on b.id = p.business_id
    where p.id = professional_hours.professional_id
      and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.professionals p
    join public.businesses b on b.id = p.business_id
    where p.id = professional_hours.professional_id
      and b.owner_id = auth.uid()
  )
);

grant select, insert, update, delete on public.professional_hours to authenticated;
grant select, insert, update, delete on public.professional_hours to service_role;


create or replace function public.create_booking_payment_hold(
  p_business_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_service_price_cents integer,
  p_deposit_percent integer,
  p_amount_cents integer,
  p_expires_at timestamptz,
  p_external_reference text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday integer;
  v_opens_at time;
  v_closes_at time;
  v_is_closed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text, 0));

  select timezone
  into v_timezone
  from public.businesses
  where id = p_business_id;

  if v_timezone is null then
    raise exception 'business_not_found';
  end if;

  v_local_start := p_start_time at time zone v_timezone;
  v_local_end := p_end_time at time zone v_timezone;
  v_weekday := extract(dow from v_local_start)::integer;

  select opens_at, closes_at, is_closed
  into v_opens_at, v_closes_at, v_is_closed
  from public.professional_hours
  where professional_id = p_professional_id
    and weekday = v_weekday;

  if not found then
    select opens_at, closes_at, is_closed
    into v_opens_at, v_closes_at, v_is_closed
    from public.business_hours
    where business_id = p_business_id
      and weekday = v_weekday;
  end if;

  if v_is_closed is true
     or v_opens_at is null
     or v_closes_at is null
     or v_local_start::date <> v_local_end::date
     or v_local_start::time < v_opens_at
     or v_local_end::time > v_closes_at then
    raise exception 'outside_working_hours';
  end if;

  update public.booking_payments
  set status = 'expired', updated_at = now()
  where professional_id = p_professional_id
    and status = 'pending'
    and expires_at <= now();

  if exists (
    select 1
    from public.appointments a
    where a.professional_id = p_professional_id
      and a.status <> 'cancelled'
      and a.start_time < p_end_time
      and a.end_time > p_start_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  if exists (
    select 1
    from public.booking_payments bp
    where bp.professional_id = p_professional_id
      and bp.status = 'pending'
      and bp.expires_at > now()
      and bp.start_time < p_end_time
      and bp.end_time > p_start_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  insert into public.booking_payments (
    business_id,
    service_id,
    professional_id,
    customer_name,
    customer_phone,
    customer_email,
    start_time,
    end_time,
    service_price_cents,
    deposit_percent,
    amount_cents,
    external_reference,
    expires_at
  )
  values (
    p_business_id,
    p_service_id,
    p_professional_id,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_start_time,
    p_end_time,
    p_service_price_cents,
    p_deposit_percent,
    p_amount_cents,
    p_external_reference,
    p_expires_at
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Allow one Google Calendar integration per professional while keeping
-- the existing business-level integration as fallback.

alter table public.oauth_states
  add column if not exists professional_id uuid
    references public.professionals(id) on delete cascade;

alter table public.calendar_integrations
  add column if not exists professional_id uuid
    references public.professionals(id) on delete cascade;

alter table public.calendar_integrations
  drop constraint if exists calendar_integrations_business_id_key;

create unique index if not exists calendar_integrations_business_default_unique
on public.calendar_integrations (business_id, provider)
where professional_id is null;

create unique index if not exists calendar_integrations_professional_unique
on public.calendar_integrations (professional_id, provider)
where professional_id is not null;

create index if not exists oauth_states_professional_idx
on public.oauth_states (professional_id)
where professional_id is not null;
