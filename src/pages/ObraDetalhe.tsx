import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { OBRA_STATUS_LIST, OBRA_STATUS_LABEL, ORIGEM_LABEL, getRegiaoLabel } from "@/lib/obra-helpers";
import { StatusPipeline } from "@/components/obras/StatusPipeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { VistoriaTab } from "@/components/obras/tabs/VistoriaTab";
import { OrcamentoTab } from "@/components/obras/tabs/OrcamentoTab";
import { ExecucaoTab } from "@/components/obras/tabs/ExecucaoTab";
import { FotosTab } from "@/components/obras/tabs/FotosTab";
import { FaturamentoTab } from "@/components/obras/tabs/FaturamentoTab";
import { TimelineTab } from "@/components/obras/tabs/TimelineTab";
import { EquipeTab } from "@/components/obras/tabs/EquipeTab";
import { ContratacoesTab } from "@/components/obras/tabs/ContratacoesTab";
import { MateriaisTab } from "@/components/obras/tabs/MateriaisTab";
import { AdendosTab } from "@/components/obras/tabs/AdendosTab";
import { DreTab } from "@/components/obras/tabs/DreTab";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDateBR } from "@/lib/date";

export default function ObraDetalhe() {
  const { id: obraId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();

  const { data: obra, isLoading } = useQuery({
    queryKey: ["obra", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("*").eq("id", obraId!).single();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: any) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("obras").update({ status }).eq("id", obraId!);
      if (error) throw error;
      await supabase.from("obra_timeline").insert([{
        obra_id: obraId!,
        user_id: u.user?.id,
        evento: "Status alterado",
        detalhes: `Novo status: ${OBRA_STATUS_LABEL[status as keyof typeof OBRA_STATUS_LABEL]}`,
      }]);
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries();
    },
  });

  const deleteObra = useMutation({
    mutationFn: async () => {
      if (!obraId) return;
      const { data: fotos } = await supabase.from("fotos_obra").select("storage_path").eq("obra_id", obraId);
      const paths = (fotos ?? []).map((f) => f.storage_path).filter(Boolean) as string[];
      if (paths.length > 0) await supabase.storage.from("obras-fotos").remove(paths);
      const { error } = await supabase.from("obras").delete().eq("id", obraId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obra excluída com sucesso");
      navigate("/obras");
    },
    onError: (e: any) => toast.error("Erro ao excluir obra", { description: e?.message }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando obra...</p>;
  if (!obra) return <p className="text-sm text-muted-foreground">Obra não encontrada.</p>;

  const tabCls = "text-xs px-3 py-1.5 whitespace-nowrap";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/obras")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para obras
      </Button>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{obra.codigo_chamado}</h1>
              <StatusBadge status={obra.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{obra.descricao_servico}</p>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Select value={obra.status} onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className="h-9 w-[230px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBRA_STATUS_LIST.map((s) => (
                    <SelectItem key={s} value={s}>{OBRA_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir obra {obra.codigo_chamado}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação <strong>não pode ser desfeita</strong>. Todos os dados vinculados a esta obra
                      (fotos, vistorias, orçamentos, execuções, equipe, contratações, materiais, RCs, pedidos,
                      notas fiscais, recebimentos e histórico) serão apagados permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteObra.mutate()}
                      disabled={deleteObra.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteObra.isPending ? "Excluindo..." : "Sim, excluir tudo"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="text-muted-foreground">Origem: </span>{ORIGEM_LABEL[obra.origem]}</div>
          <div><span className="text-muted-foreground">Região: </span>{getRegiaoLabel(obra as any)}</div>
          <div><span className="text-muted-foreground">Engenheiro: </span>{obra.engenheiro_responsavel || "—"}</div>
          <div><span className="text-muted-foreground">Recebido: </span>{formatDateBR(obra.data_recebimento)}</div>
          <div className="sm:col-span-2 lg:col-span-4">
            <span className="text-muted-foreground">Endereço: </span>{obra.endereco || "—"}
          </div>
        </div>

        <StatusPipeline
          currentStatus={obra.status}
          onChangeStatus={(s) => updateStatus.mutate(s)}
          canEdit={isAdmin}
        />
      </div>

      {isAdmin ? (
        <Tabs defaultValue="dre">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto w-auto gap-1 p-1">
              <TabsTrigger value="dre" className={tabCls}>DRE / Balanço</TabsTrigger>
              <TabsTrigger value="vistoria" className={tabCls}>Vistoria</TabsTrigger>
              <TabsTrigger value="orcamento" className={tabCls}>Orçamento</TabsTrigger>
              <TabsTrigger value="execucao" className={tabCls}>Execução</TabsTrigger>
              <TabsTrigger value="equipe" className={tabCls}>Equipe</TabsTrigger>
              <TabsTrigger value="fotos" className={tabCls}>Fotos</TabsTrigger>
              <TabsTrigger value="contratacoes" className={tabCls}>Pagamentos</TabsTrigger>
              <TabsTrigger value="materiais" className={tabCls}>Materiais</TabsTrigger>
              <TabsTrigger value="faturamento" className={tabCls}>Faturamento</TabsTrigger>
              <TabsTrigger value="adendos" className={tabCls}>Contrato / Adendos</TabsTrigger>
              <TabsTrigger value="timeline" className={tabCls}>Histórico</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="dre" className="mt-4"><DreTab obraId={obra.id} /></TabsContent>
          <TabsContent value="vistoria" className="mt-4"><VistoriaTab obraId={obra.id} /></TabsContent>
          <TabsContent value="orcamento" className="mt-4"><OrcamentoTab obraId={obra.id} /></TabsContent>
          <TabsContent value="execucao" className="mt-4"><ExecucaoTab obraId={obra.id} /></TabsContent>
          <TabsContent value="equipe" className="mt-4"><EquipeTab obraId={obra.id} /></TabsContent>
          <TabsContent value="fotos" className="mt-4"><FotosTab obraId={obra.id} /></TabsContent>
          <TabsContent value="contratacoes" className="mt-4"><ContratacoesTab obraId={obra.id} /></TabsContent>
          <TabsContent value="materiais" className="mt-4"><MateriaisTab obraId={obra.id} /></TabsContent>
          <TabsContent value="faturamento" className="mt-4"><FaturamentoTab obraId={obra.id} /></TabsContent>
          <TabsContent value="adendos" className="mt-4"><AdendosTab obraId={obra.id} /></TabsContent>
          <TabsContent value="timeline" className="mt-4"><TimelineTab obraId={obra.id} /></TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="fotos">
          <TabsList>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="timeline">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="fotos" className="mt-4"><FotosTab obraId={obra.id} /></TabsContent>
          <TabsContent value="equipe" className="mt-4"><EquipeTab obraId={obra.id} /></TabsContent>
          <TabsContent value="timeline" className="mt-4"><TimelineTab obraId={obra.id} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
