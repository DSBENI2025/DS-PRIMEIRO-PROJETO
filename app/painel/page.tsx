"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Business = { id: string; name: string; slug: string; phone: string | null };
type Service = { id: string; name: string; duration_minutes: number; price_cents: number; active: boolean };
type Professional = { id: string; name: string; active: boolean };
type Appointment = {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  status: string;
  services?: { name?: string } | null;
  professionals?: { name?: string } | null;
};

export default function PainelPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState("pending");
  const [serviceName, setServiceName] = useState("");
  const [duration, setDuration] = useState(40);
  const [price, setPrice] = useState("0");
  const [professionalName, setProfessionalName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const canUse = subscriptionStatus === "authorized";

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    const { data: businessData } = await supabase
      .from("businesses")
      .select("id,name,slug,phone")
      .limit(1)
      .maybeSingle();

    if (!businessData) {
      window.location.href = "/onboarding";
      return;
    }

    setBusiness(businessData);

    const [servicesResult, professionalsResult, subscriptionResult, appointmentsResult] = await Promise.all([
      supabase.from("services").select("*").eq("business_id", businessData.id).order("created_at"),
      supabase.from("professionals").select("*").eq("business_id", businessData.id).order("created_at"),
      supabase.from("subscriptions").select("status").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from("appointments")
        .select("id,customer_name,customer_phone,start_time,status,services(name),professionals(name)")
        .eq("business_id", businessData.id)
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(30),
    ]);

    setServices((servicesResult.data || []) as Service[]);
    setProfessionals((professionalsResult.data || []) as Professional[]);
    setSubscriptionStatus(subscriptionResult.data?.status || "pending");
    setAppointments((appointmentsResult.data || []) as unknown as Appointment[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addService() {
    if (!business || !canUse || !serviceName.trim()) return;
    const supabase = getSupabaseBrowser();
    const value = Number(String(price).replace(",", "."));

    const { error } = await supabase.from("services").insert({
      business_id: business.id,
      name: serviceName.trim(),
      duration_minutes: duration,
      price_cents: Math.round(value * 100),
    });

    if (error) return setMessage(error.message);
    setServiceName("");
    setPrice("0");
    await load();
  }

  async function addProfessional() {
    if (!business || !canUse || !professionalName.trim()) return;
    const supabase = getSupabaseBrowser();

    const { error } = await supabase.from("professionals").insert({
      business_id: business.id,
      name: professionalName.trim(),
    });

    if (error) return setMessage(error.message);
    setProfessionalName("");
    await load();
  }

  async function cancelAppointment(id: string) {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) return setMessage(error.message);
    await load();
  }

  async function subscribe() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const email = data.session?.user.email;

    if (!token || !email) return;

    const response = await fetch("/api/subscriptions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    if (!response.ok) return setMessage(result.error || "Não foi possível iniciar a assinatura.");
    window.location.href = result.checkoutUrl;
  }

  async function logout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const publicUrl = useMemo(() => {
    if (!business || typeof window === "undefined") return "";
    return window.location.origin + "/agendar/" + business.slug;
  }, [business]);

  if (loading) {
    return <main><div className="card">Carregando painel...</div></main>;
  }

  return (
    <main className="dashboard">
      <div className="row between">
        <div>
          <div className="muted">AGENDA PRO</div>
          <h1>{business?.name}</h1>
        </div>
        <button className="secondary" onClick={logout}>Sair</button>
      </div>

      <section className={"card " + (canUse ? "status-ok" : "status-warning")}>
        <div className="row between">
          <div>
            <strong>Assinatura: {canUse ? "ativa" : subscriptionStatus}</strong>
            <p>{canUse ? "Seu painel está liberado." : "Ative sua assinatura para cadastrar serviços, profissionais e receber agendamentos."}</p>
          </div>
          {!canUse && <button className="cta" onClick={subscribe}>Assinar R$ 39,90/mês</button>}
        </div>
      </section>

      {canUse && (
        <>
          <section className="card">
            <div className="row between">
              <div>
                <h2>Seu link de agendamento</h2>
                <div className="public-link">{publicUrl}</div>
              </div>
              <a className="secondary" href="/painel/horarios">Editar horários</a>
            </div>
          </section>

          <div className="grid-2">
            <section className="card">
              <h2>Serviços</h2>
              <div className="stack">
                <input className="input" placeholder="Ex.: Corte" value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
                <input className="input" type="number" min={10} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                <input className="input" inputMode="decimal" placeholder="Valor" value={price} onChange={(e) => setPrice(e.target.value)} />
                <button className="cta" onClick={addService}>Adicionar serviço</button>
              </div>
              <div className="list">
                {services.map((service) => (
                  <div className="list-item" key={service.id}>
                    <strong>{service.name}</strong>
                    <span>{service.duration_minutes} min · R$ {(service.price_cents / 100).toFixed(2).replace(".", ",")}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Profissionais</h2>
              <div className="stack">
                <input className="input" placeholder="Nome do profissional" value={professionalName} onChange={(e) => setProfessionalName(e.target.value)} />
                <button className="cta" onClick={addProfessional}>Adicionar profissional</button>
              </div>
              <div className="list">
                {professionals.map((professional) => (
                  <div className="list-item" key={professional.id}>
                    <strong>{professional.name}</strong>
                    <span>Ativo</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="card">
            <h2>Próximos agendamentos</h2>
            <div className="list">
              {appointments.length === 0 && <p>Nenhum agendamento futuro.</p>}
              {appointments.map((appointment) => (
                <div className="list-item" key={appointment.id}>
                  <strong>{appointment.customer_name}</strong>
                  <span>
                    {new Date(appointment.start_time).toLocaleString("pt-BR")} · {appointment.services?.name || "Serviço"} · {appointment.professionals?.name || "Profissional"} · {appointment.customer_phone}
                  </span>
                  <button className="danger-link" onClick={() => cancelAppointment(appointment.id)}>
                    Cancelar agendamento
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {message && <p>{message}</p>}
    </main>
  );
}
