import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ObraStatus } from "@/lib/obra-helpers";
import { REGIAO_LABEL } from "@/lib/obra-helpers";
import {
  STATUS_EM_ORCAMENTO,
  STATUS_EM_EXECUCAO,
  STATUS_FINALIZADAS_AGUARD,
} from "@/lib/dashboard-helpers";

export interface DashboardFilters {
  from?: string;
  to?: string;
  regiao?: string | "todas";
  engenheiro?: string | "todos";
  status?: ObraStatus | "todas";
  responsavelId?: string | "todos";
  terceirizadoId?: string | "todos";
}

export function useDashboardData(filters: DashboardFilters) {
  return useQuery({
    queryKey: ["dashboard-data", filters],
    queryFn: async () => {
      const [
        obrasRes,
        orcsRes,
        contratacoesRes,
        parcelasRes,
        materiaisRes,
        nfsRes,
        recsRes,
        responsaveisRes,
        pessoasRes,
        timelineRes,
        fotosRes,
      ] = await Promise.all([
        supabase
          .from("obras")
          .select(
            "id,codigo_chamado,endereco,descricao_servico,engenheiro_responsavel,regiao,regiao_label,origem,status,data_recebimento,created_at,updated_at",
          ),
        supabase
          .from("orcamentos")
          .select("id,obra_id,valor_orcamento,status,data_envio,created_at,updated_at"),
        supabase
          .from("contratacoes_terceirizado")
          .select(
            "id,obra_id,terceirizado_id,valor_total,status_financeiro,created_at,updated_at",
          ),
        supabase
          .from("parcelas_pagamento")
          .select(
            "id,contratacao_id,numero_parcela,valor,status,data_prevista,data_pagamento,created_at",
          ),
        supabase.from("materiais_obra").select("id,obra_id,valor_total,data_compra"),
        supabase.from("notas_fiscais").select("id,obra_id,numero_nf,valor,data_emissao"),
        supabase
          .from("recebimentos")
          .select("id,obra_id,valor,status,data_prevista,data_recebido"),
        supabase.from("obra_responsaveis").select("obra_id,pessoa_id,papel"),
        supabase.from("pessoas").select("id,nome,tipo,status"),
        supabase.from("obra_timeline").select("obra_id,evento,created_at"),
        supabase.from("fotos_obra").select("obra_id,data_upload"),
      ]);

      const obras = obrasRes.data ?? [];
      const orcs = orcsRes.data ?? [];
      const contratacoes = contratacoesRes.data ?? [];
      const parcelas = parcelasRes.data ?? [];
      const materiais = materiaisRes.data ?? [];
      const nfs = nfsRes.data ?? [];
      const recs = recsRes.data ?? [];
      const responsaveis = responsaveisRes.data ?? [];
      const pessoas = pessoasRes.data ?? [];
      const timeline = timelineRes.data ?? [];
      const fotos = fotosRes.data ?? [];

      // Apply filters
      const fromDate = filters.from ? new Date(filters.from) : null;
      const toDate = filters.to ? new Date(filters.to) : null;
      const inRange = (d?: string | null) => {
        if (!d) return true;
        const dt = new Date(d);
        if (fromDate && dt < fromDate) return false;
        if (toDate && dt > toDate) return false;
        return true;
      };

      const responsibleByObra = new Map<string, string[]>();
      for (const r of responsaveis) {
        const arr = responsibleByObra.get(r.obra_id) ?? [];
        arr.push(r.pessoa_id);
        responsibleByObra.set(r.obra_id, arr);
      }

      const obrasFiltered = obras.filter((o) => {
        if (!inRange(o.created_at)) return false;
        if (filters.regiao && filters.regiao !== "todas") {
          const label = (o as any).regiao_label ?? (REGIAO_LABEL as any)[o.regiao] ?? o.regiao;
          if (label !== filters.regiao) return false;
        }
        if (
          filters.engenheiro &&
          filters.engenheiro !== "todos" &&
          o.engenheiro_responsavel !== filters.engenheiro
        )
          return false;
        if (filters.status && filters.status !== "todas" && o.status !== filters.status)
          return false;
        if (filters.responsavelId && filters.responsavelId !== "todos") {
          const ids = responsibleByObra.get(o.id) ?? [];
          if (!ids.includes(filters.responsavelId)) return false;
        }
        return true;
      });
      const obraIds = new Set(obrasFiltered.map((o) => o.id));

      // Valor representativo da obra (orçamento aprovado > maior valor)
      const valorPorObra = new Map<string, number>();
      for (const o of orcs) {
        const v = Number(o.valor_orcamento || 0);
        const atual = valorPorObra.get(o.obra_id) ?? 0;
        if (o.status === "aprovado") valorPorObra.set(o.obra_id, Math.max(atual, v));
        else if (atual === 0) valorPorObra.set(o.obra_id, v);
      }

      const sumValueByObras = (predicate: (s: ObraStatus) => boolean) =>
        obrasFiltered
          .filter((o) => predicate(o.status as ObraStatus))
          .reduce((s, o) => s + (valorPorObra.get(o.id) ?? 0), 0);

      const countByObras = (predicate: (s: ObraStatus) => boolean) =>
        obrasFiltered.filter((o) => predicate(o.status as ObraStatus)).length;

      // Agregados por etapa de obra
      const porEtapa = new Map<ObraStatus, { qtd: number; valor: number }>();
      for (const o of obrasFiltered) {
        const cur = porEtapa.get(o.status as ObraStatus) ?? { qtd: 0, valor: 0 };
        cur.qtd += 1;
        cur.valor += valorPorObra.get(o.id) ?? 0;
        porEtapa.set(o.status as ObraStatus, cur);
      }

      // Financeiro
      const valorTotalOrcado = orcs
        .filter((o) => obraIds.has(o.obra_id))
        .reduce((s, o) => s + Number(o.valor_orcamento || 0), 0);

      const valorTotalAprovado = orcs
        .filter((o) => obraIds.has(o.obra_id) && o.status === "aprovado")
        .reduce((s, o) => s + Number(o.valor_orcamento || 0), 0);

      const valorEmOrcamento = sumValueByObras((s) =>
        STATUS_EM_ORCAMENTO.includes(s),
      );
      const valorEmExecucao = sumValueByObras((s) => STATUS_EM_EXECUCAO.includes(s));
      const valorFinalizadasAguard = sumValueByObras((s) =>
        STATUS_FINALIZADAS_AGUARD.includes(s),
      );
      const qtdFinalizadasAguard = countByObras((s) =>
        STATUS_FINALIZADAS_AGUARD.includes(s),
      );

      const valorTotalFaturado = nfs
        .filter((n) => obraIds.has(n.obra_id))
        .reduce((s, n) => s + Number(n.valor || 0), 0);

      // Incluir recebimentos sem obra vinculada (manuais) + os das obras filtradas
      const recsFiltered = recs.filter((r) => !r.obra_id || obraIds.has(r.obra_id));
      const valorRecebido = recsFiltered
        .filter((r) => r.status === "recebido")
        .reduce((s, r) => s + Number(r.valor || 0), 0);
      const valorAReceber = recsFiltered
        .filter((r) => r.status === "a_receber")
        .reduce((s, r) => s + Number(r.valor || 0), 0);
      const valorEmAberto = Math.max(0, valorTotalFaturado - valorRecebido);

      const hoje = new Date();
      const em15 = new Date();
      em15.setDate(hoje.getDate() + 15);
      const valorReceber15d = recsFiltered
        .filter(
          (r) =>
            r.status === "a_receber" &&
            r.data_prevista &&
            new Date(r.data_prevista) <= em15 &&
            new Date(r.data_prevista) >= hoje,
        )
        .reduce((s, r) => s + Number(r.valor || 0), 0);

      // Terceirizados
      const contratacoesFiltered = contratacoes.filter((c) => obraIds.has(c.obra_id));
      const contratacaoIds = new Set(contratacoesFiltered.map((c) => c.id));
      const parcelasFiltered = parcelas.filter((p) =>
        contratacaoIds.has(p.contratacao_id),
      );
      const valorContratadoTerc = contratacoesFiltered.reduce(
        (s, c) => s + Number(c.valor_total || 0),
        0,
      );
      const valorPagoTerc = parcelasFiltered
        .filter((p) => p.status === "pago")
        .reduce((s, p) => s + Number(p.valor || 0), 0);
      const valorPendenteTerc = Math.max(0, valorContratadoTerc - valorPagoTerc);

      // Próximo dia 1 e dia 15
      const proximoDia = (dia: number) => {
        const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
        if (d < hoje) d.setMonth(d.getMonth() + 1);
        return d;
      };
      const dia1 = proximoDia(1);
      const dia15 = proximoDia(15);
      const totalDia1 = recsFiltered
        .filter(
          (r) =>
            r.status === "a_receber" &&
            r.data_prevista &&
            new Date(r.data_prevista).toDateString() === dia1.toDateString(),
        )
        .reduce((s, r) => s + Number(r.valor || 0), 0);
      const totalDia15 = recsFiltered
        .filter(
          (r) =>
            r.status === "a_receber" &&
            r.data_prevista &&
            new Date(r.data_prevista).toDateString() === dia15.toDateString(),
        )
        .reduce((s, r) => s + Number(r.valor || 0), 0);

      // Materiais
      const valorMateriais = materiais
        .filter((m) => obraIds.has(m.obra_id))
        .reduce((s, m) => s + Number(m.valor_total || 0), 0);

      return {
        obras: obrasFiltered,
        valorPorObra,
        porEtapa,
        responsibleByObra,
        pessoas,
        nfs: nfs.filter((n) => obraIds.has(n.obra_id)),
        recebimentos: recsFiltered,
        contratacoes: contratacoesFiltered,
        parcelas: parcelasFiltered,
        materiais: materiais.filter((m) => obraIds.has(m.obra_id)),
        timeline: timeline.filter((t) => obraIds.has(t.obra_id)),
        fotos: fotos.filter((f) => obraIds.has(f.obra_id)),

        // KPIs
        totalAtivas: obrasFiltered.filter((o) => o.status !== "pago").length,
        qtdObrasExecutadas: obrasFiltered.filter((o) =>
          ["finalizado","aguardando_rc","aguardando_pedido_compra","aguardando_nf","aguardando_pagamento","pago"].includes(o.status as string)
        ).length,
        valorObrasExecutadas: obrasFiltered
          .filter((o) => ["finalizado","aguardando_rc","aguardando_pedido_compra","aguardando_nf","aguardando_pagamento","pago"].includes(o.status as string))
          .reduce((s, o) => s + (valorPorObra.get(o.id) ?? 0), 0),
        valorEmOrcamento,
        valorEmExecucao,
        valorFinalizadasAguard,
        qtdFinalizadasAguard,
        valorAReceber,
        valorReceber15d,
        valorPagoTerc,
        valorPendenteTerc,
        valorTotalOrcado,
        valorTotalAprovado,
        valorTotalFaturado,
        valorRecebido,
        valorEmAberto,
        valorContratadoTerc,
        valorMateriais,

        totalDia1,
        totalDia15,
        proximoDia1: dia1,
        proximoDia15: dia15,

        // Listas auxiliares
        engenheiros: Array.from(
          new Set(obras.map((o) => o.engenheiro_responsavel).filter(Boolean)),
        ),
      };
    },
  });
}

export type DashboardData = NonNullable<ReturnType<typeof useDashboardData>["data"]>;
