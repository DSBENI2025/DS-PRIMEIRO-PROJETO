-- Supabase advisor hardening and foreign-key indexes.

revoke execute on function public.business_role(uuid) from anon;
revoke execute on function public.business_professional_id(uuid) from anon;

create index if not exists appointment_history_actor_user_idx
on public.appointment_history (actor_user_id);

create index if not exists appointments_google_integration_idx
on public.appointments (google_integration_id);

create index if not exists appointments_service_idx
on public.appointments (service_id);

create index if not exists booking_payments_appointment_idx
on public.booking_payments (appointment_id);

create index if not exists booking_payments_business_idx
on public.booking_payments (business_id);

create index if not exists booking_payments_service_idx
on public.booking_payments (service_id);

create index if not exists oauth_states_business_idx
on public.oauth_states (business_id);

create index if not exists oauth_states_user_idx
on public.oauth_states (user_id);

create index if not exists schedule_blocks_created_by_idx
on public.schedule_blocks (created_by);

create index if not exists subscriptions_business_idx
on public.subscriptions (business_id);

create index if not exists team_invitations_invited_by_idx
on public.team_invitations (invited_by);

create index if not exists team_invitations_professional_idx
on public.team_invitations (professional_id);
