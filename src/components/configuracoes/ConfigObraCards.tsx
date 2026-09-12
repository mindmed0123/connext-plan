import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useObraConfig, ROTULOS_PADRAO, type StatusCategoria } from "@/hooks/useObraConfig";

const CATEGORIAS: { value: StatusCategoria; label: string }[] = [
  { value: "nao_iniciada", label: "Não iniciada" },
  { value: "em_execucao", label: "Em execução" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function StatusConfigCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { todosStatuses } = useObraConfig();
  const [novo, setNovo] = useState({ nome: "", cor: "#64748B", categoria: "em_execucao" as StatusCategoria });

  const invalidate = () => qc.invalidateQueries({ queryKey: [empresaId, "obra-status-config"] });

  const salvar = async (id: string, campos: Record<string, unknown>) => {
    const { error } = await supabase.from("obra_status_config").update(campos).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const adicionar = async () => {
    if (!novo.nome.trim()) return;
    const { error } = await supabase.from("obra_status_config").insert({
      empresa_id: empresaId as string,
      chave: slugify(novo.nome),
      nome: novo.nome.trim(),
      cor: novo.cor,
      categoria: novo.categoria,
      ordem: (todosStatuses.at(-1)?.ordem ?? 0) + 10,
    });
    if (error) return toast.error(error.message);
    setNovo({ nome: "", cor: "#64748B", categoria: "em_execucao" });
    invalidate();
    toast.success("Etapa adicionada");
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("obra_status_config").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Etapas da obra</CardTitle>
        <p className="text-xs text-muted-foreground">
          Defina as etapas do seu fluxo, a cor e em que fase cada uma entra.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {todosStatuses.map((s) => (
          <div key={s.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_180px_90px_auto] items-center gap-2 rounded-md border p-2">
            <Input defaultValue={s.nome} onBlur={(e) => e.target.value !== s.nome && salvar(s.id, { nome: e.target.value })} />
            <input
              type="color"
              defaultValue={s.cor}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
              onBlur={(e) => e.target.value !== s.cor && salvar(s.id, { cor: e.target.value })}
            />
            <Select value={s.categoria} onValueChange={(v) => salvar(s.id, { categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              defaultValue={s.ordem}
              onBlur={(e) => Number(e.target.value) !== s.ordem && salvar(s.id, { ordem: Number(e.target.value) })}
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <Checkbox checked={s.ativo} onCheckedChange={(v) => salvar(s.id, { ativo: !!v })} /> ativa
              </label>
              <Button size="sm" variant="ghost" onClick={() => remover(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Input
            className="w-56"
            placeholder="Nome da nova etapa"
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          />
          <input
            type="color"
            value={novo.cor}
            className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            onChange={(e) => setNovo({ ...novo, cor: e.target.value })}
          />
          <Select value={novo.categoria} onValueChange={(v) => setNovo({ ...novo, categoria: v as StatusCategoria })}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function RotulosConfigCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { rotulos } = useObraConfig();
  const [form, setForm] = useState(rotulos);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(rotulos); }, [rotulos.obra_singular, rotulos.codigo_obra, rotulos.comprador]);

  const salvar = async () => {
    setSaving(true);
    const { error } = await supabase.from("empresa_rotulos").upsert(
      { ...form, empresa_id: empresaId as string },
      { onConflict: "empresa_id" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [empresaId, "empresa-rotulos"] });
    toast.success("Nomes atualizados");
  };

  const campos: { key: keyof typeof ROTULOS_PADRAO; label: string }[] = [
    { key: "obra_singular", label: "Obra (singular)" },
    { key: "obra_plural", label: "Obras (plural)" },
    { key: "codigo_obra", label: "Código da obra" },
    { key: "comprador", label: "Comprador / origem" },
    { key: "cliente", label: "Cliente" },
    { key: "orcamento", label: "Orçamento" },
    { key: "medicao", label: "Medição" },
  ];

  const toggles: { key: keyof typeof ROTULOS_PADRAO; label: string }[] = [
    { key: "usa_codigo_obra", label: "Usar código da obra" },
    { key: "usa_regiao", label: "Usar região" },
    { key: "usa_engenheiro", label: "Usar engenheiro responsável" },
    { key: "usa_comprador", label: "Usar comprador / origem" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nomes e campos</CardTitle>
        <p className="text-xs text-muted-foreground">Use as palavras do seu dia a dia e desligue os campos que não usa.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {campos.map((c) => (
            <div key={c.key} className="space-y-1">
              <Label>{c.label}</Label>
              <Input
                value={String(form[c.key] ?? "")}
                onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {toggles.map((t) => (
            <label key={t.key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={!!form[t.key]}
                onCheckedChange={(v) => setForm({ ...form, [t.key]: !!v })}
              />
              <span className="text-sm">{t.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={salvar} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrigensConfigCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [nova, setNova] = useState("");

  const { data: origens } = useQuery({
    queryKey: [empresaId, "origens-obra"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("origens_obra").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [empresaId, "origens-obra"] });

  const adicionar = async () => {
    if (!nova.trim()) return;
    const { error } = await supabase.from("origens_obra").insert({ nome: nova.trim(), empresa_id: empresaId as string });
    if (error) return toast.error(error.message);
    setNova("");
    invalidate();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("origens_obra").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Origens das obras</CardTitle>
        <p className="text-xs text-muted-foreground">De onde vêm as suas obras (clientes, contratos, canais).</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {(origens ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma origem cadastrada ainda.</p>
        )}
        {(origens ?? []).map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-md border p-2">
            <span className="text-sm">{o.nome}</span>
            <Button size="sm" variant="ghost" onClick={() => remover(o.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            placeholder="Nome da origem"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
          />
          <Button onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
