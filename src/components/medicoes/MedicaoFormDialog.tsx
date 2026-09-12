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
import { formatCurrency } from "@/lib/obra-helpers";

export const BUCKET_MEDICOES = "medicoes-anexos";

export const MEDICAO_STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

export function MedicaoFormDialog({
  open, onOpenChange, obraId, medicao,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId?: string;
  medicao?: any | null;
}) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    contrato_id: "",
    referencia: "",
    data_medicao: getTodayDateInputValue(),
    valor_medido: "",
    status: "rascunho",
    observacoes: "",
  });

  const contratos = useQuery({
    queryKey: [empresaId, "contratos-select", obraId ?? "todos"],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("contratos_clientes")
        .select("id, numero_contrato, objeto, valor_global, obra_id, obras(codigo_chamado)")
        .order("created_at", { ascending: false });
      if (obraId) q = q.eq("obra_id", obraId);
      return (await q).data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (medicao) {
      setForm({
        contrato_id: medicao.contrato_id ?? "",
        referencia: medicao.referencia ?? "",
        data_medicao: medicao.data_medicao ?? getTodayDateInputValue(),
        valor_medido: String(medicao.valor_medido ?? ""),
        status: medicao.status ?? "rascunho",
        observacoes: medicao.observacoes ?? "",
      });
    } else {
      setForm({
        contrato_id: "", referencia: "", data_medicao: getTodayDateInputValue(),
        valor_medido: "", status: "rascunho", observacoes: "",
      });
    }
    setFile(null);
  }, [open, medicao]);

  useEffect(() => {
    const lista = contratos.data ?? [];
    if (open && !medicao && !form.contrato_id && lista.length === 1) {
      setForm((f) => ({ ...f, contrato_id: lista[0].id }));
    }
  }, [contratos.data, open]);

  const contratoSel: any = (contratos.data ?? []).find((c: any) => c.id === form.contrato_id);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.contrato_id) throw new Error("Selecione o contrato da medição");
      if (!form.data_medicao) throw new Error("Informe a data da medição");
      let arquivo_path = medicao?.arquivo_path ?? null;
      let arquivo_nome = medicao?.arquivo_nome ?? null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${empresaId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET_MEDICOES).upload(path, file);
        if (upErr) throw upErr;
        arquivo_path = path;
        arquivo_nome = file.name;
      }
      const obraDoContrato = contratoSel?.obra_id ?? obraId ?? null;
      const payload: any = {
        contrato_id: form.contrato_id,
        obra_id: obraDoContrato,
        referencia: form.referencia || null,
        data_medicao: form.data_medicao,
        valor_medido: Number(form.valor_medido || 0),
        status: form.status,
        observacoes: form.observacoes || null,
        arquivo_path,
        arquivo_nome,
      };
      if (medicao?.id) {
        const { error } = await supabase.from("medicoes").update(payload).eq("id", medicao.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("medicoes").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(medicao?.id ? "Medição atualizada" : "Medição criada");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar medição"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{medicao?.id ? `Medição nº ${medicao.numero_medicao}` : "Nova medição"}</DialogTitle>
          <DialogDescription>A numeração é automática e sequencial por contrato.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Contrato</Label>
            <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
              <SelectContent>
                {(contratos.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.numero_contrato ?? "s/nº"}{c.obras?.codigo_chamado ? ` — ${c.obras.codigo_chamado}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contratoSel && (
              <p className="text-[11px] text-muted-foreground">
                Valor global do contrato: {formatCurrency(Number(contratoSel.valor_global ?? 0))}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Referência</Label>
              <Input placeholder="Ex: Setembro/2026" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data da medição</Label>
              <Input type="date" value={form.data_medicao} onChange={(e) => setForm({ ...form, data_medicao: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor medido (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_medido} onChange={(e) => setForm({ ...form, valor_medido: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MEDICAO_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Boletim de medição (PDF ou planilha)</Label>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.xls,.xlsx,.csv,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" /> Escolher arquivo
              </Button>
              <span className="text-xs text-muted-foreground">
                {file ? file.name : medicao?.arquivo_nome ?? "Nenhum arquivo"}
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
