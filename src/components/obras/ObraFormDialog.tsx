import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIAO_LABEL } from "@/lib/obra-helpers";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Regiao = Database["public"]["Enums"]["obra_regiao"];

export function ObraFormDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void }) {
  const qc = useQueryClient();
  const [novaOrigem, setNovaOrigem] = useState("");
  const [showAddOrigem, setShowAddOrigem] = useState(false);
  const [form, setForm] = useState({
    codigo_chamado: "",
    origem: "",
    regiao: "leste" as Regiao,
    engenheiro_responsavel: "",
    descricao_servico: "",
    endereco: "",
    data_recebimento: new Date().toISOString().slice(0, 10),
  });

  const { data: origens } = useQuery({
    queryKey: ["origens-obra"],
    queryFn: async () => {
      const { data, error } = await supabase.from("origens_obra").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Define origem padrão quando origens carregarem
  if (origens && origens.length > 0 && !form.origem) {
    setForm((f) => ({ ...f, origem: origens[0].nome }));
  }

  const addOrigem = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.from("origens_obra").insert({ nome }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["origens-obra"] });
      setForm((f) => ({ ...f, origem: data.nome }));
      setNovaOrigem("");
      setShowAddOrigem(false);
      toast.success("Comprador adicionado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar comprador"),
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("obras")
        .insert([{ ...form, created_by: u.user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      await supabase.from("obra_timeline").insert([{
        obra_id: data.id,
        user_id: u.user?.id,
        evento: "Obra criada",
        detalhes: `Chamado ${data.codigo_chamado} cadastrado no sistema`,
      } as any]);
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
            {showAddOrigem ? (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  value={novaOrigem}
                  placeholder="Nova origem"
                  onChange={(e) => setNovaOrigem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novaOrigem.trim()) addOrigem.mutate(novaOrigem.trim());
                  }}
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => setShowAddOrigem(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-1">
                <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {origens?.map((o) => (
                      <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="outline" onClick={() => setShowAddOrigem(true)} title="Adicionar origem">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
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
              !form.origem ||
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
