import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Modelo = {
  id?: string;
  nome: string;
  capa: string;
  texto_introducao: string;
  texto_condicoes: string;
  texto_rodape: string;
  mostra_bdi: boolean;
  padrao: boolean;
};

const VAZIO: Modelo = {
  nome: "", capa: "", texto_introducao: "", texto_condicoes: "",
  texto_rodape: "", mostra_bdi: false, padrao: false,
};

export function ModelosPropostaCard() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Modelo>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const { data: modelos } = useQuery({
    queryKey: [empresaId, "modelos-proposta"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("modelos_proposta").select("*").order("padrao", { ascending: false }).order("nome");
      return data ?? [];
    },
  });

  const abrirNovo = () => { setForm(VAZIO); setAberto(true); };
  const abrirEdicao = (m: Record<string, unknown>) => {
    setForm({
      id: m.id as string,
      nome: (m.nome as string) ?? "",
      capa: (m.capa as string) ?? "",
      texto_introducao: (m.texto_introducao as string) ?? "",
      texto_condicoes: (m.texto_condicoes as string) ?? "",
      texto_rodape: (m.texto_rodape as string) ?? "",
      mostra_bdi: !!m.mostra_bdi,
      padrao: !!m.padrao,
    });
    setAberto(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome do modelo"); return; }
    if (!empresaId) return;
    setSalvando(true);
    try {
      if (form.padrao) {
        await supabase.from("modelos_proposta").update({ padrao: false })
          .eq("empresa_id", empresaId).eq("padrao", true);
      }
      const payload = {
        empresa_id: empresaId,
        nome: form.nome.trim(),
        capa: form.capa || null,
        texto_introducao: form.texto_introducao || null,
        texto_condicoes: form.texto_condicoes || null,
        texto_rodape: form.texto_rodape || null,
        mostra_bdi: form.mostra_bdi,
        padrao: form.padrao,
      };
      const { error } = form.id
        ? await supabase.from("modelos_proposta").update(payload).eq("id", form.id)
        : await supabase.from("modelos_proposta").insert(payload);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: [empresaId, "modelos-proposta"] });
      setAberto(false);
      toast.success("Modelo salvo");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Excluir este modelo? As propostas já geradas continuam disponíveis.")) return;
    const { error } = await supabase.from("modelos_proposta").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [empresaId, "modelos-proposta"] });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Modelos de proposta</CardTitle>
        <Button size="sm" onClick={abrirNovo}><Plus className="mr-1 h-4 w-4" /> Novo modelo</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {(modelos?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum modelo ainda. O modelo define capa, textos e se o BDI aparece na proposta.
          </p>
        ) : (
          modelos!.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">
                  {m.nome} {m.padrao && <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">padrão</span>}
                </p>
                <p className="text-xs text-muted-foreground">{m.mostra_bdi ? "Mostra BDI" : "Sem BDI"}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => abrirEdicao(m as unknown as Record<string, unknown>)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => excluir(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar modelo" : "Novo modelo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Texto da capa</Label>
              <Textarea rows={2} value={form.capa} onChange={(e) => setForm({ ...form, capa: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Introdução</Label>
              <Textarea rows={3} value={form.texto_introducao} onChange={(e) => setForm({ ...form, texto_introducao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Condições</Label>
              <Textarea rows={3} value={form.texto_condicoes} onChange={(e) => setForm({ ...form, texto_condicoes: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Rodapé</Label>
              <Textarea rows={2} value={form.texto_rodape} onChange={(e) => setForm({ ...form, texto_rodape: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.mostra_bdi} onCheckedChange={(v) => setForm({ ...form, mostra_bdi: !!v })} />
              Mostrar o BDI na proposta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.padrao} onCheckedChange={(v) => setForm({ ...form, padrao: !!v })} />
              Usar como modelo padrão
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
