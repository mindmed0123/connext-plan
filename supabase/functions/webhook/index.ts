// Alias do webhook da Cakto (URL curta: /functions/v1/webhook).
// Usa exatamente a mesma lógica de cakto-webhook.
import { handleCaktoWebhook } from "../_shared/cakto-webhook-handler.ts";

Deno.serve((req) => handleCaktoWebhook(req, "webhook"));
