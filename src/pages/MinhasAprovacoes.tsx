import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/obra-helpers";
import { DOCUMENTOS_ALCADA } from "@/components/configuracoes/AlcadasCard";

const rotuloDoc = (d: string) => DOCUMENTOS_ALCADA.find((x) => x.valor === d)?.label ?? d;

export default function MinhasAprovacoes() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [reprovando, setReprovando] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [processando, setProcessando] = useState(false);

  const { data: aprovacoes, isLoading } = useQuery({
    queryKey: [empresaId, "aprovacoes"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("aprovacoes")
        .select("*, pessoas(nome), perfis_permissao(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const decidir = async (id: string, aprovado: boolean, texto?: string) => {
    setProcessando(true);
    const { error } = await supabase.rpc("decidir_aprovacao", {
      _aprovacao_id: id,
      _aprovado: aprovado,
      _justificativa: texto ?? null,
    });
    setProcessando(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [empresaId, "aprovacoes"] });
    setReprovando(null);
    setJustificativa("");
    toast.success(aprovado ? "Aprovado" : "Reprovado");
  };

  const lista = aprovacoes ?? [];
  const pendentes = lista.filter((a) => a.status === "pendente");
  const decididas = lista.filter((a) => a.status !== "pendente");

  const linha = (a: Record<string, unknown>, pendente: boolean) => {
    const p = a as unknown as {
      id: string; documento: string; descricao: string | null; valor: number;
      status: string; created_at: string; justificativa: string | null;
      decidido_em: string | null;
      pessoas?: { nome: string } | null; perfis_permissao?: { nome: string } | null;
    };
    return (
      <div key={p.id} className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{rotuloDoc(p.documento)}</span>
            <Badge variant={p.status === "aprovado" ? "default" : p.status === "reprovado" ? "destructive" : "secondary"}>
              {p.status}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{p.descricao ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(Number(p.valor))} · solicitado em {format(parseISO(p.created_at), "dd/MM/yyyy HH:mm")}
            {" · aprovador: "}{p.pessoas?.nome ?? p.perfis_permissao?.nome ?? "—"}
          </p>
          {p.justificativa && <p className="mt-1 text-xs text-destructive">Justificativa: {p.justificativa}</p>}
        </div>
        {pendente && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => decidir(p.id, true)} disabled={processando}>
              <Check className="mr-1 h-4 w-4" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setReprovando(p.id); setJustificativa(""); }}>
              <X className="mr-1 h-4 w-4" /> Reprovar
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Minhas aprovações</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Fila de aprovação</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <Tabs defaultValue="pendentes">
              <TabsList>
                <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
                <TabsTrigger value="decididas">Histórico ({decididas.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pendentes" className="space-y-2 pt-3">
                {pendentes.length === 0
                  ? <p className="py-6 text-center text-sm text-muted-foreground">Nada aguardando aprovação.</p>
                  : pendentes.map((a) => linha(a as unknown as Record<string, unknown>, true))}
              </TabsContent>
              <TabsContent value="decididas" className="space-y-2 pt-3">
                {decididas.length === 0
                  ? <p className="py-6 text-center text-sm text-muted-foreground">Sem histórico ainda.</p>
                  : decididas.map((a) => linha(a as unknown as Record<string, unknown>, false))}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reprovando} onOpenChange={(v) => !v && setReprovando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reprovar documento</DialogTitle>
            <DialogDescription>A justificativa é obrigatória e fica registrada no histórico.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Explique o motivo da reprovação" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReprovando(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={processando || !justificativa.trim()}
              onClick={() => reprovando && decidir(reprovando, false, justificativa.trim())}>
              Reprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
