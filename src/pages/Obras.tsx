import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileSignature, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ORIGEM_LABEL, getRegiaoLabel } from "@/lib/obra-helpers";
import { useObraConfig } from "@/hooks/useObraConfig";
import { ObraFormDialog } from "@/components/obras/ObraFormDialog";
import { formatDateBR } from "@/lib/date";
import { calcularValoresObras, ADENDO_ATIVO } from "@/lib/valor-obra";

export default function Obras() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { statuses, rotulos } = useObraConfig();
  const [params] = useSearchParams();
  // Vindo do Painel: ?status=<etapa> ou ?etapa=nao_iniciada|em_execucao|concluida
  const [statusFilter, setStatusFilter] = useState<string>(params.get("status") ?? "all");
  const [etapaFilter, setEtapaFilter] = useState<string>(params.get("etapa") ?? "all");
  const [regiaoFilter, setRegiaoFilter] = useState<string>("all");
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [openForm, setOpenForm] = useState(false);

  const { data: obras, isLoading } = useQuery({
    queryKey: ["obras", { search, statusFilter, etapaFilter, regiaoFilter, mostrarArquivadas, nStatus: statuses.length }],
    queryFn: async () => {
      let q: any = supabase
        .from("obras")
        .select("*, orcamentos(valor_orcamento, status, created_at), obra_adendos(valor_total, status), contratos_clientes(id, numero_contrato, valor_global, status)")
        .order("created_at", { ascending: false });
      if (!mostrarArquivadas) q = q.eq("arquivada", false);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      else if (etapaFilter !== "all") {
        const chaves = statuses.filter((st) => st.categoria === etapaFilter).map((st) => st.chave);
        if (chaves.length) q = q.in("status", chaves);
      }
      if (regiaoFilter !== "all") q = q.eq("regiao_label", regiaoFilter);
      if (search.trim()) q = q.ilike("codigo_chamado", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: regioes } = useQuery({
    queryKey: ["regioes-obra"],
    queryFn: async () => {
      const { data } = await supabase.from("regioes_obra").select("*").order("nome");
      return data ?? [];
    },
  });

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getValorAdendos = (adendos: Array<{ valor_total: number; status: string }> | null) =>
    (adendos ?? [])
      .filter((a) => ADENDO_ATIVO.includes(a.status))
      .reduce((s, a) => s + Number(a.valor_total || 0), 0);

  /** Contratos que valem para a obra (encerrados ficam fora do valor). */
  const contratosVigentes = (contratos: Array<{ valor_global: number; status: string }> | null) =>
    (contratos ?? []).filter((c) => c.status !== "encerrado");

  /** Mesma regra do Painel (lib/valor-obra): contrato > orçamento aprovado > mais recente, + aditivos. */
  const getValorObra = (o: any): number | null => {
    const v = calcularValoresObras(
      (o.orcamentos ?? []).map((x: any) => ({ ...x, obra_id: o.id })),
      (o.obra_adendos ?? []).map((x: any) => ({ ...x, obra_id: o.id })),
      (o.contratos_clientes ?? []).map((x: any) => ({ ...x, obra_id: o.id })),
    ).get(o.id);
    return v ? v.valor : null;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Obras</h1>
          <p className="text-sm text-muted-foreground">Controle completo de chamados e execução</p>
        </div>
        <Button onClick={() => setOpenForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova obra
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código de chamado..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setEtapaFilter("all"); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {etapaFilter === "em_execucao" ? "Em execução (todas)" : etapaFilter === "nao_iniciada" ? "Não iniciadas (todas)" : etapaFilter === "concluida" ? "Concluídas (todas)" : "Todos os status"}
            </SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.chave} value={s.chave}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={regiaoFilter} onValueChange={setRegiaoFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Região" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {(regioes ?? []).map((r: any) => (
              <SelectItem key={r.id} value={r.nome}>{r.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={mostrarArquivadas}
            onCheckedChange={(v) => setMostrarArquivadas(v === true)}
          />
          Mostrar arquivadas
        </label>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{rotulos.codigo_obra}</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Engenheiro</TableHead>
              <TableHead>Recebido em</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (obras?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Nenhuma obra encontrada. Clique em "Nova obra" para criar.</TableCell></TableRow>
            )}
            {obras?.map((o: any) => {
              const valor = getValorObra(o);
              const contratos = contratosVigentes(o.contratos_clientes) as any[];
              const isAprovado =
                contratos.length > 0 ||
                o.orcamentos?.some((or: any) => or.status === "aprovado") ||
                getValorAdendos(o.obra_adendos) > 0;
              return (
                <TableRow key={o.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/obras/${o.id}`)}>
                  <TableCell className="font-medium">
                    {o.codigo_chamado}
                    {o.arquivada && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        Arquivada
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {contratos.length > 0 ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        <FileSignature className="h-3 w-3" />
                        {contratos.map((c) => c.numero_contrato ?? "s/nº").join(", ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{ORIGEM_LABEL[o.origem] ?? o.origem}</TableCell>
                  <TableCell className="text-sm">{getRegiaoLabel(o)}</TableCell>
                  <TableCell className="text-sm">{o.engenheiro_responsavel}</TableCell>
                  <TableCell className="text-sm">{formatDateBR(o.data_recebimento)}</TableCell>
                  <TableCell className={`text-right text-sm font-medium tabular-nums ${valor == null ? "text-muted-foreground" : isAprovado ? "text-success" : "text-foreground"}`}>
                    {valor == null ? "—" : formatBRL(valor)}
                  </TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ObraFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        onCreated={() => qc.invalidateQueries({ queryKey: ["obras"] })}
      />
    </div>
  );
}
