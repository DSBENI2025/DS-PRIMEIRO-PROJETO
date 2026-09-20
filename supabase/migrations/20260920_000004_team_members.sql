-- Team members, invitations and role-aware access.

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','professional')),
  professional_id uuid references public.professionals(id) on delete set null,
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id),
  check (
    (role = 'professional' and professional_id is not null)
    or role = 'admin'
  )
);

create unique index if not exists business_members_professional_unique
on public.business_members (professional_id)
where professional_id is not null and active = true;

create index if not exists business_members_user_idx
on public.business_members (user_id, active);

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','professional')),
  professional_id uuid references public.professionals(id) on delete cascade,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (role = 'professional' and professional_id is not null)
    or role = 'admin'
  )
);

create index if not exists team_invitations_business_idx
on public.team_invitations (business_id, created_at desc);

create index if not exists team_invitations_email_idx
on public.team_invitations (lower(email));

create or replace function public.business_role(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when b.owner_id = auth.uid() then 'owner'
    else (
      select bm.role
      from public.business_members bm
      where bm.business_id = b.id
        and bm.user_id = auth.uid()
        and bm.active = true
      limit 1
    )
  end
  from public.businesses b
  where b.id = p_business_id
$$;

create or replace function public.business_professional_id(p_business_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select bm.professional_id
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.user_id = auth.uid()
    and bm.active = true
    and bm.role = 'professional'
  limit 1
$$;

revoke all on function public.business_role(uuid) from public;
revoke all on function public.business_professional_id(uuid) from public;
grant execute on function public.business_role(uuid) to authenticated, service_role;
grant execute on function public.business_professional_id(uuid) to authenticated, service_role;

alter table public.business_members enable row level security;
alter table public.team_invitations enable row level security;

drop policy if exists "business_members_self_select" on public.business_members;
create policy "business_members_self_select"
on public.business_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.business_role(business_id) in ('owner','admin')
);

drop policy if exists "team_invitations_manage" on public.team_invitations;
create policy "team_invitations_manage"
on public.team_invitations for select
to authenticated
using (public.business_role(business_id) in ('owner','admin'));

drop policy if exists "businesses_member_select" on public.businesses;
create policy "businesses_member_select"
on public.businesses for select
to authenticated
using (public.business_role(id) is not null);

drop policy if exists "services_member_select" on public.services;
create policy "services_member_select"
on public.services for select
to authenticated
using (public.business_role(business_id) is not null);

drop policy if exists "services_admin_write" on public.services;
create policy "services_admin_write"
on public.services for all
to authenticated
using (public.business_role(business_id) in ('owner','admin'))
with check (public.business_role(business_id) in ('owner','admin'));

drop policy if exists "professionals_member_select" on public.professionals;
create policy "professionals_member_select"
on public.professionals for select
to authenticated
using (public.business_role(business_id) is not null);

drop policy if exists "professionals_admin_write" on public.professionals;
create policy "professionals_admin_write"
on public.professionals for all
to authenticated
using (public.business_role(business_id) in ('owner','admin'))
with check (public.business_role(business_id) in ('owner','admin'));

drop policy if exists "business_hours_member_select" on public.business_hours;
create policy "business_hours_member_select"
on public.business_hours for select
to authenticated
using (public.business_role(business_id) is not null);

drop policy if exists "business_hours_admin_write" on public.business_hours;
create policy "business_hours_admin_write"
on public.business_hours for all
to authenticated
using (public.business_role(business_id) in ('owner','admin'))
with check (public.business_role(business_id) in ('owner','admin'));

drop policy if exists "professional_hours_team_select" on public.professional_hours;
create policy "professional_hours_team_select"
on public.professional_hours for select
to authenticated
using (
  exists (
    select 1
    from public.professionals p
    where p.id = professional_hours.professional_id
      and public.business_role(p.business_id) is not null
  )
);

drop policy if exists "professional_hours_team_write" on public.professional_hours;
create policy "professional_hours_team_write"
on public.professional_hours for all
to authenticated
using (
  exists (
    select 1
    from public.professionals p
    where p.id = professional_hours.professional_id
      and (
        public.business_role(p.business_id) in ('owner','admin')
        or public.business_professional_id(p.business_id) = p.id
      )
  )
)
with check (
  exists (
    select 1
    from public.professionals p
    where p.id = professional_hours.professional_id
      and (
        public.business_role(p.business_id) in ('owner','admin')
        or public.business_professional_id(p.business_id) = p.id
      )
  )
);

drop policy if exists "appointments_team_select" on public.appointments;
create policy "appointments_team_select"
on public.appointments for select
to authenticated
using (
  public.business_role(business_id) in ('owner','admin')
  or (
    public.business_role(business_id) = 'professional'
    and professional_id = public.business_professional_id(business_id)
  )
);

drop policy if exists "appointments_team_update" on public.appointments;
create policy "appointments_team_update"
on public.appointments for update
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

grant select on public.business_members to authenticated;
grant select on public.team_invitations to authenticated;
grant select, insert, update, delete on public.business_members to service_role;
grant select, insert, update, delete on public.team_invitations to service_role;


drop policy if exists "businesses_admin_update" on public.businesses;
create policy "businesses_admin_update"
on public.businesses for update
to authenticated
using (public.business_role(id) = 'admin')
with check (public.business_role(id) = 'admin');
