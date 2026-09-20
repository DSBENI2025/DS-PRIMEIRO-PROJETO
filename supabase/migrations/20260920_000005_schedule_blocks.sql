-- Manual schedule blocks for breaks, time off and vacations.

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists schedule_blocks_business_time_idx
on public.schedule_blocks (business_id, start_time, end_time);

create index if not exists schedule_blocks_professional_time_idx
on public.schedule_blocks (professional_id, start_time, end_time)
where professional_id is not null;

alter table public.schedule_blocks enable row level security;

drop policy if exists "schedule_blocks_team_select" on public.schedule_blocks;
create policy "schedule_blocks_team_select"
on public.schedule_blocks for select
to authenticated
using (
  public.business_role(business_id) in ('owner','admin')
  or (
    public.business_role(business_id) = 'professional'
    and (
      professional_id is null
      or professional_id = public.business_professional_id(business_id)
    )
  )
);

drop policy if exists "schedule_blocks_team_write" on public.schedule_blocks;
create policy "schedule_blocks_team_write"
on public.schedule_blocks for all
to authenticated
using (
  public.business_role(business_id) in ('owner','admin')
  or (
    public.business_role(business_id) = 'professional'
    and professional_id = public.business_professional_id(business_id)
  )
)
with check (
  public.business_role(business_id) in ('owner','admin')
  or (
    public.business_role(business_id) = 'professional'
    and professional_id = public.business_professional_id(business_id)
  )
);

grant select, insert, update, delete on public.schedule_blocks to authenticated;
grant select, insert, update, delete on public.schedule_blocks to service_role;

create or replace function public.prevent_appointment_in_schedule_block()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status <> 'cancelled' and exists (
    select 1
    from public.schedule_blocks sb
    where sb.business_id = new.business_id
      and (sb.professional_id is null or sb.professional_id = new.professional_id)
      and sb.start_time < new.end_time
      and sb.end_time > new.start_time
  ) then
    raise exception 'schedule_blocked';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_schedule_block_guard on public.appointments;
create trigger appointments_schedule_block_guard
before insert or update of business_id, professional_id, start_time, end_time, status
on public.appointments
for each row
execute function public.prevent_appointment_in_schedule_block();

create or replace function public.prevent_booking_hold_in_schedule_block()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.schedule_blocks sb
    where sb.business_id = new.business_id
      and (sb.professional_id is null or sb.professional_id = new.professional_id)
      and sb.start_time < new.end_time
      and sb.end_time > new.start_time
  ) then
    raise exception 'schedule_blocked';
  end if;

  return new;
end;
$$;

drop trigger if exists booking_payments_schedule_block_guard on public.booking_payments;
create trigger booking_payments_schedule_block_guard
before insert
on public.booking_payments
for each row
execute function public.prevent_booking_hold_in_schedule_block();
