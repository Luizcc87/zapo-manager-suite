import { Webhook } from "@/types/evolution.types";

// O backend salva/retorna os campos como base64/byEvents (ver DEFAULT_WEBHOOK
// em config.routes.ts). webhookBase64/webhookByEvents são mantidos aqui como
// aliases opcionais só para compatibilidade com payloads legados anteriores
// ao fix desse mismatch de nomenclatura.
export type FetchWebhookResponse = Webhook & {
  webhookBase64?: boolean;
  webhookByEvents?: boolean;
};
