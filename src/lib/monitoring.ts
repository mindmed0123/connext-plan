import * as Sentry from "@sentry/react";

// Cole o DSN do Sentry aqui (ou defina VITE_SENTRY_DSN no ambiente).
export const SENTRY_DSN: string = import.meta.env.VITE_SENTRY_DSN ?? "";

/** Campos que nunca podem sair do navegador em um relatório de erro. */
const CAMPOS_SENSIVEIS =
  /(cpf|cnpj|chave_pix|agencia|conta_bancaria|numero_cartao|token|password|senha|authorization|apikey|secret)/i;

function limpar(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 4 || valor == null) return valor;
  if (Array.isArray(valor)) return valor.map((v) => limpar(v, profundidade + 1));
  if (typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[k] = CAMPOS_SENSIVEIS.test(k) ? "[removido]" : limpar(v, profundidade + 1);
    }
    return saida;
  }
  return valor;
}

export function iniciarMonitoramento() {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) delete event.request.headers;
      if (event.extra) event.extra = limpar(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = limpar(event.contexts) as typeof event.contexts;
      return event;
    },
  });
}

/** Identifica quem está usando, sem nome, e-mail ou documento. */
export function identificarUsuario(userId?: string | null, empresaId?: string | null) {
  if (!SENTRY_DSN) return;
  Sentry.setUser(userId ? { id: userId } : null);
  Sentry.setTag("empresa_id", empresaId ?? "");
}

/** Registra um erro e devolve o código do incidente para mostrar na tela. */
export function registrarIncidente(erro: unknown, contexto?: Record<string, unknown>): string {
  const fallback = Math.random().toString(36).slice(2, 10).toUpperCase();
  if (!SENTRY_DSN) {
    console.error("[incidente]", fallback, erro);
    return fallback;
  }
  const id = Sentry.captureException(erro, {
    extra: (limpar(contexto ?? {}) as Record<string, unknown>) ?? {},
  });
  return (id || fallback).slice(0, 8).toUpperCase();
}
