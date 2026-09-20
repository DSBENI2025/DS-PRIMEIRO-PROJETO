import { NextResponse } from "next/server";
import { getEnvironmentStatus } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const schemaChecks = [
  ["businesses", "id"],
  ["business_members", "id"],
  ["services", "id"],
  ["professionals", "id"],
  ["professional_hours", "id"],
  ["appointments", "id"],
  ["schedule_blocks", "id"],
  ["calendar_integrations", "id"],
  ["mercadopago_integrations", "id"],
  ["booking_payments", "id"],
  ["notification_logs", "id"],
  ["appointment_access_tokens", "id"],
  ["appointment_history", "id"],
  ["rate_limit_buckets", "key_hash"],
  ["webhook_events", "id"],
] as const;

export async function GET() {
  const environment = getEnvironmentStatus();
  let database = false;
  let schemaReady = false;
  const missingTables: string[] = [];

  if (environment.core.configured) {
    try {
      const supabase = getSupabaseAdmin();

      const results = await Promise.all(
        schemaChecks.map(async ([table, column]) => {
          const { error } = await supabase
            .from(table)
            .select(column)
            .limit(1);

          return {
            table,
            ok: !error,
          };
        })
      );

      database = Boolean(
        results.find((item) => item.table === "businesses")?.ok
      );

      for (const result of results) {
        if (!result.ok) {
          missingTables.push(result.table);
        }
      }

      schemaReady = missingTables.length === 0;
    } catch {
      database = false;
      schemaReady = false;
    }
  }

  const healthy =
    environment.core.configured &&
    database &&
    schemaReady;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: process.env.npm_package_version || "unknown",
      database,
      schemaReady,
      missingTables,
      integrations: {
        googleCalendar: environment.googleCalendar.configured,
        mercadoPagoSeller: environment.mercadoPagoSeller.configured,
        whatsapp: environment.whatsapp.configured,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
