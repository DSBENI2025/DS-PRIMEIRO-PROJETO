import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: appointment } = await supabase
      .from("appointments")
      .select(
        "id,business_id,service_id,professional_id,customer_name,customer_phone,customer_email,start_time,end_time,status,google_event_id,google_integration_id,services(name,duration_minutes),professionals(name)"
      )
      .eq("id", id)
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

    let professionalsQuery = supabase
      .from("professionals")
      .select("id,name,active")
      .eq("business_id", auth.business.id)
      .eq("active", true)
      .order("name");

    if (auth.role === "professional" && auth.professionalId) {
      professionalsQuery = professionalsQuery.eq(
        "id",
        auth.professionalId
      );
    }

    const { data: professionals, error } = await professionalsQuery;

    if (error) throw error;

    return NextResponse.json({
      appointment,
      professionals: professionals || [],
      canReschedule:
        appointment.status === "confirmed" &&
        new Date(appointment.start_time).getTime() > Date.now(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível carregar o agendamento." },
      { status: 500 }
    );
  }
}
