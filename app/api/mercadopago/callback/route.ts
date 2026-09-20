import { NextRequest, NextResponse } from "next/server";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/painel?mercadopago=invalid", appUrl)
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: stateRecord } = await supabase
      .from("oauth_states")
      .select("state,business_id,expires_at,code_verifier_encrypted")
      .eq("state", state)
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (
      !stateRecord ||
      !stateRecord.code_verifier_encrypted ||
      new Date(stateRecord.expires_at).getTime() < Date.now()
    ) {
      return NextResponse.redirect(
        new URL("/painel?mercadopago=expired", appUrl)
      );
    }

    await supabase.from("oauth_states").delete().eq("state", state);

    const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
    const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("OAuth do Mercado Pago não configurado.");
    }

    const redirectUri = appUrl + "/api/mercadopago/callback";

    const response = await fetch(
      "https://api.mercadopago.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code_verifier: decryptSecret(
            stateRecord.code_verifier_encrypted
          ),
        }),
      }
    );

    const tokens = await response.json();

    if (
      !response.ok ||
      !tokens.access_token ||
      !tokens.refresh_token
    ) {
      throw new Error("Falha ao trocar código OAuth do Mercado Pago.");
    }

    const expiresAt = new Date(
      Date.now() + Number(tokens.expires_in || 15_552_000) * 1000
    ).toISOString();

    const { error } = await supabase
      .from("mercadopago_integrations")
      .upsert(
        {
          business_id: stateRecord.business_id,
          seller_user_id: tokens.user_id
            ? String(tokens.user_id)
            : null,
          access_token_encrypted: encryptSecret(tokens.access_token),
          refresh_token_encrypted: encryptSecret(tokens.refresh_token),
          expires_at: expiresAt,
          scope: tokens.scope || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (error) throw error;

    return NextResponse.redirect(
      new URL("/painel?mercadopago=connected", appUrl)
    );
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(
      new URL("/painel?mercadopago=error", appUrl)
    );
  }
}
