import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { OBRA_STATUS_LIST, OBRA_STATUS_LABEL, ORIGEM_LABEL, getRegiaoLabel } from "@/lib/obra-helpers";
import { ObraFormDialog } from "@/components/obras/ObraFormDialog";
import { ObraDetailSheet } from "@/components/obras/ObraDetailSheet";
import { format } from "date-fns";

export default function Obras() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regiaoFilter, setRegiaoFilter] = useState<string>("all");
  const [openForm, setOpenForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: obras, isLoading } = useQuery({
    queryKey: ["obras", { search, statusFilter, regiaoFilter }],
    queryFn: async () => {
      let q = supabase
        .from("obras")
        .select("*, orcamentos(valor_orcamento, status, created_at)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
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

  const getValorObra = (orcs: Array<{ valor_orcamento: number; status: string; created_at: string }> | null) => {
    if (!orcs || orcs.length === 0) return null;
    const aprovado = orcs.find((o) => o.status === "aprovado");
    if (aprovado) return Number(aprovado.valor_orcamento);
    const recente = [...orcs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return Number(recente.valor_orcamento);
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {OBRA_STATUS_LIST.map((s) => (
              <SelectItem key={s} value={s}>{OBRA_STATUS_LABEL[s]}</SelectItem>
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
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
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
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (obras?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Nenhuma obra encontrada. Clique em "Nova obra" para criar.</TableCell></TableRow>
            )}
            {obras?.map((o: any) => {
              const valor = getValorObra(o.orcamentos);
              const isAprovado = o.orcamentos?.some((or: any) => or.status === "aprovado");
              return (
                <TableRow key={o.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => setSelectedId(o.id)}>
                  <TableCell className="font-medium">{o.codigo_chamado}</TableCell>
                  <TableCell className="text-sm">{ORIGEM_LABEL[o.origem]}</TableCell>
                  <TableCell className="text-sm">{getRegiaoLabel(o)}</TableCell>
                  <TableCell className="text-sm">{o.engenheiro_responsavel}</TableCell>
                  <TableCell className="text-sm">{format(new Date(o.data_recebimento), "dd/MM/yyyy")}</TableCell>
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
      <ObraDetailSheet obraId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
