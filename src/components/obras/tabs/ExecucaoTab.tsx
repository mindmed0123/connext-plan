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
import { formatCurrency } from "@/lib/obra-helpers";

const STATUS = ["nao_iniciada", "em_execucao", "pausada", "finalizada"] as const;
const LABEL: Record<typeof STATUS[number], string> = {
  nao_iniciada: "Não iniciada", em_execucao: "Em execução", pausada: "Pausada", finalizada: "Finalizada",
};

const FORMAS = ["pix", "dinheiro", "transferencia", "boleto", "outro"] as const;
type Forma = typeof FORMAS[number];
const FORMA_LABEL: Record<Forma, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

export function ExecucaoTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    tipo_execucao: "equipe_propria" as "equipe_propria" | "terceirizado",
    nome_terceirizado: "",
    valor_terceirizado: "",
    forma_pagamento: "" as Forma | "",
    responsavel_obra: "",
    data_inicio: new Date().toISOString().slice(0, 10),
    prazo_estimado: "",
    status: "em_execucao" as typeof STATUS[number],
    observacoes: "",
  });

  const isTerceirizado = form.tipo_execucao === "terceirizado";

  const { data } = useQuery({
    queryKey: ["execucoes", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("execucoes").select("*").eq("obra_id", obraId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("execucoes").insert([{
        obra_id: obraId,
        tipo_execucao: form.tipo_execucao,
        nome_terceirizado: isTerceirizado ? form.nome_terceirizado || null : null,
        valor_terceirizado: isTerceirizado ? (parseFloat(form.valor_terceirizado) || 0) : 0,
        forma_pagamento: isTerceirizado && form.forma_pagamento ? form.forma_pagamento : null,
        responsavel_obra: form.responsavel_obra,
        data_inicio: form.data_inicio || null,
        prazo_estimado: form.prazo_estimado ? parseInt(form.prazo_estimado) : null,
        status: form.status,
        observacoes: form.observacoes || null,
      }]);
      if (error) throw error;
      await supabase.from("obra_timeline").insert([{
        obra_id: obraId, user_id: u.user?.id, evento: "Execução registrada",
        detalhes: `${LABEL[form.status]} • Resp.: ${form.responsavel_obra}${isTerceirizado && form.valor_terceirizado ? ` • Terceirizado ${formatCurrency(form.valor_terceirizado)}` : ""}`,
      }]);
    },
    onSuccess: () => {
      toast.success("Execução registrada");
      qc.invalidateQueries({ queryKey: ["execucoes", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      setForm({
        ...form,
        nome_terceirizado: "",
        valor_terceirizado: "",
        forma_pagamento: "",
        responsavel_obra: "",
        prazo_estimado: "",
        observacoes: "",
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Nova execução</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={form.tipo_execucao} onValueChange={(v: any) => setForm({ ...form, tipo_execucao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equipe_propria">Equipe própria</SelectItem>
                <SelectItem value="terceirizado">Terceirizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isTerceirizado && (
            <>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Nome do terceirizado</Label>
                <Input value={form.nome_terceirizado} onChange={(e) => setForm({ ...form, nome_terceirizado: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor do terceirizado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_terceirizado}
                  onChange={(e) => setForm({ ...form, valor_terceirizado: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de pagamento</Label>
                <Select
                  value={form.forma_pagamento || undefined}
                  onValueChange={(v: Forma) => setForm({ ...form, forma_pagamento: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {FORMAS.map((f) => <SelectItem key={f} value={f}>{FORMA_LABEL[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Responsável da obra</Label>
            <Input value={form.responsavel_obra} onChange={(e) => setForm({ ...form, responsavel_obra: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data de início</Label>
            <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prazo (dias)</Label>
            <Input type="number" value={form.prazo_estimado} onChange={(e) => setForm({ ...form, prazo_estimado: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <Button size="sm" onClick={() => mut.mutate()} disabled={!form.responsavel_obra || mut.isPending}>
          {mut.isPending ? "Salvando..." : "Registrar execução"}
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Execuções</h3>
        {(data?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Nenhuma execução</p>}
        {data?.map((x: any) => (
          <div key={x.id} className="rounded-md border bg-card p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{x.responsavel_obra} • {LABEL[x.status as typeof STATUS[number]]}</span>
              <span className="text-xs text-muted-foreground">
                {x.tipo_execucao === "terceirizado" ? `Terceirizado: ${x.nome_terceirizado ?? "—"}` : "Equipe própria"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {x.data_inicio && `Início ${format(new Date(x.data_inicio), "dd/MM/yyyy")}`}
              {x.prazo_estimado ? ` • Prazo ${x.prazo_estimado} dias` : ""}
              {x.tipo_execucao === "terceirizado" && Number(x.valor_terceirizado) > 0 && ` • ${formatCurrency(x.valor_terceirizado)}`}
              {x.tipo_execucao === "terceirizado" && x.forma_pagamento && ` • ${FORMA_LABEL[x.forma_pagamento as Forma]}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
