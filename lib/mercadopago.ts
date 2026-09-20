import {
  MercadoPagoConfig,
  PreApproval,
  WebhookSignatureValidator,
} from "mercadopago";

export function getMercadoPagoClient() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  }

  return new MercadoPagoConfig({ accessToken });
}

export function getPreApprovalClient() {
  return new PreApproval(getMercadoPagoClient());
}

export { WebhookSignatureValidator };
