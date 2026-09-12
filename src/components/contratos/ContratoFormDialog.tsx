import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { getTodayDateInputValue } from "@/lib/date";

export const BUCKET_CONTRATOS = "contratos-clientes";

export const CONTRATO_STATUS: Record<string, string> = {
  em_negociacao: "Em negociação",
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export type ContratoPrefill = {
  obra_id?: string | null;
  cliente_id?: string | null;
  objeto?: string | null;
  valor_global?: number | null;
  numero_contrato?: string | null;
};

const vazio = (p?: ContratoPrefill) => ({
  obra_id: p?.obra_id ?? "",
  cliente_id: p?.cliente_id ?? "",
  numero_contrato: p?.numero_contrato ?? "",
  objeto: p?.objeto ?? "",
  valor_global: String(p?.valor_global ?? ""),
  data_inicio: getTodayDateInputValue(),
  data_fim: "",
  status: "ativo",
  condicoes_pgto: "",
  prazo_pagamento_dias: "",
  retencao_contratual_pct: "0",
  retencao_devolucao_prevista: "",
  observacoes: "",
  documento_url: "",
});

export function ContratoFormDialog({
  open, onOpenChange, contrato, prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contrato?: any | null;
  prefill?: ContratoPrefill;
}) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState(vazio(prefill));

  useEffect(() => {
    if (!open) return;
    if (contrato) {
      setForm({
        obra_id: contrato.obra_id ?? "",
        cliente_id: contrato.cliente_id ?? "",
        numero_contrato: contrato.numero_contrato ?? "",
        objeto: contrato.objeto ?? "",
        valor_global: String(contrato.valor_global ?? ""),
        data_inicio: contrato.data_inicio ?? "",
        data_fim: contrato.data_fim ?? "",
        status: contrato.status ?? "ativo",
        condicoes_pgto: contrato.condicoes_pgto ?? "",
        prazo_pagamento_dias: contrato.prazo_pagamento_dias == null ? "" : String(contrato.prazo_pagamento_dias),
        retencao_contratual_pct: String(contrato.retencao_contratual_pct ?? 0),
        retencao_devolucao_prevista: contrato.retencao_devolucao_prevista ?? "",
        observacoes: contrato.observacoes ?? "",
        documento_url: contrato.documento_url ?? "",
      });
    } else {
      setForm(vazio(prefill));
    }
    setFile(null);
  }, [open, contrato, prefill?.obra_id, prefill?.cliente_id]);

  const obras = useQuery({
    queryKey: [empresaId, "obras-select-contrato"],
    enabled: open,
    queryFn: async () =>
      (await supabase.from("obras").select("id, codigo_chamado, descricao_servico").eq("arquivada", false).order("codigo_chamado")).data ?? [],
  });

  const clientes = useQuery({
    queryKey: [empresaId, "clientes-select-contrato"],
    enabled: open,
    queryFn: async () => (await supabase.from("clientes").select("id, nome, prazo_pagamento_dias").order("nome")).data ?? [],
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.objeto.trim()) throw new Error("Descreva o objeto do contrato");
      let documento_url = form.documento_url || null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${empresaId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET_CONTRATOS).upload(path, file);
        if (upErr) throw upErr;
        documento_url = path;
      }
      const payload = {
        obra_id: form.obra_id || null,
        cliente_id: form.cliente_id || null,
        numero_contrato: form.numero_contrato.trim() || null,
        objeto: form.objeto.trim(),
        valor_global: Number(form.valor_global || 0),
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        status: form.status as any,
        condicoes_pgto: form.condicoes_pgto || null,
        prazo_pagamento_dias: form.prazo_pagamento_dias ? Number(form.prazo_pagamento_dias) : null,
        retencao_contratual_pct: Number(form.retencao_contratual_pct || 0),
        retencao_devolucao_prevista: form.retencao_devolucao_prevista || null,
        observacoes: form.observacoes || null,
        documento_url,
      };
      if (contrato?.id) {
        const { error } = await supabase.from("contratos_clientes").update(payload).eq("id", contrato.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contratos_clientes").insert([payload as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(contrato?.id ? "Contrato atualizado" : "Contrato criado");
      qc.invalidateQueries({ queryKey: [empresaId, "contratos"] });
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar contrato"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contrato?.id ? "Editar contrato" : "Novo contrato de cliente"}</DialogTitle>
          <DialogDescription>Contrato que dá origem às medições e às notas fiscais da obra.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Obra</Label>
              <Select value={form.obra_id || "none"} onValueChange={(v) => setForm({ ...form, obra_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem obra" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem obra</SelectItem>
                  {(obras.data ?? []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.codigo_chamado}{o.descricao_servico ? ` — ${o.descricao_servico}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                value={form.cliente_id || "none"}
                onValueChange={(v) => {
                  const cli = (clientes.data ?? []).find((c: any) => c.id === v);
                  setForm({
                    ...form,
                    cliente_id: v === "none" ? "" : v,
                    prazo_pagamento_dias: form.prazo_pagamento_dias || (cli?.prazo_pagamento_dias ? String(cli.prazo_pagamento_dias) : ""),
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {(clientes.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nº do contrato</Label>
              <Input value={form.numero_contrato} onChange={(e) => setForm({ ...form, numero_contrato: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor global (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_global} onChange={(e) => setForm({ ...form, valor_global: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRATO_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Objeto</Label>
            <Textarea rows={2} value={form.objeto} onChange={(e) => setForm({ ...form, objeto: e.target.value })} />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo pgto (dias)</Label>
              <Input type="number" value={form.prazo_pagamento_dias} onChange={(e) => setForm({ ...form, prazo_pagamento_dias: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Retenção contratual (%)</Label>
              <Input type="number" step="0.01" value={form.retencao_contratual_pct} onChange={(e) => setForm({ ...form, retencao_contratual_pct: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Devolução da caução prevista</Label>
              <Input type="date" value={form.retencao_devolucao_prevista} onChange={(e) => setForm({ ...form, retencao_devolucao_prevista: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Condições de pagamento</Label>
              <Input value={form.condicoes_pgto} onChange={(e) => setForm({ ...form, condicoes_pgto: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Contrato assinado (PDF)</Label>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" /> Escolher arquivo
              </Button>
              <span className="text-xs text-muted-foreground">
                {file ? file.name : form.documento_url ? "Arquivo já anexado" : "Nenhum arquivo"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
