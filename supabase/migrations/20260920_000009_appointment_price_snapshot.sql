-- Immutable service price snapshot on appointments.

alter table public.appointments
  add column if not exists service_price_cents integer;

update public.appointments a
set service_price_cents = bp.service_price_cents
from public.booking_payments bp
where a.booking_payment_id = bp.id
  and a.service_price_cents is null;

update public.appointments a
set service_price_cents = s.price_cents
from public.services s
where a.service_id = s.id
  and a.service_price_cents is null;

update public.appointments
set service_price_cents = 0
where service_price_cents is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_service_price_cents_check'
  ) then
    alter table public.appointments
      add constraint appointments_service_price_cents_check
      check (service_price_cents >= 0);
  end if;
end $$;

alter table public.appointments
  alter column service_price_cents set not null;

create or replace function public.set_appointment_service_price_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.service_price_cents is null and new.booking_payment_id is not null then
    select bp.service_price_cents
    into new.service_price_cents
    from public.booking_payments bp
    where bp.id = new.booking_payment_id;
  end if;

  if new.service_price_cents is null then
    select s.price_cents
    into new.service_price_cents
    from public.services s
    where s.id = new.service_id;
  end if;

  if new.service_price_cents is null then
    new.service_price_cents := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_service_price_snapshot_before_insert
on public.appointments;

create trigger appointments_service_price_snapshot_before_insert
before insert on public.appointments
for each row
execute function public.set_appointment_service_price_snapshot();
