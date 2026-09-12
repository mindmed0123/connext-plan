// Resumo de prazos e novidades por e-mail.
// Chamada apenas pelo agendador (pg_cron) com a service role.
// Multiempresa: tudo é filtrado por empresa_id; nunca aceita ids do corpo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const brl = (v: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
const dataBR = (d?: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "");
const hojeSP = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

type Item = { titulo: string; detalhe?: string };
type Grupo = { titulo: string; itens: Item[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const claims = authHeader?.startsWith("Bearer ")
    ? parseJwtClaims(authHeader.slice("Bearer ".length).trim())
    : null;
  if (claims?.role !== "service_role") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const hoje = hojeSP();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const diaSemana = hoje.getDay(); // 1 = segunda
  const em7 = new Date(hoje.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const desde = new Date(hoje.getTime() - 1 * 86400000).toISOString();
  const desdeSemana = new Date(hoje.getTime() - 7 * 86400000).toISOString();

  const { data: prefs, error: prefErr } = await supabase
    .from("notificacao_preferencias")
    .select("*")
    .eq("ativo", true);
  if (prefErr) {
    console.error("prefs", prefErr.message);
    return new Response(JSON.stringify({ error: "prefs" }), { status: 500, headers: corsHeaders });
  }

  let enviados = 0;
  const pulados: string[] = [];

  for (const pref of prefs ?? []) {
    const semanal = pref.frequencia === "semanal";
    if (semanal && diaSemana !== 1) continue;
    const empresaId = pref.empresa_id as string;
    const janela = semanal ? desdeSemana : desde;

    // Destinatário: e-mail da pessoa vinculada ao usuário, dentro da empresa.
    const { data: pessoa } = await supabase
      .from("pessoas")
      .select("email, nome")
      .eq("empresa_id", empresaId)
      .eq("user_id", pref.user_id)
      .maybeSingle();
    const email = pessoa?.email as string | undefined;
    if (!email) continue;

    const grupos: Grupo[] = [];

    if (pref.contas_a_vencer) {
      const { data } = await supabase
        .from("contas_pagar_parcelas")
        .select("valor, data_vencimento, numero, conta_id, contas_pagar!inner(descricao, empresa_id)")
        .eq("empresa_id", empresaId)
        .neq("status", "pago")
        .gte("data_vencimento", hojeISO)
        .lte("data_vencimento", em7)
        .order("data_vencimento");
      if (data?.length) {
        grupos.push({
          titulo: "Contas a vencer nos próximos 7 dias",
          itens: data.map((p: Record<string, any>) => ({
            titulo: p.contas_pagar?.descricao ?? "Conta a pagar",
            detalhe: `${brl(p.valor)} em ${dataBR(p.data_vencimento)}`,
          })),
        });
      }
    }

    if (pref.recebimento_vencido) {
      const { data } = await supabase
        .from("recebimentos")
        .select("valor, valor_recebido, data_prevista, descricao")
        .eq("empresa_id", empresaId)
        .neq("status", "recebido")
        .lt("data_prevista", hojeISO)
        .order("data_prevista");
      if (data?.length) {
        grupos.push({
          titulo: "Recebimentos vencidos",
          itens: data.map((r: Record<string, any>) => ({
            titulo: r.descricao ?? "Recebimento",
            detalhe: `${brl(Number(r.valor) - Number(r.valor_recebido ?? 0))} vencido em ${dataBR(r.data_prevista)}`,
          })),
        });
      }
    }

    if (pref.medicao_aprovada) {
      const { data } = await supabase
        .from("medicoes")
        .select("numero_medicao, referencia, valor_medido, aprovado_em")
        .eq("empresa_id", empresaId)
        .eq("status", "aprovada")
        .gte("aprovado_em", janela);
      if (data?.length) {
        grupos.push({
          titulo: "Medições aprovadas",
          itens: data.map((m: Record<string, any>) => ({
            titulo: `Medição ${m.numero_medicao}${m.referencia ? ` — ${m.referencia}` : ""}`,
            detalhe: brl(m.valor_medido),
          })),
        });
      }
    }

    if (pref.nf_emitida) {
      const { data } = await supabase
        .from("notas_fiscais")
        .select("numero_nf, valor, data_emissao")
        .eq("empresa_id", empresaId)
        .gte("created_at", janela);
      if (data?.length) {
        grupos.push({
          titulo: "Notas fiscais emitidas",
          itens: data.map((n: Record<string, any>) => ({
            titulo: `NF ${n.numero_nf}`,
            detalhe: `${brl(n.valor)} em ${dataBR(n.data_emissao)}`,
          })),
        });
      }
    }

    if (pref.orcamento_decidido) {
      const { data } = await supabase
        .from("orcamentos")
        .select("numero, numero_orcamento, status, valor_total, data_resposta, updated_at")
        .eq("empresa_id", empresaId)
        .in("status", ["aprovado", "reprovado"])
        .gte("updated_at", janela);
      if (data?.length) {
        grupos.push({
          titulo: "Orçamentos aprovados ou reprovados",
          itens: data.map((o: Record<string, any>) => ({
            titulo: `Orçamento ${o.numero ?? o.numero_orcamento ?? ""} — ${o.status}`,
            detalhe: brl(o.valor_total),
          })),
        });
      }
    }

    if (pref.rdo_reprovado) {
      const { data } = await supabase
        .from("diario_obra")
        .select("data_envio, obras(codigo_chamado)")
        .eq("empresa_id", empresaId)
        .eq("status", "reprovado")
        .gte("updated_at", janela);
      if (data?.length) {
        grupos.push({
          titulo: "Diários de obra reprovados",
          itens: data.map((d: Record<string, any>) => ({
            titulo: d.obras?.codigo_chamado ?? "Obra",
            detalhe: `Diário de ${dataBR(d.data_envio)}`,
          })),
        });
      }
    }

    if (grupos.length === 0) continue;

    const chave = semanal ? `semanal-${hojeISO}` : `diario-${hojeISO}`;
    const { error: dedupeErr } = await supabase.from("notificacao_envios").insert({
      empresa_id: empresaId,
      user_id: pref.user_id,
      destinatario: email,
      evento: "resumo",
      chave,
      referencia_data: hojeISO,
      canal: "email",
    });
    if (dedupeErr) {
      pulados.push(email);
      continue; // já enviado hoje
    }

    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome")
      .eq("id", empresaId)
      .maybeSingle();

    const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "avisos-sistema",
        recipientEmail: email,
        idempotencyKey: `avisos-${empresaId}-${pref.user_id}-${chave}`,
        empresaId,
        templateData: {
          empresaNome: empresa?.nome ?? null,
          periodo: dataBR(hojeISO),
          grupos,
        },
      },
    });
    if (sendErr) {
      console.error("send", email, sendErr.message);
      continue;
    }
    enviados++;
  }

  return new Response(JSON.stringify({ enviados, pulados: pulados.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
