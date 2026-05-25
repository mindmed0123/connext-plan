import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Paperclip, Package } from "lucide-react";
import { formatCurrency } from "@/lib/obra-helpers";
import { FORMA_PAGAMENTO_LABEL, FORMA_PAGAMENTO_LIST } from "@/lib/financeiro-helpers";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";

const empty = {
  descricao: "",
  fornecedor: "",
  quantidade: "1",
  unidade: "",
  valor_unitario: "",
  valor_total: "",
  data_compra: getTodayDateInputValue(),
  forma_pagamento: "",
  numero_nf: "",
  observacoes: "",
};

export function MateriaisTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);

  const { data: materiais } = useQuery({
    queryKey: ["materiais", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_obra")
        .select("*")
        .eq("obra_id", obraId)
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalMateriais = (materiais ?? []).reduce((s, m: any) => s + Number(m.valor_total), 0);

  const log = async (evento: string, detalhes: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("obra_timeline").insert([{ obra_id: obraId, user_id: u.user?.id, evento, detalhes }]);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const qtd = parseFloat(form.quantidade) || 1;
      const vUnit = parseFloat(form.valor_unitario) || 0;
      const vTotal = form.valor_total ? parseFloat(form.valor_total) : +(qtd * vUnit).toFixed(2);

      let anexo_path: string | null = null;
      if (file) {
        const path = `${obraId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("materiais-anexos").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        anexo_path = path;
      }

      const { error } = await supabase.from("materiais_obra").insert([{
        obra_id: obraId,
        descricao: form.descricao,
        fornecedor: form.fornecedor || null,
        quantidade: qtd,
        unidade: form.unidade || null,
        valor_unitario: vUnit,
        valor_total: vTotal,
        data_compra: form.data_compra,
        forma_pagamento: (form.forma_pagamento || null) as any,
        numero_nf: form.numero_nf || null,
        observacoes: form.observacoes || null,
        anexo_path,
        created_by: u.user?.id,
      }]);
      if (error) throw error;
      await log("Material registrado", `${form.descricao} • ${formatCurrency(vTotal)}`);
    },
    onSuccess: () => {
      toast.success("Material registrado");
      qc.invalidateQueries({ queryKey: ["materiais", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      setOpen(false);
      setForm(empty);
      setFile(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (m: any) => {
      if (m.anexo_path) {
        await supabase.storage.from("materiais-anexos").remove([m.anexo_path]);
      }
      const { error } = await supabase.from("materiais_obra").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material removido");
      qc.invalidateQueries({ queryKey: ["materiais", obraId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAnexo = async (path: string) => {
    const { data, error } = await supabase.storage.from("materiais-anexos").createSignedUrl(path, 600);
    if (error || !data) return toast.error("Não foi possível abrir o anexo");
    window.open(data.signedUrl, "_blank");
  };

  const qtdNum = parseFloat(form.quantidade) || 0;
  const vUnitNum = parseFloat(form.valor_unitario) || 0;
  const totalCalculado = qtdNum * vUnitNum;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Custos de material</h3>
          <p className="text-xs text-muted-foreground">
            Total gasto:{" "}
            <span className="font-semibold text-foreground">{formatCurrency(totalMateriais)}</span>
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> Novo material
        </Button>
      </div>

      {open && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Cimento CP-II 50kg" />
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Data da compra</Label>
              <Input type="date" value={form.data_compra} onChange={(e) => setForm({ ...form, data_compra: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" step="0.01" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} placeholder="un, kg, m, sc..." />
            </div>
            <div>
              <Label className="text-xs">Valor unitário (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor total (R$)</Label>
              <Input
                type="number" step="0.01"
                value={form.valor_total}
                onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
                placeholder={totalCalculado > 0 ? totalCalculado.toFixed(2) : "Calculado automaticamente"}
              />
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {FORMA_PAGAMENTO_LIST.map((f) => <SelectItem key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nº Nota Fiscal</Label>
              <Input value={form.numero_nf} onChange={(e) => setForm({ ...form, numero_nf: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Anexo (NF / comprovante)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setForm(empty); setFile(null); }}>Cancelar</Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={!form.descricao || create.isPending}>
              {create.isPending ? "Salvando..." : "Registrar material"}
            </Button>
          </div>
        </div>
      )}

      {!materiais?.length && (
        <p className="text-xs text-muted-foreground py-6 text-center">Nenhum material registrado para esta obra.</p>
      )}

      <div className="space-y-2">
        {materiais?.map((m: any) => (
          <div key={m.id} className="rounded-md border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <h4 className="font-semibold text-sm truncate">{m.descricao}</h4>
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(m.valor_total)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateBR(m.data_compra)}
                  {m.fornecedor && ` • ${m.fornecedor}`}
                  {Number(m.quantidade) > 0 && ` • ${m.quantidade}${m.unidade ? ` ${m.unidade}` : ""}`}
                  {Number(m.valor_unitario) > 0 && ` × ${formatCurrency(m.valor_unitario)}`}
                  {m.forma_pagamento && ` • ${FORMA_PAGAMENTO_LABEL[m.forma_pagamento as keyof typeof FORMA_PAGAMENTO_LABEL]}`}
                  {m.numero_nf && ` • NF ${m.numero_nf}`}
                </p>
                {m.observacoes && <p className="text-[11px] text-muted-foreground italic mt-1">"{m.observacoes}"</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {m.anexo_path && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAnexo(m.anexo_path)} title="Ver anexo">
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("Remover este material?")) remove.mutate(m); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
