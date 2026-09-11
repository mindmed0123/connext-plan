import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Building2, ShieldAlert, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export default function Admin() {
  const { isSuperAdmin, isLoading } = useUserRole();
  const qc = useQueryClient();

  const [openModal, setOpenModal] = useState(false);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState("");
  const [novaEmpresaEmail, setNovaEmpresaEmail] = useState("");
  const [novaEmpresaAdminNome, setNovaEmpresaAdminNome] = useState("");
  const [novaEmpresaPlano, setNovaEmpresaPlano] = useState("basico");
  const [criando, setCriando] = useState(false);

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

  async function criarEmpresaCliente() {
    if (!novaEmpresaNome.trim()) return toast.error("Informe o nome da empresa");
    if (!novaEmpresaEmail.trim()) return toast.error("Informe o e-mail do administrador");
    setCriando(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-client-company", {
        body: {
          empresa_nome: novaEmpresaNome.trim(),
          admin_email: novaEmpresaEmail.trim(),
          admin_nome: novaEmpresaAdminNome.trim() || undefined,
          plano: novaEmpresaPlano,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error ?? error?.message ?? "Erro desconhecido");
      }
      toast.success((data as any).message ?? "Empresa criada e convite enviado!");
      qc.invalidateQueries({ queryKey: ["admin-empresas"] });
      setOpenModal(false);
      setNovaEmpresaNome("");
      setNovaEmpresaEmail("");
      setNovaEmpresaAdminNome("");
      setNovaEmpresaPlano("basico");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar empresa");
    } finally {
      setCriando(false);
    }
  }

  if (isLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/obras" replace />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Painel Super Admin</h1>
            <p className="text-sm text-muted-foreground">Gerencie todas as empresas do sistema</p>
          </div>
        </div>
        <Button onClick={() => setOpenModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Criar empresa cliente
        </Button>
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
                  <Select value={e.plano} onValueChange={(v) => update.mutate({ id: e.id, patch: { plano: v } })}>
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
                    <Switch checked={e.ativo} onCheckedChange={(v) => update.mutate({ id: e.id, patch: { ativo: v } })} />
                    <Badge variant={e.ativo ? "default" : "secondary"}>{e.ativo ? "Ativa" : "Inativa"}</Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar nova empresa cliente</DialogTitle>
            <DialogDescription>
              Cria uma empresa totalmente isolada e envia um convite por e-mail para o administrador dela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome da empresa *</Label>
              <Input placeholder="Ex: Construtora ABC" value={novaEmpresaNome} onChange={(e) => setNovaEmpresaNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail do administrador *</Label>
              <Input type="email" placeholder="admin@empresa.com" value={novaEmpresaEmail} onChange={(e) => setNovaEmpresaEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Este e-mail receberá o convite de acesso e será o admin dessa empresa.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome do administrador</Label>
              <Input placeholder="Opcional" value={novaEmpresaAdminNome} onChange={(e) => setNovaEmpresaAdminNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={novaEmpresaPlano} onValueChange={setNovaEmpresaPlano}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)} disabled={criando}>Cancelar</Button>
            <Button onClick={criarEmpresaCliente} disabled={criando}>
              {criando ? "Criando..." : "Criar e enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
