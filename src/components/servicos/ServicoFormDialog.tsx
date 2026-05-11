import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const UNIDADES = ["m²", "m³", "m", "un", "h", "kg", "t", "l", "vb", "cx"] as const;

export type ServicoEdit = {
  id?: string;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  unidade: string;
  preco_unitario: number;
};

export function ServicoFormDialog({
  open,
  onOpenChange,
  servico,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  servico?: ServicoEdit | null;
}) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<ServicoEdit>({
    nome: "", codigo: "", descricao: "", unidade: "m²", preco_unitario: 0,
  });

  useEffect(() => {
    if (open) {
      setForm(servico ?? { nome: "", codigo: "", descricao: "", unidade: "m²", preco_unitario: 0 });
    }
  }, [open, servico]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não identificada");
      const payload = {
        empresa_id: empresaId,
        codigo: form.codigo || null,
        nome: form.nome,
        descricao: form.descricao || null,
        unidade: form.unidade,
        preco_unitario: Number(form.preco_unitario) || 0,
      };
      if (servico?.id) {
        const { error } = await supabase.from("servicos").update(payload).eq("id", servico.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("servicos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(servico?.id ? "Serviço atualizado!" : "Serviço cadastrado!");
      qc.invalidateQueries({ queryKey: ["servicos", empresaId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{servico?.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label>Código</Label>
              <Input value={form.codigo ?? ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="SRV-001" />
            </div>
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidade *</Label>
              <Select value={form.unidade} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preço unitário (R$) *</Label>
              <Input type="number" step="0.01" min={0}
                value={form.preco_unitario}
                onChange={(e) => setForm({ ...form, preco_unitario: Number(e.target.value) })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.nome || mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
