import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Info } from "lucide-react";
import { toast } from "sonner";

type Uso = "orcamento" | "cotacao" | "diario";

function MarcaRascunho() {
  return (
    <Badge variant="secondary" className="gap-1">
      <Sparkles className="h-3 w-3" /> rascunho gerado por IA
    </Badge>
  );
}

export default function Ia() {
  const { empresaId } = useAuth();
  const { config } = useEmpresaConfig();
  const flags = config as unknown as Record<string, boolean>;

  const [carregando, setCarregando] = useState<Uso | null>(null);
  const [saida, setSaida] = useState<Record<Uso, string>>({ orcamento: "", cotacao: "", diario: "" });

  const [orc, setOrc] = useState({ tipo_obra: "", padrao: "normal", area_m2: "", descricao: "" });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [rel, setRel] = useState({ obra_id: "", inicio: "", fim: "" });

  const { data: obras = [] } = useQuery({
    queryKey: [empresaId, "obras", "ia"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras").select("id, codigo_chamado, descricao_servico")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as { id: string; codigo_chamado: string; descricao_servico: string }[];
    },
  });

  const chamar = async (uso: Uso, corpo: Record<string, unknown>) => {
    setCarregando(uso);
    try {
      const { data, error } = await supabase.functions.invoke("ia-assistente", { body: { uso, ...corpo } });
      if (error) throw error;
      const r = data as { resultado?: string; error?: string };
      if (r.error) throw new Error(r.error);
      setSaida((s) => ({ ...s, [uso]: r.resultado ?? "" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui concluir o pedido.");
    } finally {
      setCarregando(null);
    }
  };

  const enviarCotacao = async () => {
    if (!arquivo) return toast.error("Escolha o PDF ou a foto da cotação.");
    const base64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
      fr.onerror = () => rej(new Error("Não consegui ler o arquivo."));
      fr.readAsDataURL(arquivo);
    });
    await chamar("cotacao", { arquivo_base64: base64, mime: arquivo.type });
  };

  const desligado = (titulo: string) => (
    <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
      {titulo} está desligado. Ligue em Configurações → Inteligência artificial.
    </CardContent></Card>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Inteligência artificial</h1>
        <p className="text-sm text-muted-foreground">
          Três ajudas pontuais. Tudo que sai daqui é rascunho e precisa da sua conferência antes de virar documento.
        </p>
      </header>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Enviamos apenas o conteúdo do documento ou do período que você escolher. Nenhum dado de outra empresa é
          usado, e cada pedido fica registrado no histórico da sua empresa.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="orcamento">
        <TabsList>
          <TabsTrigger value="orcamento">Estimativa de orçamento</TabsTrigger>
          <TabsTrigger value="cotacao">Ler cotação</TabsTrigger>
          <TabsTrigger value="diario">Relatório do período</TabsTrigger>
        </TabsList>

        <TabsContent value="orcamento" className="mt-4">
          {!flags.ia_orcamento ? desligado("O assistente de orçamento") : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estimativa a partir da área</CardTitle>
                <CardDescription>Usa os custos por m² que você cadastrou. É ponto de partida, não orçamento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1"><Label>Tipo de obra</Label>
                    <Input value={orc.tipo_obra} onChange={(e) => setOrc({ ...orc, tipo_obra: e.target.value })} placeholder="Residencial, galpão…" /></div>
                  <div className="space-y-1"><Label>Padrão</Label>
                    <Select value={orc.padrao} onValueChange={(v) => setOrc({ ...orc, padrao: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples">Simples</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alto">Alto</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-1"><Label>Área (m²)</Label>
                    <Input value={orc.area_m2} onChange={(e) => setOrc({ ...orc, area_m2: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>O que será feito</Label>
                  <Textarea rows={3} value={orc.descricao} onChange={(e) => setOrc({ ...orc, descricao: e.target.value })} /></div>
                <Button
                  disabled={carregando === "orcamento"}
                  onClick={() => void chamar("orcamento", {
                    tipo_obra: orc.tipo_obra || null, padrao: orc.padrao,
                    area_m2: Number(orc.area_m2.replace(",", ".")) || null, descricao: orc.descricao || null,
                  })}
                >
                  {carregando === "orcamento" ? "Calculando…" : "Gerar estimativa"}
                </Button>
                {saida.orcamento && (
                  <div className="space-y-2 rounded-md border p-3">
                    <MarcaRascunho />
                    <pre className="whitespace-pre-wrap text-sm">{saida.orcamento}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cotacao" className="mt-4">
          {!flags.ia_cotacao ? desligado("A leitura de cotação") : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ler cotação do fornecedor</CardTitle>
                <CardDescription>PDF ou foto. Os itens saem separados para você conferir antes de lançar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input type="file" accept="application/pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
                <Button disabled={carregando === "cotacao"} onClick={() => void enviarCotacao()}>
                  {carregando === "cotacao" ? "Lendo…" : "Ler cotação"}
                </Button>
                {saida.cotacao && (
                  <div className="space-y-2 rounded-md border p-3">
                    <MarcaRascunho />
                    <pre className="whitespace-pre-wrap text-sm">{saida.cotacao}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="diario" className="mt-4">
          {!flags.ia_diario ? desligado("O relatório do período") : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Relatório a partir do diário</CardTitle>
                <CardDescription>Junta os diários do período em um texto pronto para revisar e enviar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-1"><Label>Obra</Label>
                    <Select value={rel.obra_id} onValueChange={(v) => setRel({ ...rel, obra_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                      <SelectContent>
                        {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.codigo_chamado} · {o.descricao_servico}</SelectItem>)}
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-1"><Label>De</Label>
                    <Input type="date" value={rel.inicio} onChange={(e) => setRel({ ...rel, inicio: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Até</Label>
                    <Input type="date" value={rel.fim} onChange={(e) => setRel({ ...rel, fim: e.target.value })} /></div>
                </div>
                <Button
                  disabled={carregando === "diario" || !rel.obra_id || !rel.inicio || !rel.fim}
                  onClick={() => void chamar("diario", rel)}
                >
                  {carregando === "diario" ? "Escrevendo…" : "Gerar relatório"}
                </Button>
                {saida.diario && (
                  <div className="space-y-2 rounded-md border p-3">
                    <MarcaRascunho />
                    <pre className="whitespace-pre-wrap text-sm">{saida.diario}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
