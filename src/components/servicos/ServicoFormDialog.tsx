import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const UNIDADES = [
  "un", "m", "m²", "m³", "kg", "t", "h", "dia", "mês", "vb", "cj", "pc", "gl", "km", "l", "cx",
] as const;

export const TIPO_TRIB_OPTIONS = [
  { value: "tributado_municipio", label: "Operação tributável / Tributado no município" },
  { value: "isento", label: "Isento" },
  { value: "imune", label: "Imune" },
  { value: "nao_incidencia", label: "Não incidência" },
  { value: "exportacao", label: "Exportação" },
] as const;

export type ServicoEdit = {
  id?: string;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  descricao_detalhada?: string | null;
  categoria_id?: string | null;
  unidade: string;
  preco_unitario: number;
  desconto_padrao_pct?: number;
  codigo_servico_municipio?: string | null;
  codigo_lc116?: string | null;
  codigo_nbs?: string | null;
  aliquota_iss?: number;
  iss_retido?: boolean;
  tipo_tributacao?: string;
};

const empty = (): ServicoEdit => ({
  nome: "", codigo: "", descricao: "", descricao_detalhada: "",
  categoria_id: null, unidade: "un", preco_unitario: 0, desconto_padrao_pct: 0,
  codigo_servico_municipio: "", codigo_lc116: "", codigo_nbs: "",
  aliquota_iss: 0, iss_retido: false, tipo_tributacao: "tributado_municipio",
});

export function ServicoFormDialog({
  open, onOpenChange, servico,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  servico?: ServicoEdit | null;
}) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<ServicoEdit>(empty());

  useEffect(() => {
    if (open) setForm(servico ? { ...empty(), ...servico } : empty());
  }, [open, servico]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-servico", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_servico")
        .select("id,nome,cor")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const set = <K extends keyof ServicoEdit>(k: K, v: ServicoEdit[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não identificada");
      if (!form.nome.trim()) throw new Error("Informe o nome do serviço");
      const payload = {
        empresa_id: empresaId,
        codigo: form.codigo || null, // null = trigger gera SRV00001
        nome: form.nome.trim(),
        descricao: form.descricao || null,
        descricao_detalhada: form.descricao_detalhada || null,
        categoria_id: form.categoria_id || null,
        unidade: form.unidade,
        preco_unitario: Number(form.preco_unitario) || 0,
        desconto_padrao_pct: Number(form.desconto_padrao_pct) || 0,
        codigo_servico_municipio: form.codigo_servico_municipio || null,
        codigo_lc116: form.codigo_lc116 || null,
        codigo_nbs: form.codigo_nbs || null,
        aliquota_iss: Number(form.aliquota_iss) || 0,
        iss_retido: !!form.iss_retido,
        tipo_tributacao: form.tipo_tributacao || "tributado_municipio",
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
      qc.invalidateQueries({ queryKey: ["servicos"] });
      qc.invalidateQueries({ queryKey: ["servicos-ativos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {servico?.id ? `Editar serviço ${servico.codigo ? `— ${servico.codigo}` : ""}` : "Novo serviço"}
          </DialogTitle>
        </DialogHeader>

        {/* Cabeçalho fixo */}
        <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3">
          <div className="col-span-2">
            <Label className="text-xs">Descrição resumida *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} autoFocus />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select
              value={form.categoria_id ?? "__none__"}
              onValueChange={(v) => set("categoria_id", v === "__none__" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem categoria</SelectItem>
                {categorias.map((c: { id: string; nome: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="servico" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="servico">Serviço</TabsTrigger>
            <TabsTrigger value="impostos">Impostos e contribuições</TabsTrigger>
            <TabsTrigger value="detalhes">Descrição detalhada</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-4">
            {/* SERVIÇO */}
            <TabsContent value="servico" className="space-y-3 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código (deixe vazio para gerar SRV00001)</Label>
                  <Input value={form.codigo ?? ""} onChange={(e) => set("codigo", e.target.value)} placeholder="Automático" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de tributação</Label>
                  <Select value={form.tipo_tributacao} onValueChange={(v) => set("tipo_tributacao", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPO_TRIB_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor unitário (R$) *</Label>
                  <Input type="number" step="0.01" min={0}
                    value={form.preco_unitario}
                    onChange={(e) => set("preco_unitario", Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Unidade *</Label>
                  <Select value={form.unidade} onValueChange={(v) => set("unidade", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">% desconto padrão</Label>
                  <Input type="number" step="0.01" min={0} max={100}
                    value={form.desconto_padrao_pct}
                    onChange={(e) => set("desconto_padrao_pct", Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Código do serviço no município</Label>
                  <Input value={form.codigo_servico_municipio ?? ""}
                    onChange={(e) => set("codigo_servico_municipio", e.target.value)}
                    placeholder="Ex: 01023" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Descrição curta (resumo)</Label>
                  <Textarea rows={2} value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* IMPOSTOS */}
            <TabsContent value="impostos" className="space-y-3 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">% Alíquota do ISS</Label>
                  <Input type="number" step="0.01" min={0} max={100}
                    value={form.aliquota_iss}
                    onChange={(e) => set("aliquota_iss", Number(e.target.value))} />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!form.iss_retido} onCheckedChange={(v) => set("iss_retido", v)} />
                    <Label>ISS retido na fonte</Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Código LC 116</Label>
                  <Input value={form.codigo_lc116 ?? ""}
                    onChange={(e) => set("codigo_lc116", e.target.value)} placeholder="Ex: 7.02" />
                </div>
                <div>
                  <Label className="text-xs">Código NBS</Label>
                  <Input value={form.codigo_nbs ?? ""}
                    onChange={(e) => set("codigo_nbs", e.target.value)} placeholder="Ex: 1.0101.00.00" />
                </div>
              </div>
            </TabsContent>

            {/* DETALHES */}
            <TabsContent value="detalhes" className="space-y-3 mt-0">
              <Label className="text-xs">Descrição detalhada do serviço</Label>
              <Textarea rows={10}
                placeholder="Escopo do serviço, materiais inclusos, garantias, exclusões…"
                value={form.descricao_detalhada ?? ""}
                onChange={(e) => set("descricao_detalhada", e.target.value)} />
            </TabsContent>
          </div>
        </Tabs>

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
