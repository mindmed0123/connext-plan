import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORIGEM_LABEL, REGIAO_LABEL } from "@/lib/obra-helpers";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Origem = Database["public"]["Enums"]["obra_origem"];
type Regiao = Database["public"]["Enums"]["obra_regiao"];

export function ObraFormDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void }) {
  const [form, setForm] = useState({
    codigo_chamado: "",
    origem: "sabesp" as Origem,
    regiao: "leste" as Regiao,
    engenheiro_responsavel: "",
    descricao_servico: "",
    endereco: "",
    data_recebimento: new Date().toISOString().slice(0, 10),
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("obras")
        .insert([{ ...form, created_by: u.user?.id }])
        .select()
        .single();
      if (error) throw error;
      // Timeline
      await supabase.from("obra_timeline").insert([{
        obra_id: data.id,
        user_id: u.user?.id,
        evento: "Obra criada",
        detalhes: `Chamado ${data.codigo_chamado} cadastrado no sistema`,
      }]);
      return data;
    },
    onSuccess: () => {
      toast.success("Obra cadastrada");
      onCreated?.();
      onOpenChange(false);
      setForm({ ...form, codigo_chamado: "", engenheiro_responsavel: "", descricao_servico: "", endereco: "" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova obra</DialogTitle>
          <DialogDescription>Cadastre um novo chamado para iniciar o fluxo</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Código do chamado *</Label>
            <Input
              value={form.codigo_chamado}
              onChange={(e) => setForm({ ...form, codigo_chamado: e.target.value })}
              placeholder="CSCR12345"
            />
          </div>
          <div className="space-y-2">
            <Label>Data de recebimento</Label>
            <Input
              type="date"
              value={form.data_recebimento}
              onChange={(e) => setForm({ ...form, data_recebimento: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v as Origem })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGEM_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Região</Label>
            <Select value={form.regiao} onValueChange={(v) => setForm({ ...form, regiao: v as Regiao })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REGIAO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Engenheiro responsável *</Label>
            <Input
              value={form.engenheiro_responsavel}
              onChange={(e) => setForm({ ...form, engenheiro_responsavel: e.target.value })}
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Endereço *</Label>
            <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Descrição do serviço *</Label>
            <Textarea
              rows={3}
              value={form.descricao_servico}
              onChange={(e) => setForm({ ...form, descricao_servico: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={
              mut.isPending ||
              !form.codigo_chamado ||
              !form.engenheiro_responsavel ||
              !form.endereco ||
              !form.descricao_servico
            }
          >
            {mut.isPending ? "Salvando..." : "Cadastrar obra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
