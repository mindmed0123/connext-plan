import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export function ObraFormDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void }) {
  const qc = useQueryClient();
  const [novaOrigem, setNovaOrigem] = useState("");
  const [showAddOrigem, setShowAddOrigem] = useState(false);
  const [novaRegiao, setNovaRegiao] = useState("");
  const [showAddRegiao, setShowAddRegiao] = useState(false);
  const [form, setForm] = useState({
    codigo_chamado: "",
    origem: "",
    regiao_label: "",
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

  const { data: regioes } = useQuery({
    queryKey: ["regioes-obra"],
    queryFn: async () => {
      const { data, error } = await supabase.from("regioes_obra").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Defaults
  if (origens && origens.length > 0 && !form.origem) {
    setForm((f) => ({ ...f, origem: origens[0].nome }));
  }
  if (regioes && regioes.length > 0 && !form.regiao_label) {
    setForm((f) => ({ ...f, regiao_label: regioes[0].nome }));
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

  const addRegiao = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.from("regioes_obra").insert({ nome } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["regioes-obra"] });
      setForm((f) => ({ ...f, regiao_label: data.nome }));
      setNovaRegiao("");
      setShowAddRegiao(false);
      toast.success("Região adicionada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar região"),
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("Sessão inválida. Faça login novamente.");

      // Busca empresa_id do usuário (não depender do default do banco)
      const { data: ur, error: urErr } = await supabase
        .from("user_roles")
        .select("empresa_id")
        .eq("user_id", u.user.id)
        .not("empresa_id", "is", null)
        .maybeSingle();
      if (urErr) throw urErr;
      if (!ur?.empresa_id) throw new Error("Nenhuma empresa vinculada ao seu usuário.");

      const payload: any = {
        empresa_id: ur.empresa_id,
        codigo_chamado: form.codigo_chamado,
        origem: form.origem,
        engenheiro_responsavel: form.engenheiro_responsavel,
        descricao_servico: form.descricao_servico,
        endereco: form.endereco,
        data_recebimento: form.data_recebimento,
        regiao: "leste", // valor dummy para satisfazer enum legado
        regiao_label: form.regiao_label || null,
        created_by: u.user.id,
      };
      const { data, error } = await supabase.from("obras").insert([payload]).select().single();
      if (error) throw error;
      await supabase.from("obra_timeline").insert([{
        obra_id: data.id,
        empresa_id: ur.empresa_id,
        user_id: u.user.id,
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

          {/* Comprador */}
          <div className="space-y-2">
            <Label>Comprador</Label>
            {showAddOrigem ? (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  value={novaOrigem}
                  placeholder="Nome do comprador"
                  onChange={(e) => setNovaOrigem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novaOrigem.trim()) addOrigem.mutate(novaOrigem.trim());
                  }}
                />
                <Button type="button" size="icon" variant="outline" onClick={() => novaOrigem.trim() && addOrigem.mutate(novaOrigem.trim())} disabled={addOrigem.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => { setShowAddOrigem(false); setNovaOrigem(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (origens?.length ?? 0) === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                Nenhum comprador cadastrado.{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setShowAddOrigem(true)}
                >
                  Adicione o primeiro
                </button>
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
                <Button type="button" size="icon" variant="outline" onClick={() => setShowAddOrigem(true)} title="Adicionar comprador">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Região */}
          <div className="space-y-2">
            <Label>Região</Label>
            {showAddRegiao ? (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  value={novaRegiao}
                  placeholder="Ex: Centro"
                  onChange={(e) => setNovaRegiao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novaRegiao.trim()) addRegiao.mutate(novaRegiao.trim());
                  }}
                />
                <Button type="button" size="icon" variant="outline" onClick={() => novaRegiao.trim() && addRegiao.mutate(novaRegiao.trim())} disabled={addRegiao.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => { setShowAddRegiao(false); setNovaRegiao(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (regioes?.length ?? 0) === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                Nenhuma região cadastrada.{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setShowAddRegiao(true)}
                >
                  Adicione a primeira
                </button>
              </div>
            ) : (
              <div className="flex gap-1">
                <Select value={form.regiao_label} onValueChange={(v) => setForm({ ...form, regiao_label: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {regioes?.map((r: any) => (
                      <SelectItem key={r.id} value={r.nome}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="outline" onClick={() => setShowAddRegiao(true)} title="Adicionar região">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
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
