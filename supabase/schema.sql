create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  external_reference text unique not null,
  user_id uuid null,
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

alter table public.subscriptions enable row level security;

create index if not exists subscriptions_email_idx
on public.subscriptions (payer_email);

create index if not exists subscriptions_status_idx
on public.subscriptions (status);
