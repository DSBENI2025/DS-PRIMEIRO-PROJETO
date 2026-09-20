-- Appointment audit trail with actor attribution.

create table if not exists public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_type text not null
    check (event_type in ('created','rescheduled','cancelled','status_changed')),
  actor_type text not null
    check (actor_type in ('owner','admin','professional','customer','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists appointment_history_appointment_idx
on public.appointment_history (appointment_id, created_at desc);

create index if not exists appointment_history_business_idx
on public.appointment_history (business_id, created_at desc);

create unique index if not exists appointment_history_event_key_unique
on public.appointment_history (event_key)
where event_key is not null;

alter table public.appointment_history enable row level security;

drop policy if exists "appointment_history_team_select" on public.appointment_history;
create policy "appointment_history_team_select"
on public.appointment_history for select
to authenticated
using (
  public.business_role(business_id) in ('owner','admin')
  or (
    public.business_role(business_id) = 'professional'
    and exists (
      select 1
      from public.appointments a
      where a.id = appointment_history.appointment_id
        and a.professional_id = public.business_professional_id(business_id)
    )
  )
);

revoke insert, update, delete on public.appointment_history from anon, authenticated;
grant select on public.appointment_history to authenticated;
grant select, insert, update, delete on public.appointment_history to service_role;
