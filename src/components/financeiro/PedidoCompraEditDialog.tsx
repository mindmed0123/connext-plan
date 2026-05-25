import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { format } from "date-fns";
import { Trash2, FileText } from "lucide-react";

type PedidoCompra = {
  id: string;
  obra_id: string | null;
  codigo_chamado_avulso: string | null;
  numero_pedido: string | null;
  data_recebimento: string | null;
  valor: number | null;
  status: "aguardando" | "recebido";
};

export function PedidoCompraEditDialog({
  pedido,
  open,
  onOpenChange,
}: {
  pedido: PedidoCompra | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [codigoAvulso, setCodigoAvulso] = useState("");
  const [numero, setNumero] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<"aguardando" | "recebido">("aguardando");

  // NF inline
  const [nfNumero, setNfNumero] = useState("");
  const [nfData, setNfData] = useState("");
  const [nfValor, setNfValor] = useState("");

  useEffect(() => {
    if (pedido) {
      setCodigoAvulso(pedido.codigo_chamado_avulso ?? "");
      setNumero(pedido.numero_pedido ?? "");
      setDataRecebimento(pedido.data_recebimento ?? "");
      setValor(pedido.valor != null ? String(pedido.valor) : "");
      setStatus(pedido.status ?? "aguardando");
      setNfNumero(""); setNfData(""); setNfValor("");
    }
  }, [pedido]);

  const nfs = useQuery({
    queryKey: ["nfs-pedido", pedido?.id],
    enabled: !!pedido?.id && open,
    queryFn: async () =>
      (await supabase.from("notas_fiscais").select("*").eq("pedido_compra_id", pedido!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!pedido) return;
      const updates: any = {
        numero_pedido: numero.trim() || null,
        data_recebimento: dataRecebimento || null,
        valor: valor ? Number(valor) : 0,
        status,
      };
      if (!pedido.obra_id) {
        updates.codigo_chamado_avulso = codigoAvulso.trim() || null;
      }
      const { error } = await supabase.from("pedidos_compra").update(updates).eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido atualizado");
      qc.invalidateQueries({ queryKey: ["faturamento-pcs"] });
      qc.invalidateQueries({ queryKey: ["faturamento-nfs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const addNf = useMutation({
    mutationFn: async () => {
      if (!pedido) return;
      if (!nfNumero.trim()) throw new Error("Informe o número da NF");
      if (!nfData) throw new Error("Informe a data de emissão");
      const { error } = await supabase.from("notas_fiscais").insert([{
        obra_id: pedido.obra_id,
        codigo_chamado_avulso: pedido.obra_id ? null : (pedido.codigo_chamado_avulso ?? (codigoAvulso.trim() || null)),
        pedido_compra_id: pedido.id,
        numero_nf: nfNumero.trim(),
        data_emissao: nfData,
        valor: nfValor ? Number(nfValor) : (pedido.valor ?? 0),
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("NF adicionada ao pedido");
      setNfNumero(""); setNfData(""); setNfValor("");
      qc.invalidateQueries({ queryKey: ["nfs-pedido", pedido?.id] });
      qc.invalidateQueries({ queryKey: ["faturamento-nfs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar NF"),
  });

  const removeNf = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("NF removida");
      qc.invalidateQueries({ queryKey: ["nfs-pedido", pedido?.id] });
      qc.invalidateQueries({ queryKey: ["faturamento-nfs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover NF"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!pedido) return;
      const { error } = await supabase.from("pedidos_compra").delete().eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido excluído");
      qc.invalidateQueries({ queryKey: ["faturamento-pcs"] });
      qc.invalidateQueries({ queryKey: ["faturamento-nfs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar pedido de compra</DialogTitle>
          <DialogDescription>
            A data de recebimento alimenta automaticamente a agenda do dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!pedido.obra_id && (
            <div className="space-y-1.5">
              <Label>Código do chamado (avulso)</Label>
              <Input value={codigoAvulso} onChange={(e) => setCodigoAvulso(e.target.value)} placeholder="Ex: 123456" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nº pedido</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data recebimento</Label>
              <Input type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* NF vinculadas */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Notas fiscais vinculadas</h4>
            </div>

            {nfs.data && nfs.data.length > 0 && (
              <div className="space-y-1">
                {nfs.data.map((n: any) => (
                  <div key={n.id} className="flex items-center justify-between rounded-md bg-background px-2 py-1.5 text-xs">
                    <span className="truncate">
                      <span className="font-medium">NF {n.numero_nf}</span>
                      {" · "}{format(new Date(n.data_emissao), "dd/MM/yyyy")}
                      {" · "}{formatCurrency(n.valor)}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 px-2"
                      onClick={() => { if (confirm("Remover esta NF?")) removeNf.mutate(n.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nº NF</Label>
                <Input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} placeholder="Ex: 12345" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data emissão</Label>
                <Input type="date" value={nfData} onChange={(e) => setNfData(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" step="0.01" value={nfValor} onChange={(e) => setNfValor(e.target.value)}
                  placeholder={pedido.valor ? String(pedido.valor) : "0,00"} />
              </div>
              <Button size="sm" onClick={() => addNf.mutate()} disabled={addNf.isPending || !nfNumero || !nfData}>
                {addNf.isPending ? "Adicionando..." : "+ Adicionar NF"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:gap-2">
          <Button
            variant="destructive"
            onClick={() => { if (confirm("Excluir este pedido de compra?")) remove.mutate(); }}
            disabled={remove.isPending || save.isPending}
          >
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
