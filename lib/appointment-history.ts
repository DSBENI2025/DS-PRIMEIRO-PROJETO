import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Json } from "@/supabase/database.types";

export type AppointmentActor =
  | "owner"
  | "admin"
  | "professional"
  | "customer"
  | "system";

export type AppointmentEvent =
  | "created"
  | "rescheduled"
  | "cancelled"
  | "status_changed";

export async function recordAppointmentEvent(args: {
  appointmentId: string;
  businessId: string;
  eventType: AppointmentEvent;
  actorType: AppointmentActor;
  actorUserId?: string | null;
  eventKey?: string | null;
  metadata?: Json;
}) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("appointment_history")
    .insert({
      appointment_id: args.appointmentId,
      business_id: args.businessId,
      event_type: args.eventType,
      actor_type: args.actorType,
      actor_user_id: args.actorUserId || null,
      event_key: args.eventKey || null,
      metadata: args.metadata || {},
    });

  if (error?.code === "23505" && args.eventKey) {
    return;
  }

  if (error) throw error;
}
