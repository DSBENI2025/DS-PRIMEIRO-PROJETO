import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data } = await supabase
      .from("calendar_integrations")
      .select("id,provider,calendar_id,expires_at,updated_at")
      .eq("business_id", auth.business.id)
      .eq("provider", "google")
      .maybeSingle();

    return NextResponse.json({
      connected: Boolean(data),
      integration: data || null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao consultar Google Agenda." },
      { status: 500 }
    );
  }
}
