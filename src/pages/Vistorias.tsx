import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/date";

export default function Vistorias() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any | null>(null);

  const { data } = useQuery({
    queryKey: ["all-vistorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vistorias")
        .select("*, obras(codigo_chamado, regiao)")
        .order("data_vistoria", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { id, obras, ...payload } = edit;
      const { error } = await supabase.from("vistorias").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Vistoria atualizada"); qc.invalidateQueries({ queryKey: ["all-vistorias"] }); setEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vistorias").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Vistoria excluída"); qc.invalidateQueries({ queryKey: ["all-vistorias"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Vistorias</h1>
        <p className="text-sm text-muted-foreground">Todas as vistorias registradas</p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chamado</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem vistorias registradas</TableCell></TableRow>
            )}
            {data?.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.obras?.codigo_chamado}</TableCell>
                <TableCell>{formatDateBR(v.data_vistoria)}</TableCell>
                <TableCell>{v.responsavel_vistoria}</TableCell>
                <TableCell><span className="text-xs">{v.status}</span></TableCell>
                <TableCell className="max-w-md truncate text-xs text-muted-foreground">{v.observacoes}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEdit({ ...v })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Excluir vistoria?") && excluir.mutate(v.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar vistoria</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={edit.data_vistoria ?? ""} onChange={(e) => setEdit({ ...edit, data_vistoria: e.target.value })} /></div>
              <div><Label>Status</Label><Input value={edit.status ?? ""} onChange={(e) => setEdit({ ...edit, status: e.target.value })} /></div>
              <div className="col-span-2"><Label>Responsável</Label><Input value={edit.responsavel_vistoria ?? ""} onChange={(e) => setEdit({ ...edit, responsavel_vistoria: e.target.value })} /></div>
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
