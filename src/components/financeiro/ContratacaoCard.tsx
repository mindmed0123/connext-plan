import { useState } from "react";
import { format } from "date-fns";
import { Trash2, Paperclip, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import {
  CONTRATACAO_STATUS_COLOR,
  CONTRATACAO_STATUS_LABEL,
  FORMA_PAGAMENTO_LABEL,
  FORMA_PAGAMENTO_LIST,
} from "@/lib/financeiro-helpers";
import { cn } from "@/lib/utils";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";

export function ContratacaoCard({ contratacao, onDelete }: { contratacao: any; onDelete?: () => void }) {
  const qc = useQueryClient();
  const parcelas = (contratacao.parcelas_pagamento ?? []).sort((a: any, b: any) => a.numero_parcela - b.numero_parcela);
  const totalPago = parcelas.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const saldo = Number(contratacao.valor_total) - totalPago;
  const pct = contratacao.valor_total > 0 ? Math.min(100, (totalPago / Number(contratacao.valor_total)) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm">{contratacao.pessoas?.nome ?? "Terceirizado"}</h4>
            <Badge variant="outline" className={cn("text-[10px]", CONTRATACAO_STATUS_COLOR[contratacao.status_financeiro as keyof typeof CONTRATACAO_STATUS_COLOR])}>
              {CONTRATACAO_STATUS_LABEL[contratacao.status_financeiro as keyof typeof CONTRATACAO_STATUS_LABEL]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {contratacao.quantidade_parcelas}x • {contratacao.forma_pagamento_prevista ? FORMA_PAGAMENTO_LABEL[contratacao.forma_pagamento_prevista as keyof typeof FORMA_PAGAMENTO_LABEL] : "—"}
          </p>
        </div>
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          <p className="text-sm font-semibold">{formatCurrency(contratacao.valor_total)}</p>
        </div>
        <div className="rounded-md bg-emerald-500/10 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Pago</p>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalPago)}</p>
        </div>
        <div className="rounded-md bg-amber-500/10 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(saldo)}</p>
        </div>
      </div>

      <Progress value={pct} className="h-1.5" />

      {contratacao.observacoes && <p className="text-xs text-muted-foreground italic">{contratacao.observacoes}</p>}

      <div className="space-y-1.5">
        {parcelas.map((p: any) => (
          <ParcelaRow key={p.id} parcela={p} contratacaoId={contratacao.id} obraId={contratacao.obra_id} />
        ))}
      </div>
    </div>
  );
}

function ParcelaRow({ parcela, contratacaoId, obraId }: { parcela: any; contratacaoId: string; obraId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    valor: String(parcela.valor),
    data_prevista: parcela.data_prevista ?? "",
    data_pagamento: parcela.data_pagamento ?? getTodayDateInputValue(),
    forma_pagamento: parcela.forma_pagamento ?? "",
    observacao: parcela.observacao ?? "",
  });
  const [file, setFile] = useState<File | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contratacoes", obraId] });
    qc.invalidateQueries({ queryKey: ["financeiro-stats"] });
    qc.invalidateQueries({ queryKey: ["financeiro-contratacoes"] });
    qc.invalidateQueries({ queryKey: ["timeline", obraId] });
  };

  const log = async (evento: string, detalhes: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("obra_timeline").insert([{ obra_id: obraId, user_id: u.user?.id, evento, detalhes }]);
  };

  const pay = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      let comprovante_url = parcela.comprovante_url;
      let comprovante_path = parcela.comprovante_path;

      if (file) {
        const path = `${contratacaoId}/${parcela.id}-${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("comprovantes-pagamento").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        comprovante_path = path;
        comprovante_url = path; // privado, usaremos signed URL ao abrir
      }

      const { error } = await supabase.from("parcelas_pagamento").update({
        status: "pago",
        valor: parseFloat(form.valor) || 0,
        data_pagamento: form.data_pagamento || getTodayDateInputValue(),
        forma_pagamento: (form.forma_pagamento || null) as any,
        observacao: form.observacao || null,
        comprovante_url,
        comprovante_path,
        paid_by: u.user?.id,
      }).eq("id", parcela.id);
      if (error) throw error;

      await log("Parcela paga", `Parcela ${parcela.numero_parcela} • ${formatCurrency(form.valor)}`);
    },
    onSuccess: () => {
      toast.success(`Parcela ${parcela.numero_parcela} paga`);
      setEditing(false); setFile(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("parcelas_pagamento").update({
        valor: parseFloat(form.valor) || 0,
        data_prevista: form.data_prevista || null,
        observacao: form.observacao || null,
      }).eq("id", parcela.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela atualizada");
      setEditing(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const undoPay = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("parcelas_pagamento").update({
        status: "pendente", data_pagamento: null, paid_by: null,
      }).eq("id", parcela.id);
      if (error) throw error;
      await log("Pagamento estornado", `Parcela ${parcela.numero_parcela}`);
    },
    onSuccess: () => { toast.success("Pagamento estornado"); invalidate(); },
  });

  const openComprovante = async () => {
    if (!parcela.comprovante_path) return;
    const { data, error } = await supabase.storage
      .from("comprovantes-pagamento")
      .createSignedUrl(parcela.comprovante_path, 60 * 10);
    if (error || !data) return toast.error("Não foi possível abrir o comprovante");
    window.open(data.signedUrl, "_blank");
  };

  const isPago = parcela.status === "pago";

  return (
    <div className={cn("rounded-md border p-2.5 text-xs", isPago ? "bg-emerald-500/5 border-emerald-500/20" : "bg-background")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold flex-shrink-0">
            {parcela.numero_parcela}
          </span>
          <span className="font-semibold">{formatCurrency(parcela.valor)}</span>
          {parcela.data_prevista && !isPago && (
            <span className="text-muted-foreground">· prev. {formatDateBR(parcela.data_prevista)}</span>
          )}
          {isPago && parcela.data_pagamento && (
            <span className="text-emerald-700 dark:text-emerald-300">· pago em {formatDateBR(parcela.data_pagamento)}</span>
          )}
          {parcela.forma_pagamento && isPago && (
            <Badge variant="outline" className="text-[9px] h-4">{FORMA_PAGAMENTO_LABEL[parcela.forma_pagamento as keyof typeof FORMA_PAGAMENTO_LABEL]}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {parcela.comprovante_path && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openComprovante} title="Ver comprovante">
              <Paperclip className="h-3 w-3" />
            </Button>
          )}
          {isPago ? (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => undoPay.mutate()}>
              Estornar
            </Button>
          ) : (
            <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => setEditing((v) => !v)}>
              {editing ? "Fechar" : "Pagar"}
            </Button>
          )}
        </div>
      </div>

      {editing && !isPago && (
        <div className="mt-2 grid grid-cols-2 gap-2 pt-2 border-t">
          <div>
            <Label className="text-[10px]">Valor pago</Label>
            <Input className="h-7 text-xs" type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px]">Data do pagamento</Label>
            <Input className="h-7 text-xs" type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px]">Forma</Label>
            <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {FORMA_PAGAMENTO_LIST.map((f) => <SelectItem key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Comprovante</Label>
            <Input className="h-7 text-xs" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px]">Observação</Label>
            <Input className="h-7 text-xs" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-7" onClick={() => update.mutate()}>Salvar sem pagar</Button>
            <Button size="sm" className="h-7" onClick={() => pay.mutate()}>
              <Check className="mr-1 h-3 w-3" /> Confirmar pagamento
            </Button>
          </div>
        </div>
      )}

      {parcela.observacao && !editing && (
        <p className="text-[11px] text-muted-foreground mt-1 italic truncate">"{parcela.observacao}"</p>
      )}
    </div>
  );
}
