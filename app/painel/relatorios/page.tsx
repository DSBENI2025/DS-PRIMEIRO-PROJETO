"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Report = {
  period: { days: number; start: string; end: string };
  metrics: {
    appointments: number;
    cancelled: number;
    completed: number;
    noShow: number;
    grossRevenueCents: number;
    pixCollectedCents: number;
    averageTicketCents: number;
    cancellationRate: number;
  };
  topServices: { name: string; count: number; revenueCents: number }[];
  topProfessionals: { name: string; count: number; revenueCents: number }[];
  daily: { date: string; count: number; revenueCents: number }[];
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function load(selectedDays = days) {
    setLoading(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(
        "/api/reports/summary?days=" + selectedDays,
        {
          headers: {
            Authorization: "Bearer " + token,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível carregar o relatório.");
      }

      setReport(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(days);
  }, [days]);

  async function exportCsv() {
    setExporting(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(
        "/api/reports/export?days=" + days,
        {
          headers: {
            Authorization: "Bearer " + token,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Não foi possível exportar o relatório.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] || "agenda-pro-relatorio-" + days + "-dias.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro inesperado."
      );
    } finally {
      setExporting(false);
    }
  }

  const maxDailyRevenue = useMemo(
    () =>
      Math.max(
        1,
        ...(report?.daily.map((item) => item.revenueCents) || [1])
      ),
    [report]
  );

  return (
    <main>
      <div className="row between">
        <div>
          <div className="muted">AGENDA PRO</div>
          <h1>Relatórios</h1>
          <p>Visão de desempenho financeiro e operacional do negócio.</p>
        </div>
        <a className="secondary" href="/painel">Voltar ao painel</a>
      </div>

      <div className="reports-toolbar">
        <div className="period-tabs">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              className={days === value ? "period-tab active" : "period-tab"}
              onClick={() => setDays(value)}
            >
              {value} dias
            </button>
          ))}
        </div>

        <button
          className="secondary"
          disabled={exporting || loading}
          onClick={exportCsv}
        >
          {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </div>

      {loading && <div className="card">Carregando relatório...</div>}
      {message && <div className="booking-message">{message}</div>}

      {report && !loading && (
        <>
          <section className="metrics-grid">
            <div className="metric-card">
              <span>Agendamentos</span>
              <strong>{report.metrics.appointments}</strong>
            </div>
            <div className="metric-card">
              <span>Receita prevista</span>
              <strong>{brl(report.metrics.grossRevenueCents)}</strong>
            </div>
            <div className="metric-card">
              <span>Sinais Pix recebidos</span>
              <strong>{brl(report.metrics.pixCollectedCents)}</strong>
            </div>
            <div className="metric-card">
              <span>Ticket médio</span>
              <strong>{brl(report.metrics.averageTicketCents)}</strong>
            </div>
            <div className="metric-card">
              <span>Cancelados</span>
              <strong>{report.metrics.cancelled}</strong>
            </div>
            <div className="metric-card">
              <span>Taxa de cancelamento</span>
              <strong>{report.metrics.cancellationRate}%</strong>
            </div>
            <div className="metric-card">
              <span>Concluídos</span>
              <strong>{report.metrics.completed}</strong>
            </div>
            <div className="metric-card">
              <span>Não compareceu</span>
              <strong>{report.metrics.noShow}</strong>
            </div>
          </section>

          <section className="card">
            <h2>Receita por dia</h2>
            {report.daily.length === 0 ? (
              <p>Ainda não há dados no período.</p>
            ) : (
              <div className="chart-list">
                {report.daily.map((item) => (
                  <div className="chart-row" key={item.date}>
                    <span className="chart-label">
                      {new Date(item.date + "T12:00:00").toLocaleDateString(
                        "pt-BR",
                        { day: "2-digit", month: "2-digit" }
                      )}
                    </span>
                    <div className="chart-track">
                      <div
                        className="chart-bar"
                        style={{
                          width:
                            Math.max(
                              3,
                              Math.round(
                                (item.revenueCents / maxDailyRevenue) * 100
                              )
                            ) + "%",
                        }}
                      />
                    </div>
                    <strong>{brl(item.revenueCents)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid-2">
            <section className="card">
              <h2>Serviços mais vendidos</h2>
              <div className="list">
                {report.topServices.length === 0 && <p>Sem dados.</p>}
                {report.topServices.map((item, index) => (
                  <div className="ranking-row" key={item.name}>
                    <span className="ranking-number">{index + 1}</span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.count} agendamentos · {brl(item.revenueCents)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Profissionais</h2>
              <div className="list">
                {report.topProfessionals.length === 0 && <p>Sem dados.</p>}
                {report.topProfessionals.map((item, index) => (
                  <div className="ranking-row" key={item.name}>
                    <span className="ranking-number">{index + 1}</span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.count} agendamentos · {brl(item.revenueCents)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
