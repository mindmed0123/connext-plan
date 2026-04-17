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

export function VistoriaTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    data_vistoria: new Date().toISOString().slice(0, 10),
    responsavel_vistoria: "",
    observacoes: "",
    status: "vistoriado" as "pendente" | "vistoriado",
  });

  const { data: vistorias } = useQuery({
    queryKey: ["vistorias", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vistorias").select("*").eq("obra_id", obraId).order("data_vistoria", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("vistorias").insert([{ obra_id: obraId, ...form }]);
      if (error) throw error;
      await supabase.from("obra_timeline").insert([{
        obra_id: obraId, user_id: u.user?.id, evento: "Vistoria registrada",
        detalhes: `Por ${form.responsavel_vistoria} em ${format(new Date(form.data_vistoria), "dd/MM/yyyy")}`,
      }]);
    },
    onSuccess: () => {
      toast.success("Vistoria registrada");
      qc.invalidateQueries({ queryKey: ["vistorias", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      setForm({ ...form, responsavel_vistoria: "", observacoes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Nova vistoria</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={form.data_vistoria} onChange={(e) => setForm({ ...form, data_vistoria: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="vistoriado">Vistoriado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Responsável</Label>
            <Input value={form.responsavel_vistoria} onChange={(e) => setForm({ ...form, responsavel_vistoria: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <Button size="sm" onClick={() => mut.mutate()} disabled={!form.responsavel_vistoria || mut.isPending}>
          {mut.isPending ? "Salvando..." : "Registrar vistoria"}
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Histórico de vistorias</h3>
        {(vistorias?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Nenhuma vistoria registrada</p>}
        {vistorias?.map((v) => (
          <div key={v.id} className="rounded-md border bg-card p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{v.responsavel_vistoria}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(v.data_vistoria), "dd/MM/yyyy")} • {v.status}</span>
            </div>
            {v.observacoes && <p className="mt-1 text-xs text-muted-foreground">{v.observacoes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
