import { createHash, randomBytes } from "crypto";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function expiryFor(endTime: string) {
  const end = new Date(endTime).getTime();
  const base = Math.max(Number.isNaN(end) ? Date.now() : end, Date.now());
  return new Date(base + THIRTY_DAYS).toISOString();
}

function manageUrl(token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return appUrl.replace(/\/$/, "") + "/meu-agendamento/" + token;
}

export async function ensureAppointmentAccessToken(
  appointmentId: string,
  endTime: string
) {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("appointment_access_tokens")
    .select("id,token_encrypted,expires_at,revoked_at")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const requiredExpiry = expiryFor(endTime);

  if (
    existing &&
    !existing.revoked_at &&
    new Date(existing.expires_at).getTime() > Date.now()
  ) {
    const token = decryptSecret(existing.token_encrypted);

    if (
      new Date(existing.expires_at).getTime() <
      new Date(requiredExpiry).getTime()
    ) {
      await supabase
        .from("appointment_access_tokens")
        .update({
          expires_at: requiredExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }

    return {
      token,
      url: manageUrl(token),
    };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const values = {
    appointment_id: appointmentId,
    token_hash: tokenHash,
    token_encrypted: encryptSecret(token),
    expires_at: requiredExpiry,
    revoked_at: null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase
        .from("appointment_access_tokens")
        .update(values)
        .eq("id", existing.id)
    : await supabase.from("appointment_access_tokens").insert(values);

  if (error) throw error;

  return {
    token,
    url: manageUrl(token),
  };
}

export async function getAppointmentAccessByToken(token: string) {
  if (!token || token.length < 32) return null;

  const supabase = getSupabaseAdmin();
  const tokenHash = hashToken(token);

  const { data: access } = await supabase
    .from("appointment_access_tokens")
    .select("id,appointment_id,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    !access ||
    access.revoked_at ||
    new Date(access.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  await supabase
    .from("appointment_access_tokens")
    .update({
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", access.id);

  return access;
}

export async function extendAppointmentAccessToken(
  appointmentId: string,
  endTime: string
) {
  const supabase = getSupabaseAdmin();
  const expiresAt = expiryFor(endTime);

  await supabase
    .from("appointment_access_tokens")
    .update({
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("appointment_id", appointmentId)
    .is("revoked_at", null);
}
