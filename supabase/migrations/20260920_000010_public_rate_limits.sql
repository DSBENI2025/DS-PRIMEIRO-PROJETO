-- Persistent fixed-window rate limits for public APIs.

create table if not exists public.rate_limit_buckets (
  key_hash text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (key_hash, action, window_start)
);

create index if not exists rate_limit_buckets_expiry_idx
on public.rate_limit_buckets (expires_at);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;
grant select, insert, update, delete on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
begin
  if p_max_requests <= 0 or p_window_seconds <= 0 then
    raise exception 'invalid_rate_limit_config';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);

  delete from public.rate_limit_buckets
  where expires_at < v_now;

  insert into public.rate_limit_buckets (
    key_hash,
    action,
    window_start,
    request_count,
    expires_at
  )
  values (
    p_key_hash,
    p_action,
    v_window_start,
    1,
    v_window_end + make_interval(secs => p_window_seconds)
  )
  on conflict (key_hash, action, window_start)
  do update
    set request_count = public.rate_limit_buckets.request_count + 1
  returning request_count into v_count;

  allowed := v_count <= p_max_requests;
  remaining := greatest(p_max_requests - v_count, 0);
  retry_after := greatest(
    ceil(extract(epoch from (v_window_end - v_now)))::integer,
    1
  );

  return next;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
to service_role;
