import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR } from "@/lib/date";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Lancamento = {
  data: string | null;
  descricao: string;
  categoria: string;
  tipo: "receita" | "despesa";
  status: string;
  valor: number;
  origem: string;
};

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "receita" | "despesa" | "saldo" }) {
  const color =
    tone === "receita" ? "text-success" : tone === "despesa" ? "text-destructive" : value >= 0 ? "text-success" : "text-destructive";
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone ? color : ""}`}>{formatCurrency(value)}</p>
    </div>
  );
}

export function DreTab({ obraId }: { obraId: string }) {
  const { data: resumo } = useQuery({
    queryKey: ["obra-dre-resumo", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_obra_financeiro_resumo" as any, { _obra_id: obraId });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as any;
    },
  });

  const { data: lancamentos } = useQuery({
    queryKey: ["obra-dre-lancamentos", obraId],
    queryFn: async (): Promise<Lancamento[]> => {
      const [fin, mat, cart, nfs, receb] = await Promise.all([
        supabase
          .from("lancamentos_financeiros")
          .select("descricao, tipo, status, valor, data_competencia, data_realizado, data_vencimento, origem, categorias_financeiras(nome)")
          .eq("obra_id", obraId),
        supabase.from("materiais_obra").select("descricao, fornecedor, valor_total, data_compra").eq("obra_id", obraId),
        supabase.from("cartao_despesas").select("descricao, categoria, valor, data_compra").eq("obra_id", obraId),
        supabase.from("notas_fiscais").select("numero_nf, valor, data_emissao").eq("obra_id", obraId),
        supabase.from("recebimentos").select("descricao, valor, status, data_recebido, data_prevista").eq("obra_id", obraId),
      ]);

      const list: Lancamento[] = [];
      for (const l of fin.data ?? []) {
        list.push({
          data: (l as any).data_realizado ?? (l as any).data_vencimento ?? (l as any).data_competencia,
          descricao: l.descricao,
          categoria: (l as any).categorias_financeiras?.nome ?? "—",
          tipo: l.tipo as any,
          status: l.status,
          valor: Number(l.valor || 0),
          origem: (l as any).origem ?? "financeiro",
        });
      }
      for (const m of mat.data ?? []) {
        list.push({
          data: m.data_compra,
          descricao: m.descricao + (m.fornecedor ? ` — ${m.fornecedor}` : ""),
          categoria: "Materiais",
          tipo: "despesa",
          status: "realizado",
          valor: Number(m.valor_total || 0),
          origem: "material",
        });
      }
      for (const c of cart.data ?? []) {
        list.push({
          data: c.data_compra,
          descricao: c.descricao || c.categoria || "Despesa de cartão",
          categoria: c.categoria || "Cartão de crédito",
          tipo: "despesa",
          status: "realizado",
          valor: Number(c.valor || 0),
          origem: "cartao",
        });
      }
      for (const n of nfs.data ?? []) {
        list.push({
          data: (n as any).data_emissao,
          descricao: `NF ${(n as any).numero_nf ?? ""}`.trim(),
          categoria: "Faturamento",
          tipo: "receita",
          status: "faturado",
          valor: Number((n as any).valor || 0),
          origem: "nota_fiscal",
        });
      }
      for (const r of receb.data ?? []) {
        list.push({
          data: (r as any).data_recebido ?? (r as any).data_prevista,
          descricao: (r as any).descricao || "Recebimento",
          categoria: "Recebimentos",
          tipo: "receita",
          status: (r as any).status === "recebido" ? "realizado" : "previsto",
          valor: Number((r as any).valor || 0),
          origem: "recebimento",
        });
      }
      return list.sort((a, b) => (String(a.data) < String(b.data) ? 1 : -1));
    },
  });


  const r = resumo ?? {};
  const receitaOrcada = Number(r.receita_orcada || 0);
  const receitaFaturada = Number(r.receita_faturada || 0);
  const receitaRecebida = Number(r.receita_recebida || 0);
  const custoMateriais = Number(r.custo_materiais || 0);
  const custoTercPago = Number(r.custo_terceirizados_pago || 0);
  const custoTercPrev = Number(r.custo_terceirizados_previsto || 0);
  const custoCartao = Number(r.custo_cartao || 0);
  const despesas = Number(r.despesas_realizadas || 0);
  const custoTotal = Number(r.custo_total || 0);
  const saldo = Number(r.saldo || 0);
  const margemPct = receitaOrcada > 0 ? (saldo / receitaOrcada) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita orçada (contrato + adendos)" value={receitaOrcada} tone="receita" />
        <Kpi label="Receita faturada" value={receitaFaturada} tone="receita" />
        <Kpi label="Receita recebida" value={receitaRecebida} tone="receita" />
        <Kpi label="Custo total" value={custoTotal} tone="despesa" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">DRE da obra</h3>
            <p className="text-xs text-muted-foreground">Balanço geral consolidado</p>
          </div>
          <div className="divide-y text-sm">
            {[
              ["(+) Receita orçada", receitaOrcada, "text-success"],
              ["(+) Receita faturada", receitaFaturada, "text-muted-foreground"],
              ["(+) Receita recebida", receitaRecebida, "text-success"],
              ["(-) Materiais", custoMateriais, "text-destructive"],
              ["(-) Terceirizados pagos", custoTercPago, "text-destructive"],
              ["(-) Terceirizados previstos", custoTercPrev, "text-muted-foreground"],
              ["(-) Cartão de crédito", custoCartao, "text-destructive"],
              ["(-) Outras despesas", despesas, "text-destructive"],
              ["(=) Custo total", custoTotal, "text-destructive"],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{label as string}</span>
                <span className={`font-medium tabular-nums ${cls as string}`}>{formatCurrency(value as number)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-surface-muted px-4 py-3">
              <span className="font-semibold">Resultado da obra</span>
              <span className={`text-base font-bold tabular-nums ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(saldo)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Kpi label="Materiais" value={custoMateriais} tone="despesa" />
          <Kpi label="Terceirizados (pago)" value={custoTercPago} tone="despesa" />
          <Kpi label="Cartão de crédito" value={custoCartao} tone="despesa" />
          <Kpi label="Outras despesas" value={despesas} tone="despesa" />
          <div className="rounded-lg border bg-card p-4 sm:col-span-2">
            <p className="text-xs text-muted-foreground">Margem sobre receita orçada</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${margemPct >= 0 ? "text-success" : "text-destructive"}`}>
              {margemPct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Lançamentos da obra</h3>
          <p className="text-xs text-muted-foreground">Financeiro, materiais e cartão de crédito</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(lancamentos?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum lançamento vinculado a esta obra.
                </TableCell>
              </TableRow>
            )}
            {lancamentos?.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{l.data ? formatDateBR(l.data) : "—"}</TableCell>
                <TableCell className="text-sm font-medium">{l.descricao}</TableCell>
                <TableCell className="text-sm">{l.categoria}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.origem}</TableCell>
                <TableCell>
                  <Badge variant={l.status === "realizado" ? "default" : "secondary"} className="text-[10px]">
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell
                  className={`text-right text-sm font-medium tabular-nums ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}
                >
                  {l.tipo === "receita" ? "+" : "-"} {formatCurrency(l.valor)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
