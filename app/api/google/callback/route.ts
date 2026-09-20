import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/lib/secret-crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  try {
    const errorParam = req.nextUrl.searchParams.get("error");
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");

    if (errorParam) {
      return NextResponse.redirect(
        new URL("/painel?google=denied", appUrl)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/painel?google=invalid", appUrl)
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: stateRecord } = await supabase
      .from("oauth_states")
      .select("state,user_id,business_id,expires_at")
      .eq("state", state)
      .eq("provider", "google")
      .maybeSingle();

    if (
      !stateRecord ||
      new Date(stateRecord.expires_at).getTime() < Date.now()
    ) {
      return NextResponse.redirect(
        new URL("/painel?google=expired", appUrl)
      );
    }

    await supabase.from("oauth_states").delete().eq("state", state);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth não configurado.");
    }

    const redirectUri = appUrl + "/api/google/callback";

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await response.json();

    if (!response.ok || !tokens.access_token) {
      throw new Error("Troca de código OAuth falhou.");
    }

    const { data: existing } = await supabase
      .from("calendar_integrations")
      .select("refresh_token_encrypted")
      .eq("business_id", stateRecord.business_id)
      .eq("provider", "google")
      .maybeSingle();

    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing?.refresh_token_encrypted;

    if (!refreshTokenEncrypted) {
      throw new Error("Google não retornou refresh token.");
    }

    const expiresAt = new Date(
      Date.now() + Number(tokens.expires_in || 3600) * 1000
    ).toISOString();

    const { error } = await supabase
      .from("calendar_integrations")
      .upsert(
        {
          business_id: stateRecord.business_id,
          provider: "google",
          access_token_encrypted: encryptSecret(tokens.access_token),
          refresh_token_encrypted: refreshTokenEncrypted,
          expires_at: expiresAt,
          scope: tokens.scope || null,
          calendar_id: "primary",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (error) throw error;

    return NextResponse.redirect(
      new URL("/painel?google=connected", appUrl)
    );
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(
      new URL("/painel?google=error", appUrl)
    );
  }
}
