import BookingForm from "@/components/booking-form";
import { businessHasActiveSubscription } from "@/lib/business-access";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,slug,owner_id,active")
    .eq("slug", slug)
    .maybeSingle();

  if (!business || !business.active) {
    return (
      <main>
        <div className="card">
          <h1>Agenda indisponível</h1>
          <p>Este link de agendamento não está ativo.</p>
        </div>
      </main>
    );
  }

  const activeSubscription = await businessHasActiveSubscription(
    business.id,
    business.owner_id
  );

  if (!activeSubscription) {
    return (
      <main>
        <div className="card">
          <h1>Agenda temporariamente indisponível</h1>
          <p>O estabelecimento ainda não está recebendo agendamentos online.</p>
        </div>
      </main>
    );
  }

  const [servicesResult, professionalsResult, hoursResult] = await Promise.all([
    supabase
      .from("services")
      .select("id,name,duration_minutes,price_cents")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("professionals")
      .select("id,name")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("business_hours")
      .select("weekday,opens_at,closes_at,is_closed")
      .eq("business_id", business.id)
      .order("weekday"),
  ]);

  const services = servicesResult.data || [];
  const professionals = professionalsResult.data || [];
  const hours = hoursResult.data || [];

  if (services.length === 0 || professionals.length === 0) {
    return (
      <main>
        <div className="card">
          <h1>Agenda em configuração</h1>
          <p>O estabelecimento ainda está cadastrando serviços e profissionais.</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <BookingForm
        businessId={business.id}
        businessName={business.name}
        services={services}
        professionals={professionals}
        hours={hours}
      />
    </main>
  );
}
