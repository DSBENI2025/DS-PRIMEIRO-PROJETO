import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { notifyFollowup } from "@/lib/notifications";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const appointmentId = String(body.appointmentId || "");
    const status = String(body.status || "");

    if (!appointmentId || !["completed", "no_show"].includes(status)) {
      return NextResponse.json(
        { error: "Status inválido." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id,status,start_time,professional_id")
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

    if (new Date(appointment.start_time).getTime() > Date.now()) {
      return NextResponse.json(
        { error: "O horário ainda não aconteceu." },
        { status: 409 }
      );
    }

    if (appointment.status === "cancelled") {
      return NextResponse.json(
        { error: "Agendamento cancelado não pode ser concluído." },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appointmentId)
      .eq("business_id", auth.business.id);

    if (error) throw error;

    if (status === "completed") {
      try {
        await notifyFollowup(appointmentId);
      } catch (error) {
        console.error("Atendimento concluído, mas pós-atendimento falhou", error);
      }
    }

    return NextResponse.json({ updated: true, status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao atualizar agendamento." },
      { status: 500 }
    );
  }
}
