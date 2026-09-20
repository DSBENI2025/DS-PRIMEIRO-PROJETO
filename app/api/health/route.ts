import { NextResponse } from "next/server";
import { getEnvironmentStatus } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const environment = getEnvironmentStatus();
  let database = false;

  if (environment.core.configured) {
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("businesses")
        .select("id")
        .limit(1);

      database = !error;
    } catch {
      database = false;
    }
  }

  const healthy = environment.core.configured && database;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: process.env.npm_package_version || "unknown",
      database,
      integrations: {
        googleCalendar: environment.googleCalendar.configured,
        mercadoPagoSeller: environment.mercadoPagoSeller.configured,
        whatsapp: environment.whatsapp.configured,
      },
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
