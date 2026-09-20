import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { deleteGoogleCalendarEvent } from "@/lib/google-calendar";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const appointmentId = String(body.appointmentId || "");

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Agendamento obrigatório." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id,business_id,professional_id,google_event_id,status")
      .eq("id", appointmentId)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    if (
      auth.role === "professional" &&
      appointment.professional_id !== auth.professionalId
    ) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    if (appointment.status === "cancelled") {
      return NextResponse.json({ cancelled: true });
    }

    if (appointment.google_event_id) {
      try {
        await deleteGoogleCalendarEvent(
          auth.business.id,
          appointment.google_event_id,
          appointment.professional_id
        );
      } catch (error) {
        console.error("Falha ao remover evento Google", error);
      }
    }

    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointment.id);

    if (error) throw error;

    return NextResponse.json({ cancelled: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao cancelar agendamento." },
      { status: 500 }
    );
  }
}
