import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { OBRA_STATUS_LIST, OBRA_STATUS_LABEL, ORIGEM_LABEL, getRegiaoLabel } from "@/lib/obra-helpers";
import { StatusPipeline } from "./StatusPipeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { VistoriaTab } from "./tabs/VistoriaTab";
import { OrcamentoTab } from "./tabs/OrcamentoTab";
import { ExecucaoTab } from "./tabs/ExecucaoTab";
import { FotosTab } from "./tabs/FotosTab";
import { FaturamentoTab } from "./tabs/FaturamentoTab";
import { TimelineTab } from "./tabs/TimelineTab";
import { EquipeTab } from "./tabs/EquipeTab";
import { ContratacoesTab } from "./tabs/ContratacoesTab";
import { MateriaisTab } from "./tabs/MateriaisTab";
import { AdendosTab } from "./tabs/AdendosTab";

import { useUserRole } from "@/hooks/useUserRole";
import { formatDateBR } from "@/lib/date";

export function ObraDetailSheet({ obraId, onClose }: { obraId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const { data: obra } = useQuery({
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
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
    },
  });

  const deleteObra = useMutation({
    mutationFn: async () => {
      if (!obraId) return;
      // 1) Apagar fotos do storage (a tabela cai por cascade, mas os arquivos não)
      const { data: fotos } = await supabase
        .from("fotos_obra")
        .select("storage_path")
        .eq("obra_id", obraId);
      const paths = (fotos ?? []).map((f) => f.storage_path).filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from("obras-fotos").remove(paths);
      }
      // 2) Apagar a obra (cascade remove tudo que está vinculado)
      const { error } = await supabase.from("obras").delete().eq("id", obraId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obra excluída com sucesso");
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["faturamento"] });
      onClose();
    },
    onError: (e: any) => {
      toast.error("Erro ao excluir obra", { description: e?.message });
    },
  });

  return (
    <Sheet open={!!obraId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {obra && (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="text-xl">{obra.codigo_chamado}</SheetTitle>
                <StatusBadge status={obra.status} />
              </div>
              <SheetDescription>{obra.descricao_servico}</SheetDescription>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pt-2">
                <span><strong className="text-foreground">Origem:</strong> {ORIGEM_LABEL[obra.origem]}</span>
                <span><strong className="text-foreground">Região:</strong> {getRegiaoLabel(obra as any)}</span>
                <span><strong className="text-foreground">Engenheiro:</strong> {obra.engenheiro_responsavel}</span>
                <span><strong className="text-foreground">Recebido:</strong> {formatDateBR(obra.data_recebimento)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">Endereço:</strong> {obra.endereco}
              </div>

              <div className="pt-3">
                <StatusPipeline
                  currentStatus={obra.status}
                  onChangeStatus={(s) => updateStatus.mutate(s)}
                  canEdit={isAdmin}
                />
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Atualizar status:</span>
                    <Select value={obra.status} onValueChange={(v) => updateStatus.mutate(v)}>
                      <SelectTrigger className="h-8 w-[230px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OBRA_STATUS_LIST.map((s) => (
                          <SelectItem key={s} value={s}>{OBRA_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir obra
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir obra {obra.codigo_chamado}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação <strong>não pode ser desfeita</strong>. Todos os dados vinculados a esta obra serão apagados permanentemente:
                          <span className="block mt-2 text-xs">
                            • Fotos, vistorias, orçamentos e execuções<br />
                            • Equipe e responsáveis<br />
                            • Contratações de terceirizados e parcelas de pagamento<br />
                            • Materiais, RCs, pedidos de compra e notas fiscais<br />
                            • Recebimentos e histórico
                          </span>
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
            </SheetHeader>

            {isAdmin ? (
              <Tabs defaultValue="vistoria" className="mt-6">
                <div className="-mx-6 overflow-x-auto px-6 pb-1">
                  <TabsList className="inline-flex h-auto w-auto gap-1 p-1">
                    <TabsTrigger value="vistoria" className="text-xs px-3 py-1.5 whitespace-nowrap">Vistoria</TabsTrigger>
                    <TabsTrigger value="orcamento" className="text-xs px-3 py-1.5 whitespace-nowrap">Orçamento</TabsTrigger>
                    <TabsTrigger value="execucao" className="text-xs px-3 py-1.5 whitespace-nowrap">Execução</TabsTrigger>
                    <TabsTrigger value="equipe" className="text-xs px-3 py-1.5 whitespace-nowrap">Equipe</TabsTrigger>
                    <TabsTrigger value="fotos" className="text-xs px-3 py-1.5 whitespace-nowrap">Fotos</TabsTrigger>
                    <TabsTrigger value="contratacoes" className="text-xs px-3 py-1.5 whitespace-nowrap">Pagamentos</TabsTrigger>
                    <TabsTrigger value="materiais" className="text-xs px-3 py-1.5 whitespace-nowrap">Materiais</TabsTrigger>
                    <TabsTrigger value="faturamento" className="text-xs px-3 py-1.5 whitespace-nowrap">Faturamento</TabsTrigger>
                   <TabsTrigger value="adendos" className="text-xs px-3 py-1.5 whitespace-nowrap">Contrato / Adendos</TabsTrigger>
                   <TabsTrigger value="timeline" className="text-xs px-3 py-1.5 whitespace-nowrap">Histórico</TabsTrigger>

                  </TabsList>
                </div>
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
              <Tabs defaultValue="fotos" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="fotos">Fotos</TabsTrigger>
                  <TabsTrigger value="equipe">Equipe</TabsTrigger>
                  <TabsTrigger value="timeline">Histórico</TabsTrigger>
                </TabsList>
                <TabsContent value="fotos" className="mt-4"><FotosTab obraId={obra.id} /></TabsContent>
                <TabsContent value="equipe" className="mt-4"><EquipeTab obraId={obra.id} /></TabsContent>
                <TabsContent value="timeline" className="mt-4"><TimelineTab obraId={obra.id} /></TabsContent>
              </Tabs>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
