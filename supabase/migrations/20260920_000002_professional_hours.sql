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
