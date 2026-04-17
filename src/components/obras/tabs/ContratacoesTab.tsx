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

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const valor_total = parseFloat(form.valor_total) || 0;
      const qtd = Math.max(1, parseInt(form.quantidade_parcelas) || 1);

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

      const valorParcela = +(valor_total / qtd).toFixed(2);
      const parcelas = Array.from({ length: qtd }).map((_, i) => ({
        contratacao_id: contratacao!.id,
        numero_parcela: i + 1,
        valor: i === qtd - 1 ? +(valor_total - valorParcela * (qtd - 1)).toFixed(2) : valorParcela,
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
              <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Quantidade de parcelas</Label>
              <Input type="number" min={1} value={form.quantidade_parcelas} onChange={(e) => setForm({ ...form, quantidade_parcelas: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={!form.terceirizado_id || !form.valor_total}>
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
