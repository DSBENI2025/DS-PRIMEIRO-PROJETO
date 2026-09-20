import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { decryptSecret } from "@/lib/secret-crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const professionalId =
      typeof body.professionalId === "string" && body.professionalId
        ? body.professionalId
        : null;

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

    let query = supabase
      .from("calendar_integrations")
      .select("id,refresh_token_encrypted")
      .eq("business_id", auth.business.id)
      .eq("provider", "google");

    query = professionalId
      ? query.eq("professional_id", professionalId)
      : query.is("professional_id", null);

    const { data: integration } = await query.maybeSingle();

    if (!integration) {
      return NextResponse.json({ disconnected: true });
    }

    if (integration.refresh_token_encrypted) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            token: decryptSecret(integration.refresh_token_encrypted),
          }),
        });
      } catch (error) {
        console.error("Falha ao revogar token Google", error);
      }
    }

    const { error } = await supabase
      .from("calendar_integrations")
      .delete()
      .eq("id", integration.id);

    if (error) throw error;

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao desconectar Google Agenda." },
      { status: 500 }
    );
  }
}
