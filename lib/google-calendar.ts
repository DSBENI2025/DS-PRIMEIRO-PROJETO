import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Integration = {
  business_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  calendar_id: string;
};

async function getIntegration(businessId: string) {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("calendar_integrations")
    .select("business_id,access_token_encrypted,refresh_token_encrypted,expires_at,calendar_id")
    .eq("business_id", businessId)
    .eq("provider", "google")
    .maybeSingle();

  return (data || null) as Integration | null;
}

async function refreshAccessToken(integration: Integration) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth não configurado.");
  }

  const refreshToken = decryptSecret(integration.refresh_token_encrypted);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    throw new Error("Não foi possível renovar o acesso ao Google Agenda.");
  }

  const expiresAt = new Date(
    Date.now() + Number(result.expires_in || 3600) * 1000
  ).toISOString();

  const supabase = getSupabaseAdmin();

  await supabase
    .from("calendar_integrations")
    .update({
      access_token_encrypted: encryptSecret(result.access_token),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", integration.business_id)
    .eq("provider", "google");

  return result.access_token as string;
}

export async function getGoogleAccessToken(businessId: string) {
  const integration = await getIntegration(businessId);

  if (!integration) return null;

  const stillValid =
    new Date(integration.expires_at).getTime() > Date.now() + 60_000;

  if (stillValid) {
    return decryptSecret(integration.access_token_encrypted);
  }

  return refreshAccessToken(integration);
}

export async function isGoogleCalendarBusy(
  businessId: string,
  startTime: string,
  endTime: string
) {
  const integration = await getIntegration(businessId);

  if (!integration) return false;

  const accessToken = await getGoogleAccessToken(businessId);

  if (!accessToken) return false;

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: startTime,
        timeMax: endTime,
        items: [{ id: integration.calendar_id || "primary" }],
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error("Falha ao consultar disponibilidade do Google Agenda.");
  }

  const busy =
    result.calendars?.[integration.calendar_id || "primary"]?.busy || [];

  return busy.length > 0;
}

export async function createGoogleCalendarEvent(args: {
  businessId: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  timeZone: string;
}) {
  const integration = await getIntegration(args.businessId);

  if (!integration) return null;

  const accessToken = await getGoogleAccessToken(args.businessId);

  if (!accessToken) return null;

  const calendarId = integration.calendar_id || "primary";

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/" +
      encodeURIComponent(calendarId) +
      "/events",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: args.summary,
        description: args.description,
        start: {
          dateTime: args.startTime,
          timeZone: args.timeZone,
        },
        end: {
          dateTime: args.endTime,
          timeZone: args.timeZone,
        },
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.id) {
    throw new Error("Falha ao criar evento no Google Agenda.");
  }

  return result.id as string;
}

export async function deleteGoogleCalendarEvent(
  businessId: string,
  eventId: string
) {
  const integration = await getIntegration(businessId);

  if (!integration) return;

  const accessToken = await getGoogleAccessToken(businessId);

  if (!accessToken) return;

  const calendarId = integration.calendar_id || "primary";

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/" +
      encodeURIComponent(calendarId) +
      "/events/" +
      encodeURIComponent(eventId),
    {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    }
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error("Falha ao remover evento do Google Agenda.");
  }
}
