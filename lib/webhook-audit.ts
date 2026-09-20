import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ClaimArgs = {
  topic: string;
  dataId: string;
  requestId: string;
  signature: string;
  body: unknown;
};

export type WebhookClaim = {
  eventId: string | null;
  shouldProcess: boolean;
  duplicate: boolean;
};

function eventKey(args: ClaimArgs) {
  const stableInput = JSON.stringify({
    topic: args.topic,
    dataId: args.dataId,
    requestId: args.requestId,
    signature: args.signature,
    body: args.body,
  });

  return createHash("sha256").update(stableInput).digest("hex");
}

export async function claimMercadoPagoWebhook(
  args: ClaimArgs
): Promise<WebhookClaim> {
  const supabase = getSupabaseAdmin();
  const key = eventKey(args);
  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from("webhook_events")
    .insert({
      provider: "mercado_pago",
      event_key: key,
      topic: args.topic || null,
      data_id: args.dataId || null,
      request_id: args.requestId || null,
      status: "processing",
      attempts: 1,
      last_attempt_at: now,
    })
    .select("id")
    .maybeSingle();

  if (!error && inserted?.id) {
    return {
      eventId: inserted.id,
      shouldProcess: true,
      duplicate: false,
    };
  }

  if (error?.code !== "23505") {
    throw error || new Error("Falha ao registrar webhook.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("webhook_events")
    .select("id,status,attempts,last_attempt_at")
    .eq("provider", "mercado_pago")
    .eq("event_key", key)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    throw new Error("Webhook duplicado sem registro recuperável.");
  }

  if (
    existing.status === "processed" ||
    existing.status === "ignored"
  ) {
    return {
      eventId: existing.id,
      shouldProcess: false,
      duplicate: true,
    };
  }

  const lastAttempt = new Date(existing.last_attempt_at).getTime();
  const stale =
    Number.isNaN(lastAttempt) ||
    Date.now() - lastAttempt > 5 * 60 * 1000;

  if (existing.status === "processing" && !stale) {
    return {
      eventId: existing.id,
      shouldProcess: false,
      duplicate: true,
    };
  }

  const { error: retryError } = await supabase
    .from("webhook_events")
    .update({
      status: "processing",
      attempts: Number(existing.attempts || 0) + 1,
      last_attempt_at: now,
      error_message: null,
    })
    .eq("id", existing.id);

  if (retryError) throw retryError;

  return {
    eventId: existing.id,
    shouldProcess: true,
    duplicate: true,
  };
}

export async function completeWebhookEvent(
  eventId: string | null,
  status: "processed" | "ignored"
) {
  if (!eventId) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("webhook_events")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", eventId);

  if (error) throw error;
}

export async function failWebhookEvent(
  eventId: string | null,
  error: unknown
) {
  if (!eventId) return;

  const message =
    error instanceof Error ? error.message : String(error);

  const supabase = getSupabaseAdmin();
  const { error: updateError } = await supabase
    .from("webhook_events")
    .update({
      status: "failed",
      error_message: message.slice(0, 1000),
      last_attempt_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (updateError) throw updateError;
}
