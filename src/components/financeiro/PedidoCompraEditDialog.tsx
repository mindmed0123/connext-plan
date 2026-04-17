import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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

  useEffect(() => {
    if (pedido) {
      setCodigoAvulso(pedido.codigo_chamado_avulso ?? "");
      setNumero(pedido.numero_pedido ?? "");
      setDataRecebimento(pedido.data_recebimento ?? "");
      setValor(pedido.valor != null ? String(pedido.valor) : "");
      setStatus(pedido.status ?? "aguardando");
    }
  }, [pedido]);

  const save = useMutation({
    mutationFn: async () => {
      if (!pedido) return;
      const updates: any = {
        numero_pedido: numero.trim() || null,
        data_recebimento: dataRecebimento || null,
        valor: valor ? Number(valor) : 0,
        status,
      };
      // Só permite editar codigo avulso se já era avulso (sem obra vinculada)
      if (!pedido.obra_id) {
        updates.codigo_chamado_avulso = codigoAvulso.trim() || null;
      }
      const { error } = await supabase.from("pedidos_compra").update(updates).eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido atualizado");
      qc.invalidateQueries({ queryKey: ["faturamento-pcs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
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
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar pedido de compra</DialogTitle>
          <DialogDescription>
            Atualize as informações do pedido, incluindo a data prevista de recebimento.
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
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:gap-2">
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Excluir este pedido de compra?")) remove.mutate();
            }}
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
