import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function localRecife(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(value + ":00-03:00");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("schedule_blocks")
      .select(
        "id,professional_id,start_time,end_time,reason,created_at,professionals(name)"
      )
      .eq("business_id", auth.business.id)
      .gte(
        "end_time",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
      .order("start_time");

    if (auth.role === "professional") {
      if (!auth.professionalId) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }

      query = query.or(
        "professional_id.is.null,professional_id.eq." + auth.professionalId
      );
    }

    const [blocksResult, professionalsResult] = await Promise.all([
      query,
      supabase
        .from("professionals")
        .select("id,name,active")
        .eq("business_id", auth.business.id)
        .eq("active", true)
        .order("name"),
    ]);

    if (blocksResult.error) throw blocksResult.error;
    if (professionalsResult.error) throw professionalsResult.error;

    return NextResponse.json({
      role: auth.role,
      professionalId: auth.professionalId,
      blocks: blocksResult.data || [],
      professionals: professionalsResult.data || [],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível carregar os bloqueios." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (auth.business.timezone !== "America/Recife") {
      return NextResponse.json(
        { error: "Fuso horário ainda não suportado nesta versão." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const start = localRecife(String(body.startLocal || ""));
    const end = localRecife(String(body.endLocal || ""));
    const reason = String(body.reason || "").trim().slice(0, 160);

    let professionalId =
      typeof body.professionalId === "string" && body.professionalId
        ? body.professionalId
        : null;

    if (auth.role === "professional") {
      if (!auth.professionalId) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }

      professionalId = auth.professionalId;
    }

    if (!start || !end || end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { error: "Informe um período válido." },
        { status: 400 }
      );
    }

    if (end.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "O bloqueio precisa terminar no futuro." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (professionalId) {
      const { data: professional } = await supabase
        .from("professionals")
        .select("id")
        .eq("id", professionalId)
        .eq("business_id", auth.business.id)
        .eq("active", true)
        .maybeSingle();

      if (!professional) {
        return NextResponse.json(
          { error: "Profissional não encontrado." },
          { status: 404 }
        );
      }
    }

    let appointmentsQuery = supabase
      .from("appointments")
      .select("id", { count: "exact" })
      .eq("business_id", auth.business.id)
      .neq("status", "cancelled")
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString());

    if (professionalId) {
      appointmentsQuery = appointmentsQuery.eq(
        "professional_id",
        professionalId
      );
    }

    const { count, error: conflictError } = await appointmentsQuery.limit(1);

    if (conflictError) throw conflictError;

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Existem atendimentos confirmados neste período. Reagende ou cancele antes de criar o bloqueio.",
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("schedule_blocks")
      .insert({
        business_id: auth.business.id,
        professional_id: professionalId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        reason: reason || null,
        created_by: auth.user.id,
      })
      .select("id,start_time,end_time")
      .single();

    if (error) throw error;

    return NextResponse.json({ block: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível criar o bloqueio." },
      { status: 500 }
    );
  }
}
