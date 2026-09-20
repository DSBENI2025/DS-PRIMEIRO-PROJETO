import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/auth-server";
import { isWhatsAppConfigured } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const auth = await getAuthenticatedBusiness(req);

  if (!auth) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return NextResponse.json({
    configured: isWhatsAppConfigured(),
    templates: {
      pixPending: Boolean(process.env.WHATSAPP_TEMPLATE_PIX_PENDING),
      bookingConfirmed: Boolean(
        process.env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED
      ),
      reminder: Boolean(process.env.WHATSAPP_TEMPLATE_REMINDER),
      followup: Boolean(process.env.WHATSAPP_TEMPLATE_FOLLOWUP),
    },
  });
}
