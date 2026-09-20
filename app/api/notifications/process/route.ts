import { NextRequest, NextResponse } from "next/server";
import { notifyReminder } from "@/lib/notifications";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function authorized(req: NextRequest) {
  const secret = process.env.NOTIFICATION_CRON_SECRET;
  const header = req.headers.get("authorization") || "";

  return Boolean(secret && header === "Bearer " + secret);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id,start_time,whatsapp_opt_in,businesses(whatsapp_enabled,whatsapp_reminder_minutes)"
      )
      .eq("status", "confirmed")
      .eq("whatsapp_opt_in", true)
      .gt("start_time", now.toISOString())
      .lte("start_time", horizon.toISOString())
      .limit(500);

    if (error) throw error;

    let attempted = 0;
    let sent = 0;
    let failed = 0;

    for (const appointment of data || []) {
      const business = Array.isArray(appointment.businesses)
        ? appointment.businesses[0]
        : appointment.businesses;

      if (!business?.whatsapp_enabled) continue;

      const reminderMinutes = Number(
        business.whatsapp_reminder_minutes || 60
      );

      const reminderAt =
        new Date(appointment.start_time).getTime() -
        reminderMinutes * 60 * 1000;

      if (Date.now() < reminderAt) continue;

      attempted += 1;

      try {
        const result = await notifyReminder(appointment.id);
        if (result.sent) sent += 1;
      } catch (error) {
        failed += 1;
        console.error("Falha ao enviar lembrete", appointment.id, error);
      }
    }

    return NextResponse.json({
      ok: true,
      attempted,
      sent,
      failed,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao processar lembretes." },
      { status: 500 }
    );
  }
}
