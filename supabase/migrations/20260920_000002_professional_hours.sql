-- Professional-specific working hours with fallback to business hours.

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
