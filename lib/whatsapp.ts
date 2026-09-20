type TemplateSendArgs = {
  to: string;
  templateName: string;
  bodyParameters?: string[];
};

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return "55" + digits;

  return null;
}

export function isWhatsAppConfigured() {
  return Boolean(
    process.env.WHATSAPP_GRAPH_VERSION &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ACCESS_TOKEN
  );
}

export async function sendWhatsAppTemplate({
  to,
  templateName,
  bodyParameters = [],
}: TemplateSendArgs) {
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const language =
    process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR";

  if (!version || !phoneNumberId || !accessToken) {
    throw new Error("WhatsApp Cloud API não configurada.");
  }

  const recipient = normalizeWhatsAppPhone(to);

  if (!recipient) {
    throw new Error("Número de WhatsApp inválido.");
  }

  const response = await fetch(
    "https://graph.facebook.com/" +
      encodeURIComponent(version) +
      "/" +
      encodeURIComponent(phoneNumberId) +
      "/messages",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: language,
          },
          components:
            bodyParameters.length > 0
              ? [
                  {
                    type: "body",
                    parameters: bodyParameters.map((text) => ({
                      type: "text",
                      text,
                    })),
                  },
                ]
              : undefined,
        },
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    const message =
      result?.error?.message ||
      "Falha ao enviar mensagem pelo WhatsApp.";
    throw new Error(message);
  }

  return {
    messageId: String(result?.messages?.[0]?.id || ""),
    recipient,
  };
}
