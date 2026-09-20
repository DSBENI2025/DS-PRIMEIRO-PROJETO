import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    let professionalId =
      req.nextUrl.searchParams.get("professionalId") || null;

    if (auth.role === "professional") {
      if (!auth.professionalId) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }
      professionalId = auth.professionalId;
    }
    const supabase = getSupabaseAdmin();

    if (professionalId) {
      const { data: professional } = await supabase
        .from("professionals")
        .select("id")
        .eq("id", professionalId)
        .eq("business_id", auth.business.id)
        .maybeSingle();

      if (!professional) {
        return NextResponse.json(
          { error: "Profissional não encontrado." },
          { status: 404 }
        );
      }
    }

    let exactQuery = supabase
      .from("calendar_integrations")
      .select("id,provider,calendar_id,expires_at,updated_at,professional_id")
      .eq("business_id", auth.business.id)
      .eq("provider", "google");

    exactQuery = professionalId
      ? exactQuery.eq("professional_id", professionalId)
      : exactQuery.is("professional_id", null);

    const { data: exact } = await exactQuery.maybeSingle();

    let fallback = null;

    if (professionalId && !exact) {
      const result = await supabase
        .from("calendar_integrations")
        .select("id,provider,calendar_id,expires_at,updated_at")
        .eq("business_id", auth.business.id)
        .eq("provider", "google")
        .is("professional_id", null)
        .maybeSingle();

      fallback = result.data;
    }

    return NextResponse.json({
      connected: Boolean(exact),
      inherited: Boolean(!exact && fallback),
      effectiveConnected: Boolean(exact || fallback),
      integration: exact || fallback || null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao consultar Google Agenda." },
      { status: 500 }
    );
  }
}
