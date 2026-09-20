-- Audit and exact-delivery idempotency for Mercado Pago webhooks.

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercado_pago',
  event_key text not null,
  topic text,
  data_id text,
  request_id text,
  status text not null default 'processing'
    check (status in ('processing','processed','failed','ignored')),
  attempts integer not null default 1 check (attempts > 0),
  received_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  unique (provider, event_key)
);

create index if not exists webhook_events_status_idx
on public.webhook_events (provider, status, last_attempt_at desc);

create index if not exists webhook_events_data_idx
on public.webhook_events (provider, topic, data_id, received_at desc);

alter table public.webhook_events enable row level security;

revoke all on public.webhook_events from anon, authenticated;
grant select, insert, update, delete on public.webhook_events to service_role;
