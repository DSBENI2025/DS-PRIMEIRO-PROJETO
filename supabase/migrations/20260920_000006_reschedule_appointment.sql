alter table public.appointments
  add column if not exists google_integration_id uuid
    references public.calendar_integrations(id) on delete set null;

-- Atomic appointment rescheduling with conflict and hold protection.

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_professional_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  select *
  into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'appointment_not_found';
  end if;

  if v_appointment.status <> 'confirmed' then
    raise exception 'appointment_not_reschedulable';
  end if;

  if p_start_time <= now() or p_end_time <= p_start_time then
    raise exception 'invalid_reschedule_time';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text, 0));

  if exists (
    select 1
    from public.schedule_blocks sb
    where sb.business_id = v_appointment.business_id
      and (sb.professional_id is null or sb.professional_id = p_professional_id)
      and sb.start_time < p_end_time
      and sb.end_time > p_start_time
  ) then
    raise exception 'schedule_blocked';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.id <> v_appointment.id
      and a.professional_id = p_professional_id
      and a.status <> 'cancelled'
      and a.start_time < p_end_time
      and a.end_time > p_start_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  if exists (
    select 1
    from public.booking_payments bp
    where bp.professional_id = p_professional_id
      and bp.status = 'pending'
      and bp.expires_at > now()
      and bp.start_time < p_end_time
      and bp.end_time > p_start_time
      and (
        v_appointment.booking_payment_id is null
        or bp.id <> v_appointment.booking_payment_id
      )
  ) then
    raise exception 'slot_unavailable';
  end if;

  update public.appointments
  set
    professional_id = p_professional_id,
    start_time = p_start_time,
    end_time = p_end_time
  where id = v_appointment.id;

  if v_appointment.booking_payment_id is not null then
    update public.booking_payments
    set
      professional_id = p_professional_id,
      start_time = p_start_time,
      end_time = p_end_time,
      updated_at = now()
    where id = v_appointment.booking_payment_id
      and status = 'approved';
  end if;

  return v_appointment.id;
end;
$$;

revoke execute on function public.reschedule_appointment(
  uuid, uuid, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.reschedule_appointment(
  uuid, uuid, timestamptz, timestamptz
) to service_role;
