import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Building2, ShieldAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export default function Admin() {
  const { isSuperAdmin, isLoading } = useUserRole();
  const qc = useQueryClient();

  const { data: empresas, isLoading: loadingEmp } = useQuery({
    queryKey: ["admin-empresas"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const [{ data, error }, { data: contatos }] = await Promise.all([
        supabase.from("empresas").select("*").order("created_at", { ascending: false }),
        supabase.rpc("admin_list_empresas_contatos"),
      ]);
      if (error) throw error;
      const map = new Map((contatos ?? []).map((c: any) => [c.empresa_id, c]));
      return (data ?? []).map((e: any) => ({ ...e, _admin: map.get(e.id) }));
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("empresas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-empresas"] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Painel Super Admin</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as empresas do sistema</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Contato Empresa</TableHead>
              <TableHead>Admin (login)</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Cadastrada em</TableHead>
              <TableHead>Ativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingEmp && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Carregando...</TableCell></TableRow>
            )}
            {!loadingEmp && (empresas?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                <ShieldAlert className="inline h-4 w-4 mr-1" /> Nenhuma empresa cadastrada
              </TableCell></TableRow>
            )}
            {empresas?.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="font-medium">{e.nome}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{e.slug}</div>
                </TableCell>
                <TableCell className="text-xs">
                  <div>{e.email || <span className="text-muted-foreground">—</span>}</div>
                  <div className="text-muted-foreground">{e.telefone || "—"}</div>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">{e._admin?.admin_nome || "—"}</div>
                  <div>{e._admin?.admin_email || <span className="text-muted-foreground">—</span>}</div>
                  <div className="text-muted-foreground">{e._admin?.admin_telefone || ""}</div>
                </TableCell>
                <TableCell>
                  <Select
                    value={e.plano}
                    onValueChange={(v) => update.mutate({ id: e.id, patch: { plano: v } })}
                  >
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basico">Básico</SelectItem>
                      <SelectItem value="profissional">Profissional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={e.ativo}
                      onCheckedChange={(v) => update.mutate({ id: e.id, patch: { ativo: v } })}
                    />
                    <Badge variant={e.ativo ? "default" : "secondary"}>{e.ativo ? "Ativa" : "Inativa"}</Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
