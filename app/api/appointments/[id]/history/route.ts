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
        "id,business_id,professional_id,customer_name,start_time,end_time,status,services(name),professionals(name)"
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

    const [{ data: history, error }, { data: professionals }] =
      await Promise.all([
        supabase
          .from("appointment_history")
          .select(
            "id,event_type,actor_type,actor_user_id,metadata,created_at"
          )
          .eq("appointment_id", appointment.id)
          .eq("business_id", auth.business.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("professionals")
          .select("id,name")
          .eq("business_id", auth.business.id),
      ]);

    if (error) throw error;

    const actorIds = [
      ...new Set(
        (history || [])
          .map((item) => item.actor_user_id)
          .filter((value): value is string => Boolean(value))
      ),
    ];

    const actorEmails: Record<string, string> = {};

    await Promise.all(
      actorIds.map(async (userId) => {
        const { data } = await supabase.auth.admin.getUserById(userId);
        if (data.user?.email) {
          actorEmails[userId] = data.user.email;
        }
      })
    );

    const professionalNames = Object.fromEntries(
      (professionals || []).map((item) => [item.id, item.name])
    );

    return NextResponse.json(
      {
        appointment,
        history: (history || []).map((item) => ({
          ...item,
          actorEmail: item.actor_user_id
            ? actorEmails[item.actor_user_id] || null
            : null,
        })),
        professionalNames,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível carregar o histórico." },
      { status: 500 }
    );
  }
}
