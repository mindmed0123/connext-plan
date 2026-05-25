import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { APP_MODULOS, AppModulo, MODULO_LABEL, PermissaoLinha } from "@/hooks/usePermissions";
import { useUserRole } from "@/hooks/useUserRole";

type Estado = Record<AppModulo, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>;

const emptyEstado = (): Estado =>
  APP_MODULOS.reduce((acc, m) => {
    acc[m] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
    return acc;
  }, {} as Estado);

export function PermissoesEditor({ pessoaId }: { pessoaId: string }) {
  const qc = useQueryClient();
  const { isSuperAdmin, isAdmin } = useUserRole();
  const podeEditar = isSuperAdmin || isAdmin;
  const [estado, setEstado] = useState<Estado>(emptyEstado());
  const [carregado, setCarregado] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pessoa-permissoes", pessoaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoa_permissoes")
        .select("modulo, can_view, can_create, can_edit, can_delete")
        .eq("pessoa_id", pessoaId);
      if (error) throw error;
      return (data ?? []) as PermissaoLinha[];
    },
  });

  useEffect(() => {
    if (isLoading) return;
    const novo = emptyEstado();
    data?.forEach((r) => {
      novo[r.modulo] = {
        can_view: r.can_view,
        can_create: r.can_create,
        can_edit: r.can_edit,
        can_delete: r.can_delete,
      };
    });
    setEstado(novo);
    setCarregado(true);
  }, [data, isLoading]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!carregado) throw new Error("Aguarde o carregamento das permissões");
      const rows = APP_MODULOS.map((m) => ({
        pessoa_id: pessoaId,
        modulo: m,
        ...estado[m],
      }));
      const { error } = await supabase
        .from("pessoa_permissoes")
        .upsert(rows, { onConflict: "pessoa_id,modulo" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissões salvas");
      qc.invalidateQueries({ queryKey: ["pessoa-permissoes", pessoaId] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!podeEditar) {
    return (
      <div className="rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        Apenas administradores da empresa podem alterar permissões.
      </div>
    );
  }


  const setCampo = (m: AppModulo, campo: keyof Estado[AppModulo], v: boolean) => {
    setEstado((s) => {
      const linha = { ...s[m], [campo]: v };
      // Se desmarcar visualizar, desmarca todo o resto
      if (campo === "can_view" && !v) {
        linha.can_create = false;
        linha.can_edit = false;
        linha.can_delete = false;
      }
      // Se marcar create/edit/delete, garante view
      if (campo !== "can_view" && v) linha.can_view = true;
      return { ...s, [m]: linha };
    });
  };

  const marcarTudo = (val: boolean) => {
    const novo = emptyEstado();
    APP_MODULOS.forEach((m) => {
      novo[m] = { can_view: val, can_create: val, can_edit: val, can_delete: val };
    });
    setEstado(novo);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Defina o que esta pessoa pode fazer em cada módulo do sistema.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => marcarTudo(true)}>Liberar tudo</Button>
          <Button variant="outline" size="sm" onClick={() => marcarTudo(false)}>Bloquear tudo</Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Módulo</TableHead>
              <TableHead className="text-center w-[90px]">Ver</TableHead>
              <TableHead className="text-center w-[90px]">Criar</TableHead>
              <TableHead className="text-center w-[90px]">Editar</TableHead>
              <TableHead className="text-center w-[90px]">Excluir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : (
              APP_MODULOS.map((m) => (
                <TableRow key={m}>
                  <TableCell className="font-medium">{MODULO_LABEL[m]}</TableCell>
                  {(["can_view", "can_create", "can_edit", "can_delete"] as const).map((campo) => (
                    <TableCell key={campo} className="text-center">
                      <Checkbox
                        checked={estado[m][campo]}
                        onCheckedChange={(v) => setCampo(m, campo, !!v)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando..." : "Salvar permissões"}
        </Button>
      </div>
    </div>
  );
}
