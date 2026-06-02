import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date";

const STATUS_LABEL: Record<string, string> = {
  nao_iniciada: "Não iniciada", em_execucao: "Em execução", pausada: "Pausada", finalizada: "Finalizada",
};

export default function Execucoes() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);

  const { data } = useQuery({
    queryKey: ["all-execucoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execucoes")
        .select("*, obras(codigo_chamado)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { id, obras, ...payload } = edit;
      payload.prazo_estimado = payload.prazo_estimado === "" || payload.prazo_estimado == null ? null : Number(payload.prazo_estimado);
      payload.valor_terceirizado = Number(payload.valor_terceirizado) || 0;
      const { error } = await supabase.from("execucoes").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Execução atualizada"); qc.invalidateQueries({ queryKey: ["all-execucoes"] }); setEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("execucoes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Execução excluída"); qc.invalidateQueries({ queryKey: ["all-execucoes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Execuções</h1>
        <p className="text-sm text-muted-foreground">Equipes em campo e prazos</p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sem execuções</TableCell></TableRow>
            )}
            {data?.map((x: any) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.obras?.codigo_chamado}</TableCell>
                <TableCell className="text-xs">{x.tipo_execucao === "terceirizado" ? `Terc.: ${x.nome_terceirizado}` : "Equipe própria"}</TableCell>
                <TableCell>{x.responsavel_obra}</TableCell>
                <TableCell>{formatDateBR(x.data_inicio)}</TableCell>
                <TableCell>{x.prazo_estimado ? `${x.prazo_estimado} d` : "—"}</TableCell>
                <TableCell className="text-xs">{STATUS_LABEL[x.status] || x.status}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEdit({ ...x })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Excluir execução?") && excluir.mutate(x.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar execução</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Responsável da obra</Label><Input value={edit.responsavel_obra ?? ""} onChange={(e) => setEdit({ ...edit, responsavel_obra: e.target.value })} /></div>
              <div><Label>Data início</Label><Input type="date" value={edit.data_inicio ?? ""} onChange={(e) => setEdit({ ...edit, data_inicio: e.target.value || null })} /></div>
              <div><Label>Prazo (dias)</Label><Input type="number" value={edit.prazo_estimado ?? ""} onChange={(e) => setEdit({ ...edit, prazo_estimado: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {edit.tipo_execucao === "terceirizado" && (
                <>
                  <div className="col-span-2"><Label>Nome terceirizado</Label><Input value={edit.nome_terceirizado ?? ""} onChange={(e) => setEdit({ ...edit, nome_terceirizado: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Valor terceirizado</Label><Input type="number" step="0.01" value={edit.valor_terceirizado ?? 0} onChange={(e) => setEdit({ ...edit, valor_terceirizado: e.target.value })} /></div>
                </>
              )}
              <div className="col-span-2"><Label>Observações</Label><Textarea value={edit.observacoes ?? ""} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
