import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { getTodayDateInputValue } from "@/lib/date";

type Tipo = "rc" | "pc" | "nf";

const TITULO: Record<Tipo, string> = {
  rc: "Nova RC",
  pc: "Novo pedido de compra",
  nf: "Nova nota fiscal",
};

export function FaturamentoFormDialog({ tipo, open, onOpenChange }: { tipo: Tipo; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [vinculo, setVinculo] = useState<"existente" | "avulso">("existente");
  const [obraId, setObraId] = useState<string>("");
  const [codigoAvulso, setCodigoAvulso] = useState("");
  const [numero, setNumero] = useState("");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<string>(tipo === "nf" ? "" : "aguardando");

  // NF opcional ao criar PC
  const [withNf, setWithNf] = useState(false);
  const [nfNumero, setNfNumero] = useState("");
  const [nfData, setNfData] = useState("");
  const [nfValor, setNfValor] = useState("");

  const obras = useQuery({
    queryKey: ["obras-select"],
    enabled: open && vinculo === "existente",
    queryFn: async () => (await supabase.from("obras").select("id, codigo_chamado").order("codigo_chamado")).data ?? [],
  });

  const reset = () => {
    setVinculo("existente"); setObraId(""); setCodigoAvulso(""); setNumero(""); setData(getTodayDateInputValue()); setValor("");
    setStatus(tipo === "nf" ? "" : "aguardando");
    setWithNf(false); setNfNumero(""); setNfData(getTodayDateInputValue()); setNfValor("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (vinculo === "existente" && !obraId) throw new Error("Selecione uma obra");

      const baseObra = vinculo === "existente"
        ? { obra_id: obraId, codigo_chamado_avulso: null }
        : { obra_id: null, codigo_chamado_avulso: codigoAvulso.trim() || null };

      if (tipo === "rc") {
        const { error } = await supabase.from("rcs").insert([{
          ...baseObra,
          numero_rc: numero || null,
          data_rc: data || null,
          status: (status || "aguardando") as any,
        }]);
        if (error) throw error;
      } else if (tipo === "pc") {
        const { data: pcRow, error } = await supabase.from("pedidos_compra").insert([{
          ...baseObra,
          numero_pedido: numero || null,
          data_recebimento: data || null,
          valor: valor ? Number(valor) : 0,
          status: (status || "aguardando") as any,
        }]).select("id").single();
        if (error) throw error;
        if (withNf && nfNumero.trim() && nfData) {
          const { error: nfErr } = await supabase.from("notas_fiscais").insert([{
            ...baseObra,
            pedido_compra_id: pcRow!.id,
            numero_nf: nfNumero.trim(),
            data_emissao: nfData,
            valor: nfValor ? Number(nfValor) : (valor ? Number(valor) : 0),
          }]);
          if (nfErr) throw nfErr;
        }
      } else {
        if (!numero.trim()) throw new Error("Informe o número da NF");
        if (!data) throw new Error("Informe a data de emissão");
        const { error } = await supabase.from("notas_fiscais").insert([{
          ...baseObra,
          numero_nf: numero.trim(),
          data_emissao: data,
          valor: valor ? Number(valor) : 0,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cadastrado com sucesso");
      qc.invalidateQueries({ queryKey: ["faturamento-rcs"] });
      qc.invalidateQueries({ queryKey: ["faturamento-pcs"] });
      qc.invalidateQueries({ queryKey: ["faturamento-nfs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cadastrar"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITULO[tipo]}</DialogTitle>
          <DialogDescription>Vincule a uma obra cadastrada ou informe o código do chamado de uma obra antiga.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={vinculo} onValueChange={(v) => setVinculo(v as any)} className="grid grid-cols-2 gap-2">
            <Label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
              <RadioGroupItem value="existente" /> Obra cadastrada
            </Label>
            <Label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
              <RadioGroupItem value="avulso" /> Obra antiga (avulso)
            </Label>
          </RadioGroup>

          {vinculo === "existente" ? (
            <div className="space-y-1.5">
              <Label>Obra</Label>
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                <SelectContent>
                  {obras.data?.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.codigo_chamado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Código do chamado</Label>
              <Input value={codigoAvulso} onChange={(e) => setCodigoAvulso(e.target.value)} placeholder="Ex: 123456" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{tipo === "rc" ? "Nº RC" : tipo === "pc" ? "Nº pedido" : "Nº NF"}</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>
                {tipo === "nf" ? "Data emissão" : tipo === "pc" ? "Data de recebimento" : "Data"}
              </Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              {tipo === "pc" && (
                <p className="text-[11px] text-muted-foreground">
                  Esta data alimenta automaticamente a agenda de recebimentos.
                </p>
              )}
            </div>
          </div>

          {tipo !== "rc" && (
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          )}

          {tipo !== "nf" && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === "pc" && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={withNf} onChange={(e) => setWithNf(e.target.checked)} />
                Já tenho a nota fiscal deste pedido
              </label>
              {withNf && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nº NF</Label>
                      <Input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data emissão</Label>
                      <Input type="date" value={nfData} onChange={(e) => setNfData(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor da NF (R$)</Label>
                    <Input type="number" step="0.01" value={nfValor} onChange={(e) => setNfValor(e.target.value)}
                      placeholder={valor || "0,00"} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
