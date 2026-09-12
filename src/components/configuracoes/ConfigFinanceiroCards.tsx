import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCategoriaGrupos,
  useCategoriasFinanceiras,
  useCentrosCusto,
  PAPEIS_LABEL,
} from "@/hooks/usePlanoContas";
import { LISTAS_LABEL, ListaNome, useTodasListas } from "@/hooks/useListaOpcoes";

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function GruposConfigCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { data: grupos } = useCategoriaGrupos();
  const [novo, setNovo] = useState({ nome: "", tipo: "despesa" as "receita" | "despesa" });

  const invalidate = () => qc.invalidateQueries({ queryKey: [empresaId, "categoria-grupos"] });

  const salvar = async (id: string, campos: Record<string, unknown>) => {
    const { error } = await supabase.from("categoria_grupos").update(campos).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const definirPapel = async (id: string, papel: string) => {
    if (papel !== "nenhum") {
      const atual = (grupos ?? []).find((g) => g.papel === papel && g.id !== id);
      if (atual) await supabase.from("categoria_grupos").update({ papel: null }).eq("id", atual.id);
    }
    await salvar(id, { papel: papel === "nenhum" ? null : papel });
  };

  const adicionar = async () => {
    if (!novo.nome.trim() || !empresaId) return;
    const { error } = await supabase.from("categoria_grupos").insert({
      empresa_id: empresaId,
      chave: slugify(novo.nome),
      nome: novo.nome.trim(),
      tipo: novo.tipo,
      ordem: ((grupos ?? []).at(-1)?.ordem ?? 0) + 10,
    });
    if (error) return toast.error(error.message);
    setNovo({ nome: "", tipo: "despesa" });
    invalidate();
    toast.success("Grupo adicionado");
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("categoria_grupos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Grupos do plano de contas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Organize as categorias em grupos de receita e de custo. Marque quais grupos o sistema usa
          automaticamente para receita de serviço, material e subcontratado.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {(grupos ?? []).map((g) => (
          <div key={g.id} className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto,auto] gap-2 items-center rounded-md border p-2">
            <Input defaultValue={g.nome} onBlur={(e) => e.target.value !== g.nome && salvar(g.id, { nome: e.target.value })} />
            <Badge variant={g.tipo === "receita" ? "default" : "secondary"}>{g.tipo === "receita" ? "Receita" : "Custo"}</Badge>
            <Select value={g.papel ?? "nenhum"} onValueChange={(v) => definirPapel(g.id, v)}>
              <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem marcador</SelectItem>
                {Object.entries(PAPEIS_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={g.ativo} onCheckedChange={(v) => salvar(g.id, { ativo: v })} />
              <Button size="sm" variant="ghost" onClick={() => remover(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
        <div className="flex flex-col md:flex-row gap-2">
          <Input placeholder="Nome do grupo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <Select value={novo.tipo} onValueChange={(v: "receita" | "despesa") => setNovo({ ...novo, tipo: v })}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Custo</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CategoriasConfigCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { data: grupos } = useCategoriaGrupos();
  const { todas } = useCategoriasFinanceiras(false);
  const [novo, setNovo] = useState({ nome: "", cor: "#64748B", grupo_id: "" });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [empresaId, "categorias-financeiras-plano"] });
    qc.invalidateQueries({ queryKey: [empresaId, "financeiro-categorias"] });
  };

  const salvar = async (id: string, campos: Record<string, unknown>) => {
    const { error } = await supabase.from("categorias_financeiras").update(campos).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const mover = async (id: string, delta: number) => {
    const lista = [...todas];
    const i = lista.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= lista.length) return;
    await supabase.from("categorias_financeiras").update({ ordem: (lista[j].ordem ?? 0) }).eq("id", lista[i].id);
    await supabase.from("categorias_financeiras").update({ ordem: (lista[i].ordem ?? 0) }).eq("id", lista[j].id);
    invalidate();
  };

  const adicionar = async () => {
    if (!novo.nome.trim() || !novo.grupo_id || !empresaId) return toast.error("Informe nome e grupo");
    const grupo = (grupos ?? []).find((g) => g.id === novo.grupo_id);
    const { error } = await supabase.from("categorias_financeiras").insert({
      empresa_id: empresaId,
      nome: novo.nome.trim(),
      cor: novo.cor,
      grupo_id: novo.grupo_id,
      tipo: (grupo?.tipo ?? "despesa"),
      grupo: (grupo?.chave ?? "custo_outro"),
      ordem: (todas.at(-1)?.ordem ?? 0) + 10,
    } as never);
    if (error) return toast.error(error.message);
    setNovo({ nome: "", cor: "#64748B", grupo_id: "" });
    invalidate();
    toast.success("Categoria criada");
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("categorias_financeiras").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
    toast.success("Categoria excluída");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plano de contas (categorias)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Crie, renomeie, troque a cor, reordene e ative/desative. Categoria já usada em lançamentos não pode ser
          excluída — desative-a.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {todas.map((c, idx) => (
            <div key={c.id} className="grid grid-cols-1 md:grid-cols-[auto,1fr,220px,auto,auto] gap-2 items-center rounded-md border p-2">
              <input
                type="color"
                className="h-8 w-10 rounded border bg-background"
                defaultValue={c.cor ?? "#64748B"}
                onBlur={(e) => e.target.value !== c.cor && salvar(c.id, { cor: e.target.value })}
              />
              <Input defaultValue={c.nome} onBlur={(e) => e.target.value !== c.nome && salvar(c.id, { nome: e.target.value })} />
              <Select value={c.grupo_id ?? ""} onValueChange={(v) => {
                const g = (grupos ?? []).find((x) => x.id === v);
                salvar(c.id, { grupo_id: v, tipo: g?.tipo ?? c.tipo });
              }}>
                <SelectTrigger><SelectValue placeholder="Grupo" /></SelectTrigger>
                <SelectContent>
                  {(grupos ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => mover(c.id, -1)} disabled={idx === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => mover(c.id, 1)} disabled={idx === todas.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.ativo} onCheckedChange={(v) => salvar(c.id, { ativo: v })} />
                <Button size="sm" variant="ghost" onClick={() => remover(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <input type="color" className="h-10 w-12 rounded border bg-background" value={novo.cor} onChange={(e) => setNovo({ ...novo, cor: e.target.value })} />
          <Input placeholder="Nome da categoria" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <Select value={novo.grupo_id} onValueChange={(v) => setNovo({ ...novo, grupo_id: v })}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Grupo" /></SelectTrigger>
            <SelectContent>
              {(grupos ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CentrosCustoConfigCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { todos } = useCentrosCusto(false);
  const [novo, setNovo] = useState({ nome: "", codigo: "" });

  const invalidate = () => qc.invalidateQueries({ queryKey: [empresaId, "centros-custo"] });

  const salvar = async (id: string, campos: Record<string, unknown>) => {
    const { error } = await supabase.from("centros_custo").update(campos).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const adicionar = async () => {
    if (!novo.nome.trim() || !empresaId) return;
    const { error } = await supabase.from("centros_custo").insert({
      empresa_id: empresaId, nome: novo.nome.trim(), codigo: novo.codigo.trim() || null,
    });
    if (error) return toast.error(error.message);
    setNovo({ nome: "", codigo: "" });
    invalidate();
    toast.success("Centro de custo criado");
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("centros_custo").delete().eq("id", id);
    if (error) return toast.error("Centro de custo em uso. Desative-o em vez de excluir.");
    invalidate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Centros de custo</CardTitle>
        <p className="text-xs text-muted-foreground">Usados em lançamentos, materiais, cartão e contratações, e nos filtros dos relatórios.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {todos.map((c) => (
          <div key={c.id} className="grid grid-cols-1 md:grid-cols-[140px,1fr,auto] gap-2 items-center rounded-md border p-2">
            <Input defaultValue={c.codigo ?? ""} placeholder="Código" onBlur={(e) => e.target.value !== (c.codigo ?? "") && salvar(c.id, { codigo: e.target.value || null })} />
            <Input defaultValue={c.nome} onBlur={(e) => e.target.value !== c.nome && salvar(c.id, { nome: e.target.value })} />
            <div className="flex items-center gap-2">
              <Switch checked={c.ativo} onCheckedChange={(v) => salvar(c.id, { ativo: v })} />
              <Button size="sm" variant="ghost" onClick={() => remover(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
        <div className="flex flex-col md:flex-row gap-2">
          <Input className="md:w-[140px]" placeholder="Código" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} />
          <Input placeholder="Nome do centro de custo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <Button onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

const LISTAS: ListaNome[] = ["unidade", "condicao_pagamento", "tipo_obra", "tipo_comprador", "forma_pagamento"];

export function ListasConfigCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { data } = useTodasListas();
  const [lista, setLista] = useState<ListaNome>("unidade");
  const [novo, setNovo] = useState("");

  const itens = (data ?? []).filter((o) => o.lista === lista);
  const invalidate = () => qc.invalidateQueries({ queryKey: [empresaId, "listas-opcoes"] });

  const salvar = async (id: string, campos: Record<string, unknown>) => {
    const { error } = await supabase.from("listas_opcoes").update(campos).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const adicionar = async () => {
    if (!novo.trim() || !empresaId) return;
    const { error } = await supabase.from("listas_opcoes").insert({
      empresa_id: empresaId,
      lista,
      valor: lista === "unidade" ? novo.trim().toLowerCase() : slugify(novo),
      rotulo: novo.trim(),
      ordem: (itens.at(-1)?.ordem ?? 0) + 1,
    });
    if (error) return toast.error(error.message);
    setNovo("");
    invalidate();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("listas_opcoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Listas do sistema</CardTitle>
        <p className="text-xs text-muted-foreground">
          Unidades, condições de pagamento, tipos de obra, tipos de comprador e rótulos das formas de pagamento.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Lista</Label>
          <Select value={lista} onValueChange={(v: ListaNome) => setLista(v)}>
            <SelectTrigger className="md:w-[320px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LISTAS.map((l) => <SelectItem key={l} value={l}>{LISTAS_LABEL[l]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          {itens.map((o) => (
            <div key={o.id} className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-2 items-center rounded-md border p-2">
              <Input defaultValue={o.rotulo} onBlur={(e) => e.target.value !== o.rotulo && salvar(o.id, { rotulo: e.target.value })} />
              <div className="flex items-center gap-2">
                <Switch checked={o.ativo} onCheckedChange={(v) => salvar(o.id, { ativo: v })} />
                {lista !== "forma_pagamento" && (
                  <Button size="sm" variant="ghost" onClick={() => remover(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {lista !== "forma_pagamento" && (
          <div className="flex gap-2">
            <Input placeholder="Novo item" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} />
            <Button onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
