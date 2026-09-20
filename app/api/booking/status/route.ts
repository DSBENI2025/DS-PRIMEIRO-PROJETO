import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const reservationId = req.nextUrl.searchParams.get("reservationId") || "";

    if (!reservationId) {
      return NextResponse.json(
        { error: "Reserva não informada." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: reservation } = await supabase
      .from("booking_payments")
      .select("id,status,appointment_id,expires_at,start_time,amount_cents")
      .eq("id", reservationId)
      .maybeSingle();

    if (!reservation) {
      return NextResponse.json(
        { error: "Reserva não encontrada." },
        { status: 404 }
      );
    }

    let status = reservation.status;

    if (
      status === "pending" &&
      new Date(reservation.expires_at).getTime() <= Date.now()
    ) {
      await supabase
        .from("booking_payments")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reservation.id)
        .eq("status", "pending");

      status = "expired";
    }

    return NextResponse.json({
      status,
      confirmed: status === "approved" && Boolean(reservation.appointment_id),
      appointmentId: reservation.appointment_id,
      startTime: reservation.start_time,
      amountCents: reservation.amount_cents,
      expiresAt: reservation.expires_at,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível consultar a reserva." },
      { status: 500 }
    );
  }
}
