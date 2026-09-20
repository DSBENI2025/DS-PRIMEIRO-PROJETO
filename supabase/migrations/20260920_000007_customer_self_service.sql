-- Secure customer self-service links for appointments.

create table if not exists public.appointment_access_tokens (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  token_hash text not null unique,
  token_encrypted text not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_access_tokens_hash_idx
on public.appointment_access_tokens (token_hash)
where revoked_at is null;

alter table public.appointment_access_tokens enable row level security;

revoke all on public.appointment_access_tokens from anon, authenticated;
grant select, insert, update, delete on public.appointment_access_tokens to service_role;
