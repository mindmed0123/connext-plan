import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { getTodayDateInputValue } from "@/lib/date";

export function ReceberOCDialog({ ordemId, onClose }: { ordemId: string | null; onClose: () => void }) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [data, setData] = useState(getTodayDateInputValue());
  const [nf, setNf] = useState("");
  const [obs, setObs] = useState("");
  const [qtds, setQtds] = useState<Record<string, string>>({});

  const { data: oc } = useQuery({
    queryKey: [empresaId, "ordem-compra-receber", ordemId],
    enabled: !!empresaId && !!ordemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_compra")
        .select("*, fornecedores(nome), ordem_compra_itens(*), ordem_compra_recebimentos(id, ordem_compra_recebimento_itens(ordem_compra_item_id, quantidade))")
        .eq("id", ordemId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const recebidoDe = (itemId: string) => {
    let soma = 0;
    (oc?.ordem_compra_recebimentos ?? []).forEach((r: any) =>
      (r.ordem_compra_recebimento_itens ?? []).forEach((ri: any) => {
        if (ri.ordem_compra_item_id === itemId) soma += Number(ri.quantidade);
      }),
    );
    return soma;
  };

  const receber = useMutation({
    mutationFn: async () => {
      const itens = (oc?.ordem_compra_itens ?? [])
        .map((it: any) => ({ ordem_compra_item_id: it.id, quantidade: Number(qtds[it.id]) || 0 }))
        .filter((i: any) => i.quantidade > 0);
      if (!itens.length) throw new Error("Informe a quantidade recebida de ao menos um item");
      const { error } = await supabase.rpc("receber_ordem_compra" as any, {
        _ordem_id: ordemId,
        _data: data,
        _numero_nf: nf || null,
        _itens: itens,
        _observacoes: obs || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recebimento registrado. O título foi lançado em contas a pagar.");
      qc.invalidateQueries();
      setQtds({});
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (oc?.ordem_compra_itens ?? []).reduce(
    (s: number, it: any) => s + (Number(qtds[it.id]) || 0) * Number(it.preco_unitario), 0,
  );

  return (
    <Dialog open={!!ordemId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receber ordem de compra {oc?.numero ?? ""}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Data do recebimento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Nota fiscal</Label>
            <Input value={nf} onChange={(e) => setNf(e.target.value)} /></div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Pedido</TableHead>
              <TableHead className="text-right">Já recebido</TableHead>
              <TableHead className="w-[140px]">Recebendo agora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(oc?.ordem_compra_itens ?? []).map((it: any) => {
              const jaRecebido = recebidoDe(it.id);
              const falta = Number(it.quantidade) - jaRecebido;
              return (
                <TableRow key={it.id}>
                  <TableCell>
                    <div className="font-medium">{it.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.unidade} • {formatCurrency(Number(it.preco_unitario))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{Number(it.quantidade).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{jaRecebido.toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    <Input
                      type="number" step="0.01" min="0" max={falta}
                      value={qtds[it.id] ?? ""}
                      disabled={falta <= 0}
                      placeholder={falta <= 0 ? "completo" : String(falta)}
                      onChange={(e) => setQtds((q) => ({ ...q, [it.id]: e.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="space-y-1">
          <Label>Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>

        <p className="text-sm text-muted-foreground">
          Valor deste recebimento: <strong>{formatCurrency(total)}</strong> — gera o título em contas a pagar
          em {oc?.numero_parcelas ?? 1} parcela(s) e lança o material no custo da obra.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => receber.mutate()} disabled={receber.isPending}>Confirmar recebimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
