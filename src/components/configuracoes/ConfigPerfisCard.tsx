import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { APP_MODULOS, AppModulo, MODULO_LABEL } from "@/hooks/usePermissions";
import { usePerfis, PerfilItem } from "@/hooks/usePerfis";
import { useUserRole } from "@/hooks/useUserRole";

export function ConfigPerfisCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin } = useUserRole();
  const podeEditar = isAdmin || isSuperAdmin;
  const { perfis } = usePerfis();
  const [perfilId, setPerfilId] = useState<string>("");
  const [novoNome, setNovoNome] = useState("");

  const perfilAtual = perfilId || perfis[0]?.id || "";

  const { data: itens } = useQuery({
    queryKey: [empresaId, "perfil-itens", perfilAtual],
    enabled: !!empresaId && !!perfilAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfil_permissao_itens")
        .select("id, perfil_id, modulo, can_view, can_create, can_edit, can_delete")
        .eq("perfil_id", perfilAtual);
      if (error) throw error;
      return (data ?? []) as PerfilItem[];
    },
  });

  const [rascunho, setRascunho] = useState<Record<string, Partial<PerfilItem>>>({});
  const valor = (m: AppModulo, campo: keyof PerfilItem) => {
    const base = (itens ?? []).find((i) => i.modulo === m);
    const d = rascunho[m];
    if (d && campo in d) return Boolean(d[campo]);
    return Boolean(base?.[campo]);
  };
  const set = (m: AppModulo, campo: string, v: boolean) =>
    setRascunho((r) => ({ ...r, [m]: { ...r[m], [campo]: v } }));

  const salvar = async () => {
    if (!empresaId || !perfilAtual) return;
    const rows = APP_MODULOS.map((m) => ({
      empresa_id: empresaId,
      perfil_id: perfilAtual,
      modulo: m,
      can_view: valor(m, "can_view"),
      can_create: valor(m, "can_create"),
      can_edit: valor(m, "can_edit"),
      can_delete: valor(m, "can_delete"),
    }));
    const { error } = await supabase
      .from("perfil_permissao_itens")
      .upsert(rows, { onConflict: "empresa_id,perfil_id,modulo" });
    if (error) return toast.error(error.message);
    const { error: err2 } = await supabase.rpc("aplicar_perfil_permissao", { _perfil_id: perfilAtual });
    if (err2) return toast.error(err2.message);
    setRascunho({});
    qc.invalidateQueries({ queryKey: [empresaId, "perfil-itens", perfilAtual] });
    qc.invalidateQueries({ queryKey: ["pessoa-permissoes"] });
    qc.invalidateQueries({ queryKey: ["my-permissions"] });
    toast.success("Perfil salvo e aplicado a todas as pessoas ligadas a ele");
  };

  const criar = async () => {
    if (!novoNome.trim() || !empresaId) return;
    const { data, error } = await supabase
      .from("perfis_permissao")
      .insert({ empresa_id: empresaId, nome: novoNome.trim() })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setNovoNome("");
    setPerfilId(data.id);
    qc.invalidateQueries({ queryKey: [empresaId, "perfis-permissao"] });
    toast.success("Perfil criado");
  };

  const excluir = async () => {
    if (!perfilAtual) return;
    const { error } = await supabase.from("perfis_permissao").delete().eq("id", perfilAtual);
    if (error) return toast.error(error.message);
    setPerfilId("");
    qc.invalidateQueries({ queryKey: [empresaId, "perfis-permissao"] });
  };

  if (!podeEditar) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Perfis de permissão</CardTitle>
        <p className="text-xs text-muted-foreground">
          Defina conjuntos de permissões e use-os no cadastro e no convite de pessoas. Ao salvar, todos os
          integrantes ligados ao perfil são atualizados.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <Select value={perfilAtual} onValueChange={setPerfilId}>
            <SelectTrigger className="md:w-[280px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
            <SelectContent>
              {perfis.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={excluir} disabled={!perfilAtual}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir perfil
          </Button>
          <div className="flex gap-2 md:ml-auto">
            <Input placeholder="Novo perfil" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            <Button variant="outline" onClick={criar}><Plus className="h-4 w-4" /> Criar</Button>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead className="text-center">Ver</TableHead>
                <TableHead className="text-center">Criar</TableHead>
                <TableHead className="text-center">Editar</TableHead>
                <TableHead className="text-center">Excluir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {APP_MODULOS.map((m) => (
                <TableRow key={m}>
                  <TableCell className="text-sm">{MODULO_LABEL[m]}</TableCell>
                  {(["can_view", "can_create", "can_edit", "can_delete"] as const).map((campo) => (
                    <TableCell key={campo} className="text-center">
                      <Checkbox checked={valor(m, campo)} onCheckedChange={(v) => set(m, campo, Boolean(v))} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button onClick={salvar} disabled={!perfilAtual}><Save className="h-4 w-4" /> Salvar perfil</Button>
        </div>
      </CardContent>
    </Card>
  );
}
