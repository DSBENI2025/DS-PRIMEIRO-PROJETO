import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const scopes = [
  "https://www.googleapis.com/auth/calendar.events.owned",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !appUrl) {
      throw new Error("Google OAuth não configurado.");
    }

    const supabase = getSupabaseAdmin();
    const state = randomUUID();

    await supabase
      .from("oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());

    const { error } = await supabase.from("oauth_states").insert({
      state,
      user_id: auth.user.id,
      business_id: auth.business.id,
      provider: "google",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (error) throw error;

    const redirectUri = appUrl + "/api/google/callback";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: scopes.join(" "),
      state,
    });

    return NextResponse.json({
      authorizationUrl:
        "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão com o Google." },
      { status: 500 }
    );
  }
}
