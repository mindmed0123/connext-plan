import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { OBRA_STATUS_LIST, OBRA_STATUS_LABEL, ORIGEM_LABEL, REGIAO_LABEL } from "@/lib/obra-helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
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
import { useUserRole } from "@/hooks/useUserRole";

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
                <span><strong className="text-foreground">Região:</strong> {REGIAO_LABEL[obra.regiao]}</span>
                <span><strong className="text-foreground">Engenheiro:</strong> {obra.engenheiro_responsavel}</span>
                <span><strong className="text-foreground">Recebido:</strong> {format(new Date(obra.data_recebimento), "dd/MM/yyyy")}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">Endereço:</strong> {obra.endereco}
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 pt-2">
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
