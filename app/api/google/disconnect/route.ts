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

    const supabase = getSupabaseAdmin();

    const { data: integration } = await supabase
      .from("calendar_integrations")
      .select("refresh_token_encrypted")
      .eq("business_id", auth.business.id)
      .eq("provider", "google")
      .maybeSingle();

    if (integration?.refresh_token_encrypted) {
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
      .eq("business_id", auth.business.id)
      .eq("provider", "google");

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
