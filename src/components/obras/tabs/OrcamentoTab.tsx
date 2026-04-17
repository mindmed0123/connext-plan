import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/obra-helpers";

const STATUS = ["em_elaboracao", "enviado", "em_negociacao", "aprovado", "reprovado"] as const;
const LABEL: Record<typeof STATUS[number], string> = {
  em_elaboracao: "Em elaboração", enviado: "Enviado", em_negociacao: "Em negociação", aprovado: "Aprovado", reprovado: "Reprovado",
};

export function OrcamentoTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    numero_orcamento: "",
    valor_orcamento: "",
    data_envio: new Date().toISOString().slice(0, 10),
    engenheiro_aprovador: "",
    status: "enviado" as typeof STATUS[number],
  });

  const { data } = useQuery({
    queryKey: ["orcamentos", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orcamentos").select("*").eq("obra_id", obraId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("orcamentos").insert([{
        obra_id: obraId,
        numero_orcamento: form.numero_orcamento || null,
        valor_orcamento: parseFloat(form.valor_orcamento) || 0,
        data_envio: form.data_envio || null,
        engenheiro_aprovador: form.engenheiro_aprovador || null,
        status: form.status,
      }]);
      if (error) throw error;
      await supabase.from("obra_timeline").insert([{
        obra_id: obraId, user_id: u.user?.id, evento: "Orçamento registrado",
        detalhes: `${LABEL[form.status]} • ${formatCurrency(form.valor_orcamento)}`,
      }]);
    },
    onSuccess: () => {
      toast.success("Orçamento registrado");
      qc.invalidateQueries({ queryKey: ["orcamentos", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setForm({ ...form, numero_orcamento: "", valor_orcamento: "", engenheiro_aprovador: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Novo orçamento</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nº orçamento (Omie)</Label>
            <Input value={form.numero_orcamento} onChange={(e) => setForm({ ...form, numero_orcamento: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_orcamento} onChange={(e) => setForm({ ...form, valor_orcamento: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data de envio</Label>
            <Input type="date" value={form.data_envio} onChange={(e) => setForm({ ...form, data_envio: e.target.value })} />
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
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Engenheiro aprovador</Label>
            <Input value={form.engenheiro_aprovador} onChange={(e) => setForm({ ...form, engenheiro_aprovador: e.target.value })} />
          </div>
        </div>
        <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Salvando..." : "Registrar orçamento"}
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Orçamentos</h3>
        {(data?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Nenhum orçamento</p>}
        {data?.map((o) => (
          <div key={o.id} className="rounded-md border bg-card p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{o.numero_orcamento || "Sem nº"} • {formatCurrency(o.valor_orcamento)}</span>
              <span className="text-xs text-muted-foreground">{LABEL[o.status as typeof STATUS[number]]}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {o.data_envio && `Enviado ${format(new Date(o.data_envio), "dd/MM/yyyy")}`}
              {o.engenheiro_aprovador && ` • Aprovador: ${o.engenheiro_aprovador}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
