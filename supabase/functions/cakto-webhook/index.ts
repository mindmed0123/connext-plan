// Webhook da Cakto: recebe eventos de assinatura e pagamento.
// URL recomendada: https://<project>.supabase.co/functions/v1/cakto-webhook
// A lógica fica em _shared/cakto-webhook-handler.ts (compartilhada com a função `webhook`).
import { handleCaktoWebhook } from "../_shared/cakto-webhook-handler.ts";

Deno.serve((req) => handleCaktoWebhook(req, "cakto-webhook"));
