import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSignature, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR } from "@/lib/date";
import { BUCKET_CONTRATOS, CONTRATO_STATUS, ContratoFormDialog, type ContratoPrefill } from "@/components/contratos/ContratoFormDialog";

export default function Contratos() {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [prefill, setPrefill] = useState<ContratoPrefill | undefined>();
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const { data = [], isLoading } = useQuery({
    queryKey: [empresaId, "contratos", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("contratos_clientes")
        .select("*, obras(codigo_chamado), clientes(nome)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "todos") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sugestão de contrato a partir de um orçamento aprovado (?orcamento=<id>)
  const orcamentoId = params.get("orcamento");
  useEffect(() => {
    if (!orcamentoId) return;
    void (async () => {
      const { data: orc } = await supabase
        .from("orcamentos")
        .select("id, numero, obra_id, descricao, valor_total, valor_orcamento, obras(codigo_chamado, cliente_id, descricao_servico)")
        .eq("id", orcamentoId)
        .maybeSingle();
      if (!orc) return;
      const o = orc as any;
      setPrefill({
        obra_id: o.obra_id,
        cliente_id: o.obras?.cliente_id ?? null,
        objeto: o.descricao ?? o.obras?.descricao_servico ?? `Contrato referente ao orçamento ${o.numero ?? ""}`.trim(),
        valor_global: Number(o.valor_total ?? o.valor_orcamento ?? 0),
        numero_contrato: null,
      });
      setEditing(null);
      setOpen(true);
      params.delete("orcamento");
      setParams(params, { replace: true });
    })();
  }, [orcamentoId]);

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("contratos_clientes").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Você não tem permissão para excluir este contrato.");
    },
    onSuccess: () => {
      toast.success("Contrato excluído");
      qc.invalidateQueries({ queryKey: [empresaId, "contratos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const baixar = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET_CONTRATOS).createSignedUrl(path, 60);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank");
  };

  const lista = data.filter((c: any) => {
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    return [c.numero_contrato, c.objeto, c.obras?.codigo_chamado, c.clientes?.nome]
      .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(t));
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contratos de cliente</h1>
          <p className="text-sm text-muted-foreground">Base das medições e do faturamento de cada obra</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setPrefill(undefined); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo contrato
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por número, obra, cliente ou objeto" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(CONTRATO_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contrato</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Valor global</TableHead>
              <TableHead>Retenção</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && lista.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</TableCell></TableRow>
            )}
            {lista.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileSignature className="h-4 w-4 text-muted-foreground" />
                    {c.numero_contrato ?? "s/nº"}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{c.objeto}</p>
                </TableCell>
                <TableCell>{c.obras?.codigo_chamado ?? "—"}</TableCell>
                <TableCell>{c.clientes?.nome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(c.valor_global ?? 0))}</TableCell>
                <TableCell className="text-xs">
                  {Number(c.retencao_contratual_pct ?? 0).toFixed(2)}%
                  {c.retencao_devolucao_prevista && <div className="text-muted-foreground">devolve {formatDateBR(c.retencao_devolucao_prevista)}</div>}
                </TableCell>
                <TableCell className="text-xs">
                  {c.data_inicio ? formatDateBR(c.data_inicio) : "—"} → {c.data_fim ? formatDateBR(c.data_fim) : "—"}
                </TableCell>
                <TableCell><Badge variant="secondary">{CONTRATO_STATUS[c.status] ?? c.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.documento_url && (
                      <Button size="icon" variant="ghost" onClick={() => baixar(c.documento_url)} title="Baixar contrato">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setPrefill(undefined); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Excluir contrato?") && excluir.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ContratoFormDialog open={open} onOpenChange={setOpen} contrato={editing} prefill={prefill} />
    </div>
  );
}
