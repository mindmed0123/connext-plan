import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileSignature, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";

const BUCKET = "obras-contratos";

const ADENDO_STATUS: Record<string, string> = {
  previsto: "Previsto",
  assinado: "Assinado",
  em_execucao: "Em execução",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function AdendosTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [contrato, setContrato] = useState({
    contrato_unidade: "",
    contrato_valor_unitario: "0",
    contrato_qtd_prevista: "0",
  });

  const { data: obra } = useQuery({
    queryKey: ["obra-contrato", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("obras") as any)
        .select("id, contrato_unidade, contrato_valor_unitario, contrato_qtd_prevista, contrato_qtd_contratada")
        .eq("id", obraId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (obra) {
      setContrato({
        contrato_unidade: obra.contrato_unidade ?? "",
        contrato_valor_unitario: String(obra.contrato_valor_unitario ?? 0),
        contrato_qtd_prevista: String(obra.contrato_qtd_prevista ?? 0),
      });
    }
  }, [obra]);

  const { data: adendos = [] } = useQuery({
    queryKey: ["obra-adendos", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("obra_adendos" as any) as any)
        .select("*").eq("obra_id", obraId).order("numero");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    quantidade: "1",
    valor_unitario: "",
    data_assinatura: getTodayDateInputValue(),
    data_inicio: "",
    status: "assinado",
    observacoes: "",
  });

  const salvarContrato = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("obras") as any).update({
        contrato_unidade: contrato.contrato_unidade || null,
        contrato_valor_unitario: Number(contrato.contrato_valor_unitario || 0),
        contrato_qtd_prevista: Number(contrato.contrato_qtd_prevista || 0),
      }).eq("id", obraId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato atualizado");
      qc.invalidateQueries({ queryKey: ["obra-contrato", obraId] });
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const salvarAdendo = useMutation({
    mutationFn: async () => {
      let arquivo_path: string | null = null;
      let arquivo_nome: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${empresaId}/${obraId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        arquivo_path = path;
        arquivo_nome = file.name;
      }
      const qtd = Number(form.quantidade || 0);
      const vu = Number(form.valor_unitario || obra?.contrato_valor_unitario || 0);
      const proximo = (adendos.reduce((m: number, a: any) => Math.max(m, a.numero ?? 0), 0) || 0) + 1;
      const { error } = await (supabase.from("obra_adendos" as any) as any).insert([{
        obra_id: obraId,
        numero: proximo,
        titulo: form.titulo.trim() || `Adendo ${proximo}`,
        descricao: form.descricao || null,
        quantidade: qtd,
        valor_unitario: vu,
        valor_total: qtd * vu,
        data_assinatura: form.data_assinatura || null,
        data_inicio: form.data_inicio || null,
        status: form.status,
        observacoes: form.observacoes || null,
        arquivo_path,
        arquivo_nome,
      }]);
      if (error) throw error;

      const { data: u } = await supabase.auth.getUser();
      await supabase.from("obra_timeline").insert([{
        obra_id: obraId,
        user_id: u.user?.id,
        evento: `Adendo ${proximo} registrado`,
        detalhes: `${qtd} × ${formatCurrency(vu)} = ${formatCurrency(qtd * vu)}`,
      }] as any);
    },
    onSuccess: () => {
      toast.success("Adendo registrado");
      setOpen(false);
      setFile(null);
      setForm({ ...form, titulo: "", descricao: "", quantidade: "1", valor_unitario: "", observacoes: "" });
      qc.invalidateQueries({ queryKey: ["obra-adendos", obraId] });
      qc.invalidateQueries({ queryKey: ["obra-contrato", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (a: any) => {
      if (a.arquivo_path) await supabase.storage.from(BUCKET).remove([a.arquivo_path]);
      const { error } = await (supabase.from("obra_adendos" as any) as any).delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra-adendos", obraId] });
      qc.invalidateQueries({ queryKey: ["obra-contrato", obraId] });
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baixar = async (a: any) => {
    if (!a.arquivo_path) return toast.error("Sem arquivo anexado");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.arquivo_path, 120);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank");
  };

  const unidade = contrato.contrato_unidade || "unidade";
  const vu = Number(contrato.contrato_valor_unitario || 0);
  const prev = Number(contrato.contrato_qtd_prevista || 0);
  const contratada = adendos
    .filter((a: any) => ["assinado", "em_execucao", "concluido"].includes(a.status))
    .reduce((s: number, a: any) => s + Number(a.quantidade || 0), 0);
  const valorContratado = adendos
    .filter((a: any) => ["assinado", "em_execucao", "concluido"].includes(a.status))
    .reduce((s: number, a: any) => s + Number(a.valor_total || 0), 0);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileSignature className="h-4 w-4" /> Contrato por unidade
        </h3>
        <p className="text-xs text-muted-foreground">
          Ex.: R$ 120.000 por torre, com 10 torres previstas. Cada torre fechada vira um adendo.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Unidade</Label>
            <Input placeholder="Torre, bloco, poço..." value={contrato.contrato_unidade}
              onChange={(e) => setContrato({ ...contrato, contrato_unidade: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor por unidade (R$)</Label>
            <Input type="number" step="0.01" value={contrato.contrato_valor_unitario}
              onChange={(e) => setContrato({ ...contrato, contrato_valor_unitario: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Qtd. total prevista</Label>
            <Input type="number" step="1" value={contrato.contrato_qtd_prevista}
              onChange={(e) => setContrato({ ...contrato, contrato_qtd_prevista: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 rounded-md bg-muted/40 p-3 text-xs">
          <span>Contratado: <b>{contratada}</b> de {prev} {unidade}(s)</span>
          <span>Valor fechado: <b>{formatCurrency(valorContratado)}</b></span>
          <span>Potencial total: <b>{formatCurrency(prev * vu)}</b></span>
          <span>A contratar: <b>{formatCurrency(Math.max(prev - contratada, 0) * vu)}</b></span>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => salvarContrato.mutate()} disabled={salvarContrato.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salvar contrato
          </Button>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Adendos ({adendos.length})</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo adendo</Button>
      </div>

      {adendos.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum adendo registrado. Adicione um a cada nova {unidade} fechada.
        </div>
      )}

      <div className="space-y-2">
        {adendos.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Adendo {a.numero} — {a.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {Number(a.quantidade)} × {formatCurrency(a.valor_unitario)} = <b>{formatCurrency(a.valor_total)}</b>
                {a.data_assinatura ? ` • assinado ${formatDateBR(a.data_assinatura)}` : ""}
                {a.data_inicio ? ` • início ${formatDateBR(a.data_inicio)}` : ""}
              </p>
              {a.descricao && <p className="text-xs text-muted-foreground">{a.descricao}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant={a.status === "cancelado" ? "secondary" : "default"}>{ADENDO_STATUS[a.status] ?? a.status}</Badge>
              {a.arquivo_path && <Button variant="ghost" size="icon" onClick={() => baixar(a)}><Download className="h-4 w-4" /></Button>}
              <Button variant="ghost" size="icon" onClick={() => confirm("Excluir adendo?") && del.mutate(a)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo adendo de contrato</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Título *</Label>
              <Input placeholder={`Ex: Torre 2`} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantidade ({unidade})</Label>
              <Input type="number" step="0.01" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor unitário (R$)</Label>
              <Input type="number" step="0.01" placeholder={String(vu)} value={form.valor_unitario}
                onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data de assinatura</Label>
              <Input type="date" value={form.data_assinatura} onChange={(e) => setForm({ ...form, data_assinatura: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Início previsto</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ADENDO_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Arquivo</Label>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> <span className="truncate">{file ? file.name : "Anexar"}</span>
              </Button>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvarAdendo.mutate()} disabled={salvarAdendo.isPending}>
              {salvarAdendo.isPending ? "Salvando..." : "Registrar adendo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
