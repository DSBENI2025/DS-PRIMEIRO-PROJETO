import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

function clientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function fingerprint(req: NextRequest) {
  const secret = process.env.RATE_LIMIT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("RATE_LIMIT_SECRET deve ter pelo menos 32 caracteres.");
  }

  const ip = clientIp(req);
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function consumeRateLimit(
  req: NextRequest,
  action: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key_hash: fingerprint(req),
      p_action: action,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      throw new Error("Rate limit sem resposta do banco.");
    }

    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining || 0),
      retryAfter: Number(row.retry_after || 1),
    };
  } catch (error) {
    console.error("Falha ao aplicar rate limit", action, error);

    // Fail open so an auxiliary protection cannot take the booking system down.
    return {
      allowed: true,
      remaining: 0,
      retryAfter: 0,
    };
  }
}

export function rateLimitExceeded(result: RateLimitResult) {
  return NextResponse.json(
    {
      error:
        "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
