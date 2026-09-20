const groups = {
  core: [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "MERCADO_PAGO_ACCESS_TOKEN",
    "MERCADO_PAGO_WEBHOOK_SECRET",
    "MERCADO_PAGO_PLAN_ID",
    "TOKEN_ENCRYPTION_KEY",
  ],
  googleCalendar: [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ],
  mercadoPagoSeller: [
    "MERCADO_PAGO_CLIENT_ID",
    "MERCADO_PAGO_CLIENT_SECRET",
  ],
  whatsapp: [
    "WHATSAPP_GRAPH_VERSION",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_TEMPLATE_PIX_PENDING",
    "WHATSAPP_TEMPLATE_BOOKING_CONFIRMED",
    "WHATSAPP_TEMPLATE_REMINDER",
    "WHATSAPP_TEMPLATE_FOLLOWUP",
    "NOTIFICATION_CRON_SECRET",
  ],
} as const;

type GroupName = keyof typeof groups;

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function getEnvironmentStatus() {
  const status = {} as Record<
    GroupName,
    { configured: boolean; missing: string[] }
  >;

  for (const [group, variables] of Object.entries(groups) as [
    GroupName,
    readonly string[],
  ][]) {
    const missing = variables.filter((name) => !present(name));
    status[group] = {
      configured: missing.length === 0,
      missing,
    };
  }

  return status;
}

export function assertCoreEnvironment() {
  const status = getEnvironmentStatus();

  if (!status.core.configured) {
    throw new Error(
      "Variáveis obrigatórias ausentes: " +
        status.core.missing.join(", ")
    );
  }
}
