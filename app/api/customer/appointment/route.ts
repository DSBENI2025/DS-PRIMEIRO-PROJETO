import { NextRequest, NextResponse } from "next/server";
import { getAppointmentAccessByToken } from "@/lib/customer-appointment-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { consumeRateLimit, rateLimitExceeded } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const rateLimit = await consumeRateLimit(req, "customer_view", 60, 600);

    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit);
    }

    const token = req.nextUrl.searchParams.get("token") || "";
    const access = await getAppointmentAccessByToken(token);

    if (!access) {
      return NextResponse.json(
        { error: "Link inválido ou expirado." },
        { status: 404 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: appointment } = await supabase
      .from("appointments")
      .select(
        "id,business_id,service_id,professional_id,customer_name,customer_phone,customer_email,start_time,end_time,status,booking_payment_id,businesses(name,phone,timezone),services(name,duration_minutes,price_cents),professionals(name)"
      )
      .eq("id", access.appointment_id)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json(
        { error: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    const { data: professionals } = await supabase
      .from("professionals")
      .select("id,name")
      .eq("business_id", appointment.business_id)
      .eq("active", true)
      .order("name");

    let payment = null;

    if (appointment.booking_payment_id) {
      const result = await supabase
        .from("booking_payments")
        .select("amount_cents,status,paid_at")
        .eq("id", appointment.booking_payment_id)
        .maybeSingle();

      payment = result.data;
    }

    const future =
      new Date(appointment.start_time).getTime() > Date.now();

    return NextResponse.json(
      {
        appointment,
        professionals: professionals || [],
        payment,
        canCancel: appointment.status === "confirmed" && future,
        canReschedule: appointment.status === "confirmed" && future,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível carregar o agendamento." },
      { status: 500 }
    );
  }
}
