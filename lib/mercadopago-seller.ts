import { MercadoPagoConfig, Payment } from "mercadopago";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type MercadoPagoIntegration = {
  business_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
};

async function getIntegration(businessId: string) {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("mercadopago_integrations")
    .select(
      "business_id,access_token_encrypted,refresh_token_encrypted,expires_at"
    )
    .eq("business_id", businessId)
    .maybeSingle();

  return (data || null) as MercadoPagoIntegration | null;
}

async function refreshSellerAccessToken(
  integration: MercadoPagoIntegration
) {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("OAuth do Mercado Pago não configurado.");
  }

  const refreshToken = decryptSecret(
    integration.refresh_token_encrypted
  );

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
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.access_token || !result.refresh_token) {
    throw new Error(
      "Não foi possível renovar a conexão Mercado Pago do estabelecimento."
    );
  }

  const expiresAt = new Date(
    Date.now() + Number(result.expires_in || 15_552_000) * 1000
  ).toISOString();

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("mercadopago_integrations")
    .update({
      access_token_encrypted: encryptSecret(result.access_token),
      refresh_token_encrypted: encryptSecret(result.refresh_token),
      expires_at: expiresAt,
      scope: result.scope || null,
      seller_user_id: result.user_id
        ? String(result.user_id)
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", integration.business_id);

  if (error) throw error;

  return result.access_token as string;
}

export async function getBusinessMercadoPagoAccessToken(
  businessId: string
) {
  const integration = await getIntegration(businessId);

  if (!integration) return null;

  const stillValid =
    new Date(integration.expires_at).getTime() >
    Date.now() + 24 * 60 * 60 * 1000;

  if (stillValid) {
    return decryptSecret(integration.access_token_encrypted);
  }

  return refreshSellerAccessToken(integration);
}

export async function getBusinessPaymentClient(
  businessId: string
) {
  const accessToken =
    await getBusinessMercadoPagoAccessToken(businessId);

  if (!accessToken) return null;

  const client = new MercadoPagoConfig({ accessToken });
  return new Payment(client);
}
