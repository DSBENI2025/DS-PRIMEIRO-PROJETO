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
