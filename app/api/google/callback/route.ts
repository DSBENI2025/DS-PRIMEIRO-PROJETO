import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/lib/secret-crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function targetPath(
  professionalId: string | null | undefined,
  status: string
) {
  if (professionalId) {
    return (
      "/painel/profissionais/" +
      encodeURIComponent(professionalId) +
      "/horarios?google=" +
      encodeURIComponent(status)
    );
  }

  return "/painel?google=" + encodeURIComponent(status);
}

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  try {
    const errorParam = req.nextUrl.searchParams.get("error");
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");

    if (!state) {
      return NextResponse.redirect(
        new URL("/painel?google=invalid", appUrl)
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: stateRecord } = await supabase
      .from("oauth_states")
      .select("state,user_id,business_id,professional_id,expires_at")
      .eq("state", state)
      .eq("provider", "google")
      .maybeSingle();

    if (!stateRecord) {
      return NextResponse.redirect(
        new URL("/painel?google=invalid", appUrl)
      );
    }

    const redirect = (status: string) =>
      NextResponse.redirect(
        new URL(targetPath(stateRecord.professional_id, status), appUrl)
      );

    if (errorParam) {
      await supabase.from("oauth_states").delete().eq("state", state);
      return redirect("denied");
    }

    if (!code) {
      await supabase.from("oauth_states").delete().eq("state", state);
      return redirect("invalid");
    }

    if (new Date(stateRecord.expires_at).getTime() < Date.now()) {
      await supabase.from("oauth_states").delete().eq("state", state);
      return redirect("expired");
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

    let existingQuery = supabase
      .from("calendar_integrations")
      .select("id,refresh_token_encrypted")
      .eq("business_id", stateRecord.business_id)
      .eq("provider", "google");

    existingQuery = stateRecord.professional_id
      ? existingQuery.eq("professional_id", stateRecord.professional_id)
      : existingQuery.is("professional_id", null);

    const { data: existing } = await existingQuery.maybeSingle();

    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing?.refresh_token_encrypted;

    if (!refreshTokenEncrypted) {
      throw new Error("Google não retornou refresh token.");
    }

    const expiresAt = new Date(
      Date.now() + Number(tokens.expires_in || 3600) * 1000
    ).toISOString();

    const values = {
      business_id: stateRecord.business_id,
      professional_id: stateRecord.professional_id || null,
      provider: "google",
      access_token_encrypted: encryptSecret(tokens.access_token),
      refresh_token_encrypted: refreshTokenEncrypted,
      expires_at: expiresAt,
      scope: tokens.scope || null,
      calendar_id: "primary",
      updated_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase
          .from("calendar_integrations")
          .update(values)
          .eq("id", existing.id)
      : await supabase.from("calendar_integrations").insert(values);

    if (error) throw error;

    return redirect("connected");
  } catch (error) {
    console.error(error);

    const state = req.nextUrl.searchParams.get("state");
    let professionalId: string | null = null;

    if (state) {
      try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
          .from("oauth_states")
          .select("professional_id")
          .eq("state", state)
          .maybeSingle();
        professionalId = data?.professional_id || null;
      } catch {
        professionalId = null;
      }
    }

    return NextResponse.redirect(
      new URL(targetPath(professionalId, "error"), appUrl)
    );
  }
}
