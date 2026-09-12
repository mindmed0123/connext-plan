// Captura de erros das edge functions.
// Envia só identificadores (empresa/usuário) — nunca CPF, dados bancários ou token.
const DSN = Deno.env.get("SENTRY_DSN") ?? "";

const SENSIVEL = /(cpf|cnpj|chave_pix|agencia|conta|token|password|senha|authorization|apikey|secret)/i;

function limpar(obj: Record<string, unknown> = {}) {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) saida[k] = SENSIVEL.test(k) ? "[removido]" : v;
  return saida;
}

function endpoint(dsn: string) {
  try {
    const u = new URL(dsn);
    const projeto = u.pathname.replace("/", "");
    return {
      url: `https://${u.host}/api/${projeto}/store/`,
      chave: u.username,
    };
  } catch {
    return null;
  }
}

export async function capturarErro(
  erro: unknown,
  ctx: { funcao: string; empresaId?: string | null; userId?: string | null; extra?: Record<string, unknown> },
): Promise<string> {
  const incidente = crypto.randomUUID().slice(0, 8).toUpperCase();
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.error(`[${ctx.funcao}] incidente ${incidente}: ${mensagem}`);

  const alvo = DSN ? endpoint(DSN) : null;
  if (!alvo) return incidente;

  try {
    await fetch(alvo.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${alvo.chave}, sentry_client=lovable-edge/1.0`,
      },
      body: JSON.stringify({
        event_id: crypto.randomUUID().replaceAll("-", ""),
        timestamp: new Date().toISOString(),
        platform: "javascript",
        level: "error",
        server_name: ctx.funcao,
        tags: { funcao: ctx.funcao, empresa_id: ctx.empresaId ?? "", incidente },
        user: ctx.userId ? { id: ctx.userId } : undefined,
        extra: limpar(ctx.extra),
        exception: {
          values: [{ type: erro instanceof Error ? erro.name : "Error", value: mensagem }],
        },
      }),
    });
  } catch (e) {
    console.error("falha ao reportar incidente", e instanceof Error ? e.message : e);
  }
  return incidente;
}
