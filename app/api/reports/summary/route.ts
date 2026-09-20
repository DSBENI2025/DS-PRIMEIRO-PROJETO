import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedBusiness, roleAllowed } from "@/lib/auth-server";
import { businessHasActiveSubscription } from "@/lib/business-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AppointmentRow = {
  id: string;
  status: string;
  start_time: string;
  services: { name?: string; price_cents?: number } | { name?: string; price_cents?: number }[] | null;
  professionals: { name?: string } | { name?: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBusiness(req);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!roleAllowed(auth.role, ["owner", "admin"])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const active = await businessHasActiveSubscription(
      auth.business.id,
      auth.business.owner_id
    );

    if (!active) {
      return NextResponse.json({ error: "Assinatura inativa." }, { status: 403 });
    }

    const requestedDays = Number(req.nextUrl.searchParams.get("days") || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;

    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    const supabase = getSupabaseAdmin();

    const [appointmentsResult, paymentsResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("id,status,start_time,services(name,price_cents),professionals(name)")
        .eq("business_id", auth.business.id)
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString())
        .order("start_time"),
      supabase
        .from("booking_payments")
        .select("amount_cents,status,paid_at")
        .eq("business_id", auth.business.id)
        .eq("status", "approved")
        .gte("paid_at", start.toISOString())
        .lte("paid_at", end.toISOString()),
    ]);

    if (appointmentsResult.error) throw appointmentsResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const appointments = (appointmentsResult.data || []) as unknown as AppointmentRow[];
    const payments = paymentsResult.data || [];

    const activeAppointments = appointments.filter(
      (item) => item.status !== "cancelled"
    );

    const grossRevenueCents = activeAppointments.reduce((total, item) => {
      const service = one(item.services);
      return total + Number(service?.price_cents || 0);
    }, 0);

    const pixCollectedCents = payments.reduce(
      (total, payment) => total + Number(payment.amount_cents || 0),
      0
    );

    const cancelled = appointments.filter(
      (item) => item.status === "cancelled"
    ).length;
    const completed = appointments.filter(
      (item) => item.status === "completed"
    ).length;
    const noShow = appointments.filter(
      (item) => item.status === "no_show"
    ).length;

    const serviceMap = new Map<string, { count: number; revenueCents: number }>();
    const professionalMap = new Map<string, { count: number; revenueCents: number }>();
    const dailyMap = new Map<string, { count: number; revenueCents: number }>();

    for (const item of activeAppointments) {
      const service = one(item.services);
      const professional = one(item.professionals);
      const serviceName = service?.name || "Serviço";
      const professionalName = professional?.name || "Profissional";
      const priceCents = Number(service?.price_cents || 0);
      const day = item.start_time.slice(0, 10);

      const serviceStats = serviceMap.get(serviceName) || {
        count: 0,
        revenueCents: 0,
      };
      serviceStats.count += 1;
      serviceStats.revenueCents += priceCents;
      serviceMap.set(serviceName, serviceStats);

      const professionalStats = professionalMap.get(professionalName) || {
        count: 0,
        revenueCents: 0,
      };
      professionalStats.count += 1;
      professionalStats.revenueCents += priceCents;
      professionalMap.set(professionalName, professionalStats);

      const dailyStats = dailyMap.get(day) || {
        count: 0,
        revenueCents: 0,
      };
      dailyStats.count += 1;
      dailyStats.revenueCents += priceCents;
      dailyMap.set(day, dailyStats);
    }

    const topServices = [...serviceMap.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents)
      .slice(0, 5);

    const topProfessionals = [...professionalMap.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents)
      .slice(0, 5);

    const daily = [...dailyMap.entries()]
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      period: {
        days,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      metrics: {
        appointments: activeAppointments.length,
        cancelled,
        completed,
        noShow,
        grossRevenueCents,
        pixCollectedCents,
        averageTicketCents:
          activeAppointments.length > 0
            ? Math.round(grossRevenueCents / activeAppointments.length)
            : 0,
        cancellationRate:
          appointments.length > 0
            ? Math.round((cancelled / appointments.length) * 1000) / 10
            : 0,
      },
      topServices,
      topProfessionals,
      daily,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório." },
      { status: 500 }
    );
  }
}
