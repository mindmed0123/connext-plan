import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/obra-helpers";
import {
  CONTRATACAO_STATUS_COLOR,
  CONTRATACAO_STATUS_LABEL,
  FORMA_PAGAMENTO_LABEL,
  FORMA_PAGAMENTO_LIST,
} from "@/lib/financeiro-helpers";
import { ContratacaoCard } from "@/components/financeiro/ContratacaoCard";

type ParcelaInput = { valor: string; data_prevista: string };

export function ContratacoesTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    terceirizado_id: "",
    valor_total: "",
    quantidade_parcelas: "1",
    forma_pagamento_prevista: "" as string,
    observacoes: "",
  });
  const [parcelasInput, setParcelasInput] = useState<ParcelaInput[]>([{ valor: "", data_prevista: "" }]);

  const { data: terceirizados } = useQuery({
    queryKey: ["pessoas-terceirizados-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pessoas")
        .select("id, nome")
        .eq("tipo", "terceirizado")
        .eq("status", "ativo")
        .order("nome");
      return data ?? [];
    },
  });

  const { data: contratacoes } = useQuery({
    queryKey: ["contratacoes", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratacoes_terceirizado")
        .select("*, pessoas:terceirizado_id(id, nome), parcelas_pagamento(*)")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const log = async (evento: string, detalhes: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("obra_timeline").insert([{ obra_id: obraId, user_id: u.user?.id, evento, detalhes }]);
  };

  const aplicarDivisaoAutomatica = (qtd: number, total: number) => {
    if (qtd < 1) return;
    const valor = +(total / qtd).toFixed(2);
    const novas: ParcelaInput[] = Array.from({ length: qtd }).map((_, i) => ({
      valor: i === qtd - 1 ? (total - valor * (qtd - 1)).toFixed(2) : valor.toFixed(2),
      data_prevista: parcelasInput[i]?.data_prevista ?? "",
    }));
    setParcelasInput(novas);
  };

  const handleQtdChange = (v: string) => {
    const qtd = Math.max(1, parseInt(v) || 1);
    setForm((f) => ({ ...f, quantidade_parcelas: String(qtd) }));
    const total = parseFloat(form.valor_total) || 0;
    if (total > 0) aplicarDivisaoAutomatica(qtd, total);
    else setParcelasInput(Array.from({ length: qtd }).map((_, i) => parcelasInput[i] ?? { valor: "", data_prevista: "" }));
  };

  const handleTotalChange = (v: string) => {
    setForm((f) => ({ ...f, valor_total: v }));
    const total = parseFloat(v) || 0;
    const qtd = Math.max(1, parseInt(form.quantidade_parcelas) || 1);
    if (total > 0) aplicarDivisaoAutomatica(qtd, total);
  };

  const updateParcela = (i: number, patch: Partial<ParcelaInput>) => {
    setParcelasInput((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const somaParcelas = parcelasInput.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
  const totalContratado = parseFloat(form.valor_total) || 0;
  const diferenca = +(totalContratado - somaParcelas).toFixed(2);

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const valor_total = totalContratado;
      const qtd = parcelasInput.length;
      if (Math.abs(diferenca) > 0.01) {
        throw new Error(`Soma das parcelas (${formatCurrency(somaParcelas)}) precisa ser igual ao valor total (${formatCurrency(valor_total)})`);
      }

      const { data: contratacao, error } = await supabase
        .from("contratacoes_terceirizado")
        .insert([{
          obra_id: obraId,
          terceirizado_id: form.terceirizado_id,
          valor_total,
          quantidade_parcelas: qtd,
          forma_pagamento_prevista: (form.forma_pagamento_prevista || null) as any,
          observacoes: form.observacoes || null,
          created_by: u.user?.id,
        }])
        .select("id")
        .single();
      if (error) throw error;

      const parcelas = parcelasInput.map((p, i) => ({
        contratacao_id: contratacao!.id,
        numero_parcela: i + 1,
        valor: parseFloat(p.valor) || 0,
        data_prevista: p.data_prevista || null,
        forma_pagamento: (form.forma_pagamento_prevista || null) as any,
      }));
      const { error: pErr } = await supabase.from("parcelas_pagamento").insert(parcelas);
      if (pErr) throw pErr;

      const nome = terceirizados?.find((t) => t.id === form.terceirizado_id)?.nome ?? "Terceirizado";
      await log("Contratação criada", `${nome} • ${formatCurrency(valor_total)} em ${qtd}x`);
    },
    onSuccess: () => {
      toast.success("Contratação criada");
      qc.invalidateQueries({ queryKey: ["contratacoes", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      qc.invalidateQueries({ queryKey: ["financeiro-stats"] });
      qc.invalidateQueries({ queryKey: ["financeiro-contratacoes"] });
      setOpen(false);
      setForm({ terceirizado_id: "", valor_total: "", quantidade_parcelas: "1", forma_pagamento_prevista: "", observacoes: "" });
      setParcelasInput([{ valor: "", data_prevista: "" }]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratacoes_terceirizado").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contratação removida");
      qc.invalidateQueries({ queryKey: ["contratacoes", obraId] });
      qc.invalidateQueries({ queryKey: ["financeiro-stats"] });
      qc.invalidateQueries({ queryKey: ["financeiro-contratacoes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Contratações de terceirizados</h3>
          <p className="text-xs text-muted-foreground">Defina valor, parcelas e registre pagamentos</p>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> Nova contratação
        </Button>
      </div>

      {open && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Terceirizado</Label>
              <Select value={form.terceirizado_id} onValueChange={(v) => setForm({ ...form, terceirizado_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {terceirizados?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento prevista</Label>
              <Select value={form.forma_pagamento_prevista} onValueChange={(v) => setForm({ ...form, forma_pagamento_prevista: v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {FORMA_PAGAMENTO_LIST.map((f) => <SelectItem key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor total contratado</Label>
              <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => handleTotalChange(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Quantidade de parcelas</Label>
              <Input type="number" min={1} value={form.quantidade_parcelas} onChange={(e) => handleQtdChange(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Parcelas (você pode editar valores e datas individualmente)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => aplicarDivisaoAutomatica(parcelasInput.length, totalContratado)}
                disabled={!totalContratado}
              >
                Dividir igualmente
              </Button>
            </div>

            <div className="space-y-1.5">
              {parcelasInput.map((p, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_1fr] gap-2 items-end">
                  <div className="text-xs text-muted-foreground pb-2 text-center">#{i + 1}</div>
                  <div>
                    <Label className="text-[10px]">Valor</Label>
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={p.valor}
                      onChange={(e) => updateParcela(i, { valor: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Vencimento (opcional)</Label>
                    <Input
                      className="h-8 text-xs"
                      type="date"
                      value={p.data_prevista}
                      onChange={(e) => updateParcela(i, { data_prevista: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
              <span>
                Soma das parcelas: <span className="font-semibold">{formatCurrency(somaParcelas)}</span>
                {" "}/ Total: <span className="font-semibold">{formatCurrency(totalContratado)}</span>
              </span>
              {Math.abs(diferenca) > 0.01 ? (
                <span className="text-destructive font-semibold">
                  {diferenca > 0 ? `Faltam ${formatCurrency(diferenca)}` : `Excesso de ${formatCurrency(-diferenca)}`}
                </span>
              ) : totalContratado > 0 ? (
                <span className="text-emerald-600 font-semibold">✓ Confere</span>
              ) : null}
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={() => create.mutate()}
              disabled={!form.terceirizado_id || !form.valor_total || Math.abs(diferenca) > 0.01 || create.isPending}
            >
              Criar contratação
            </Button>
          </div>
        </div>
      )}

      {!contratacoes?.length && (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Nenhuma contratação registrada para esta obra ainda.
        </p>
      )}

      {contratacoes?.map((c: any) => (
        <ContratacaoCard
          key={c.id}
          contratacao={c}
          onDelete={() => {
            if (confirm("Remover contratação e todas as parcelas?")) remove.mutate(c.id);
          }}
        />
      ))}
    </div>
  );
}
