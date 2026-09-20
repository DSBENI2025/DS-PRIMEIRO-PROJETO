import { createHash, randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, roleAllowed } from "@/lib/auth-server";
import { encryptSecret } from "@/lib/secret-crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!roleAllowed(auth.role, ["owner", "admin"])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !appUrl) {
      throw new Error("OAuth do Mercado Pago não configurado.");
    }

    const state = randomUUID();
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    if (!roleAllowed(auth.role, ["owner", "admin"])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    await supabase
      .from("oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());

    const { error } = await supabase.from("oauth_states").insert({
      state,
      user_id: auth.user.id,
      business_id: auth.business.id,
      provider: "mercadopago",
      code_verifier_encrypted: encryptSecret(codeVerifier),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (error) throw error;

    const redirectUri = appUrl + "/api/mercadopago/callback";
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      platform_id: "mp",
      state,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return NextResponse.json({
      authorizationUrl:
        "https://auth.mercadopago.com/authorization?" + params.toString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão Mercado Pago." },
      { status: 500 }
    );
  }
}
