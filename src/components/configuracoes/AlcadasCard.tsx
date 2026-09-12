import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";

export const DOCUMENTOS_ALCADA = [
  { valor: "orcamento", label: "Orçamento" },
  { valor: "medicao", label: "Medição" },
  { valor: "solicitacao", label: "Solicitação de compra" },
  { valor: "ordem_compra", label: "Ordem de compra" },
  { valor: "pagamento", label: "Pagamento" },
] as const;

export function AlcadasCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({
    documento: "orcamento", valor_de: "0", valor_ate: "",
    aprovador: "", ordem: "1",
  });

  const { data: alcadas } = useQuery({
    queryKey: [empresaId, "alcadas"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("alcadas")
        .select("*, pessoas(nome), perfis_permissao(nome)")
        .order("documento").order("ordem");
      return data ?? [];
    },
  });

  const { data: pessoas } = useQuery({
    queryKey: [empresaId, "pessoas-alcada"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("pessoas").select("id, nome").eq("status", "ativo").order("nome");
      return data ?? [];
    },
  });

  const { data: perfis } = useQuery({
    queryKey: [empresaId, "perfis-alcada"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("perfis_permissao").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  const salvar = async () => {
    if (!empresaId) return;
    if (!form.aprovador) { toast.error("Escolha quem aprova"); return; }
    const [tipo, id] = form.aprovador.split(":");
    const { error } = await supabase.from("alcadas").insert({
      empresa_id: empresaId,
      documento: form.documento,
      valor_de: Number(form.valor_de) || 0,
      valor_ate: form.valor_ate === "" ? null : Number(form.valor_ate),
      pessoa_id: tipo === "pessoa" ? id : null,
      perfil_id: tipo === "perfil" ? id : null,
      ordem: Number(form.ordem) || 1,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [empresaId, "alcadas"] });
    setAberto(false);
    toast.success("Alçada criada");
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("alcadas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [empresaId, "alcadas"] });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Alçadas de aprovação</CardTitle>
        <Button size="sm" onClick={() => setAberto(true)}><Plus className="mr-1 h-4 w-4" /> Nova alçada</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Documentos acima do valor configurado ficam aguardando aprovação e aparecem em "Minhas aprovações".
        </p>
        {(alcadas?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alçada configurada.</p>
        ) : (
          alcadas!.map((a) => {
            const p = a as unknown as {
              id: string; documento: string; valor_de: number; valor_ate: number | null; ordem: number;
              pessoas?: { nome: string } | null; perfis_permissao?: { nome: string } | null;
            };
            return (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="text-sm">
                  <p className="font-medium">
                    {DOCUMENTOS_ALCADA.find((d) => d.valor === p.documento)?.label ?? p.documento}
                    {" — "}
                    {formatCurrency(Number(p.valor_de))}
                    {p.valor_ate == null ? " ou mais" : ` até ${formatCurrency(Number(p.valor_ate))}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Aprova: {p.pessoas?.nome ?? p.perfis_permissao?.nome ?? "—"} · ordem {p.ordem}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => excluir(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova alçada</DialogTitle>
            <DialogDescription>Faixa de valor que exige aprovação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Documento</Label>
              <Select value={form.documento} onValueChange={(v) => setForm({ ...form, documento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENTOS_ALCADA.map((d) => <SelectItem key={d.valor} value={d.valor}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">A partir de (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_de} onChange={(e) => setForm({ ...form, valor_de: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Até (R$) — vazio = sem limite</Label>
                <Input type="number" step="0.01" value={form.valor_ate} onChange={(e) => setForm({ ...form, valor_ate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Quem aprova</Label>
              <Select value={form.aprovador} onValueChange={(v) => setForm({ ...form, aprovador: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha uma pessoa ou um perfil" /></SelectTrigger>
                <SelectContent>
                  {(pessoas ?? []).map((p) => <SelectItem key={p.id} value={`pessoa:${p.id}`}>{p.nome}</SelectItem>)}
                  {(perfis ?? []).map((p) => <SelectItem key={p.id} value={`perfil:${p.id}`}>Perfil: {p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ordem</Label>
              <Input type="number" min={1} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
