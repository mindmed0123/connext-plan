import { useEffect, useState } from "react";
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
import { emptyRetencoes, nfPayload, RetencoesNfFields, type RetencoesNf } from "@/components/financeiro/RetencoesNfFields";

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
  const [retencoes, setRetencoes] = useState<RetencoesNf>(emptyRetencoes());
  const [regras, setRegras] = useState<any>(null);
  const [status, setStatus] = useState<string>(tipo === "nf" ? "" : "aguardando");

  // NF opcional ao criar PC
  const [withNf, setWithNf] = useState(false);
  const [nfNumero, setNfNumero] = useState("");
  const [nfData, setNfData] = useState("");
  const [nfValor, setNfValor] = useState("");

  const [pcId, setPcId] = useState<string>("");

  const obras = useQuery({
    queryKey: ["obras-select"],
    enabled: open && vinculo === "existente",
    queryFn: async () => (await (supabase.from("obras")).select("id, codigo_chamado").eq("arquivada", false).order("codigo_chamado")).data ?? [],
  });

  const pcsObra = useQuery({
    queryKey: ["pcs-sem-nf", obraId],
    enabled: open && tipo === "nf" && !!obraId,
    queryFn: async () => {
      const [{ data: pcs }, { data: nfs }] = await Promise.all([
        supabase.from("pedidos_compra").select("id, numero_pedido, valor").eq("obra_id", obraId).order("created_at", { ascending: false }),
        supabase.from("notas_fiscais").select("pedido_compra_id").eq("obra_id", obraId),
      ]);
      const usados = new Set((nfs ?? []).map((n) => n.pedido_compra_id).filter(Boolean));
      return (pcs ?? []).filter((p) => !usados.has(p.id));
    },
  });

  useEffect(() => {
    const lista = pcsObra.data ?? [];
    if (!pcId && lista.length === 1) setPcId(lista[0].id);
  }, [pcsObra.data]);

  useEffect(() => {
    if ((tipo !== "nf" && !(tipo === "pc" && withNf)) || !obraId) return;
    void (async () => {
      const [{ data: obra }, { data: empresa }] = await Promise.all([
        (supabase.from("obras")).select("clientes(aliquota_iss,retem_iss,retem_inss,retem_irrf,retem_csrf)").eq("id", obraId).single(),
        supabase.from("empresas").select("cprb").limit(1).single(),
      ]);
      setRegras({ ...(obra?.clientes ?? {}), cprb: Boolean(empresa?.cprb) });
    })();
  }, [obraId, tipo, withNf]);

  useEffect(() => {
    if ((tipo !== "nf" && !(tipo === "pc" && withNf)) || !regras) return;
      const brutoTexto = tipo === "pc" ? (nfValor || valor) : valor;
      const bruto = Number(brutoTexto || 0);
      const aliquotaInss = regras.cprb ? 3.5 : 11;
      const baseInss = Math.max(0, bruto - Number(retencoes.valor_deducoes_inss || 0));
      setRetencoes((atual) => ({
        ...atual,
        valor_bruto: brutoTexto,
        base_inss: String(baseInss), aliquota_inss: String(aliquotaInss),
        aliquota_iss: String(regras.aliquota_iss ?? 0),
        ret_inss: regras.retem_inss ? String(Math.round(baseInss * aliquotaInss) / 100) : "0",
        ret_iss: regras.retem_iss ? String(Math.round(bruto * Number(regras.aliquota_iss ?? 0)) / 100) : "0",
        ret_irrf: regras.retem_irrf ? String(Math.round(bruto * 1.5) / 100) : "0",
        ret_pcc: regras.retem_csrf ? String(Math.round(bruto * 4.65) / 100) : "0",
      }));
  }, [valor, nfValor, regras, tipo, withNf]);

  const reset = () => {
    setVinculo("existente"); setObraId(""); setCodigoAvulso(""); setNumero(""); setData(getTodayDateInputValue()); setValor("");
    setStatus(tipo === "nf" ? "" : "aguardando");
    setWithNf(false); setNfNumero(""); setNfData(getTodayDateInputValue()); setNfValor(""); setRetencoes(emptyRetencoes()); setPcId("");
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
          status: (status || "aguardando"),
        }]);
        if (error) throw error;
      } else if (tipo === "pc") {
        const { data: pcRow, error } = await supabase.from("pedidos_compra").insert([{
          ...baseObra,
          numero_pedido: numero || null,
          data_recebimento: data || null,
          valor: valor ? Number(valor) : 0,
          status: (status || "aguardando"),
        }]).select("id").single();
        if (error) throw error;
        if (withNf && nfNumero.trim() && nfData) {
          const { error: nfErr } = await supabase.from("notas_fiscais").insert([{
            ...baseObra,
            pedido_compra_id: pcRow!.id,
            numero_nf: nfNumero.trim(),
            data_emissao: nfData,
            ...nfPayload({ ...retencoes, valor_bruto: nfValor || valor || "0" }),
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
          pedido_compra_id: (vinculo === "existente" && pcId) ? pcId : null,
          ...nfPayload({ ...retencoes, valor_bruto: retencoes.valor_bruto || valor }),
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
      <DialogContent className={tipo === "nf" ? "sm:max-w-2xl max-h-[90vh] overflow-y-auto" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{TITULO[tipo]}</DialogTitle>
          <DialogDescription>Vincule a uma obra cadastrada ou informe o código do chamado de uma obra antiga.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={vinculo} onValueChange={(v) => setVinculo(v as typeof vinculo)} className="grid grid-cols-2 gap-2">
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

          {tipo === "pc" && (
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          )}

          {tipo === "nf" && vinculo === "existente" && (
            <div className="space-y-1.5">
              <Label>Pedido de compra</Label>
              <Select value={pcId || "none"} onValueChange={(v) => setPcId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sem pedido vinculado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pedido vinculado</SelectItem>
                  {(pcsObra.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>PC {p.numero_pedido ?? "s/nº"} — R$ {Number(p.valor ?? 0).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Vincular ao pedido evita recebimento duplicado.</p>
            </div>
          )}

          {tipo === "nf" && (
            <RetencoesNfFields
              value={{ ...retencoes, valor_bruto: retencoes.valor_bruto || valor }}
              onChange={(next) => { setRetencoes(next); setValor(next.valor_bruto); }}
            />
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
                  <RetencoesNfFields value={{ ...retencoes, valor_bruto: retencoes.valor_bruto || nfValor || valor }} onChange={(next) => { setRetencoes(next); setNfValor(next.valor_bruto); }} />
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
