import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, FileText, Loader2, Plus, X } from "lucide-react";
import { RdoForm } from "@/components/diario/RdoForm";
import { CLIMA_LABEL, gerarRelatorioDiarioPDF, type RdoPDFItem } from "@/lib/rdo-pdf";
import { formatDateBR } from "@/lib/date";

type DiarioRow = {
  id: string;
  data_envio: string;
  clima_manha: string | null;
  clima_tarde: string | null;
  condicao_trabalho: string;
  efetivo: { funcao: string; quantidade: number }[] | null;
  equipamentos: { nome: string; quantidade: number }[] | null;
  atividades_executadas: string | null;
  ocorrencias: string | null;
  observacoes: string | null;
  status: string;
  responsavel_id: string | null;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const trintaDiasAtras = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export function DiarioTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const { config } = useEmpresaConfig();
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(trintaDiasAtras());
  const [ate, setAte] = useState(hoje());
  const [gerando, setGerando] = useState(false);

  const { data: diarios = [] } = useQuery({
    queryKey: [empresaId, "diarios", obraId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diario_obra")
        .select("*")
        .eq("obra_id", obraId)
        .order("data_envio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DiarioRow[];
    },
  });

  const aprovar = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aprovado" | "reprovado" }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("diario_obra")
        .update({ status, aprovado_por: u.user?.id ?? null, aprovado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Diário atualizado");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gerarPDF = async () => {
    setGerando(true);
    try {
      const { data: obra, error: obraErr } = await supabase
        .from("obras")
        .select("codigo_chamado, descricao_servico, endereco")
        .eq("id", obraId)
        .single();
      if (obraErr) throw obraErr;

      const periodo = diarios.filter((d) => d.data_envio >= de && d.data_envio <= ate);
      if (periodo.length === 0) {
        toast.error("Nenhum diário nesse período");
        return;
      }

      const { data: pessoas } = await supabase.from("pessoas").select("id, nome");
      const nomePorId = new Map((pessoas ?? []).map((p) => [p.id, p.nome as string]));

      const { data: fotos } = await supabase
        .from("fotos_obra")
        .select("diario_id, storage_path, imagem_url, observacao")
        .eq("obra_id", obraId)
        .in("diario_id", periodo.map((d) => d.id));

      const paths = (fotos ?? []).map((f) => f.storage_path).filter(Boolean) as string[];
      const urlMap = new Map<string, string>();
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from("obras-fotos").createSignedUrls(paths, 3600);
        (signed ?? []).forEach((s) => s.path && s.signedUrl && urlMap.set(s.path, s.signedUrl));
      }

      const itens: RdoPDFItem[] = periodo
        .slice()
        .sort((a, b) => a.data_envio.localeCompare(b.data_envio))
        .map((d) => ({
          ...d,
          efetivo: d.efetivo ?? [],
          equipamentos: d.equipamentos ?? [],
          responsavel_nome: d.responsavel_id ? nomePorId.get(d.responsavel_id) ?? null : null,
          fotos: (fotos ?? [])
            .filter((f) => f.diario_id === d.id)
            .map((f) => ({
              imagem_url: (f.storage_path && urlMap.get(f.storage_path)) || f.imagem_url,
              observacao: f.observacao,
            })),
        }));

      const { data: empresaRow } = await supabase
        .from("empresas")
        .select("nome, logo_url, cnpj, endereco, cidade, uf, telefone, email")
        .eq("id", empresaId!)
        .maybeSingle();
      const emp = (empresaRow ?? {}) as Record<string, string | null | undefined>;
      await gerarRelatorioDiarioPDF(
        {
          nome: emp.nome ?? "Empresa",
          logo_url: emp.logo_url ?? null,
          cnpj: emp.cnpj ?? null,
          endereco: emp.endereco ?? null,
          cidade: emp.cidade ?? null,
          uf: emp.uf ?? null,
          telefone: emp.telefone ?? null,
          email: emp.email ?? null,
          cor_primaria: config?.cor_primaria ?? null,
          texto_rodape: config?.texto_rodape ?? null,
        },
        obra,
        itens,
        { de, ate },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar o relatório");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Novo diário</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle>Diário de obra</DialogTitle></DialogHeader>
            <RdoForm obraId={obraId} onSalvo={() => setAberto(false)} />
          </DialogContent>
        </Dialog>

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-[150px]" />
          </div>
          <Button variant="outline" onClick={gerarPDF} disabled={gerando}>
            {gerando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
            Relatório em PDF
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {diarios.map((d) => (
          <Card key={d.id}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{formatDateBR(d.data_envio)}</span>
                <Badge variant={d.status === "aprovado" ? "default" : d.status === "reprovado" ? "destructive" : "secondary"}>
                  {d.status}
                </Badge>
                {d.condicao_trabalho === "impraticavel" && <Badge variant="outline">Dia impraticável</Badge>}
                <span className="text-sm text-muted-foreground">
                  Manhã: {CLIMA_LABEL[d.clima_manha ?? ""] ?? "—"} • Tarde: {CLIMA_LABEL[d.clima_tarde ?? ""] ?? "—"}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => aprovar.mutate({ id: d.id, status: "aprovado" })}>
                    <Check className="mr-1 h-4 w-4" /> Aprovar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => aprovar.mutate({ id: d.id, status: "reprovado" })}>
                    <X className="mr-1 h-4 w-4" /> Reprovar
                  </Button>
                </div>
              </div>
              {(d.efetivo ?? []).length > 0 && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Efetivo: </span>
                  {(d.efetivo ?? []).map((e) => `${e.quantidade}× ${e.funcao}`).join(", ")}
                </p>
              )}
              {d.atividades_executadas && <p className="text-sm whitespace-pre-wrap">{d.atividades_executadas}</p>}
              {d.ocorrencias && <p className="text-sm text-destructive whitespace-pre-wrap">{d.ocorrencias}</p>}
            </CardContent>
          </Card>
        ))}
        {diarios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum diário registrado nesta obra.</p>}
      </div>
    </div>
  );
}
