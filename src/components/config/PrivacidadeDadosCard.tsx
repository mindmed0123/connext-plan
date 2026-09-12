import { useState } from "react";
import JSZip from "jszip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PRAZO_EXCLUSAO_DIAS } from "@/lib/legal";

// Tabelas exportadas no ZIP. A RLS já limita tudo à empresa do usuário.
const TABELAS = [
  "obras", "clientes", "compradores", "fornecedores", "pessoas", "contratos_clientes",
  "orcamentos", "orcamento_itens", "medicoes", "notas_fiscais", "recebimentos",
  "recebimento_pagamentos", "lancamentos_financeiros", "contas_pagar", "contas_pagar_parcelas",
  "contas_bancarias", "extrato_bancario", "cartoes_credito", "cartao_despesas",
  "materiais_obra", "contratacoes_terceirizado", "diario_obra", "fotos_obra",
] as const;

function paraCsv(linhas: Record<string, unknown>[]) {
  if (!linhas.length) return "";
  const colunas = Object.keys(linhas[0]);
  const escapar = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const texto = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(texto) ? `"${texto.split('"').join('""')}"` : texto;
  };
  return [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(";"))].join("\n");
}

export function PrivacidadeDadosCard() {
  const { empresaId, empresaNome, user } = useAuth();
  const qc = useQueryClient();
  const [exportando, setExportando] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: pedido } = useQuery({
    queryKey: [empresaId, "exclusao-solicitacao"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exclusao_solicitacoes")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function exportar() {
    if (!empresaId) return;
    setExportando(true);
    setResultado(null);
    try {
      const zip = new JSZip();
      const linhasResultado: LinhaExport[] = [];
      for (const tabela of TABELAS) {
        try {
          // Pagina até acabar: sem isso o banco devolve no máximo 1.000 linhas.
          const linhas = await fetchAllRows<Record<string, unknown>>((de, ate) =>
            supabase
              .from(tabela)
              .select("*")
              .eq("empresa_id", empresaId)
              .order("id")
              .range(de, ate),
          );
          zip.file(`${tabela}.csv`, paraCsv(linhas));
          linhasResultado.push({ tabela, total: linhas.length });
        } catch (e) {
          linhasResultado.push({
            tabela,
            total: 0,
            erro: e instanceof Error ? e.message : "falha ao ler",
          });
        }
      }
      setResultado(linhasResultado);
      const falhas = linhasResultado.filter((l) => l.erro);
      zip.file(
        "LEIA-ME.txt",
        [
          `Exportação de dados de ${empresaNome ?? "sua empresa"}`,
          `Gerada em ${new Date().toLocaleString("pt-BR")}`,
          "Arquivos CSV separados por ponto e vírgula.",
          "",
          "Linhas exportadas por arquivo:",
          ...linhasResultado.map((l) =>
            l.erro ? `- ${l.tabela}: FALHOU (${l.erro})` : `- ${l.tabela}: ${l.total}`,
          ),
          "",
          falhas.length
            ? `ATENÇÃO: ${falhas.length} arquivo(s) não puderam ser lidos. A cópia está incompleta.`
            : "Todos os arquivos foram lidos por completo.",
        ].join("\n"),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível exportar agora.");
    } finally {
      setExportando(false);
    }
  }

  async function solicitarExclusao() {
    if (confirmacao.trim().toUpperCase() !== "EXCLUIR") {
      toast.error('Digite EXCLUIR para confirmar.');
      return;
    }
    setEnviando(true);
    try {
      const { error } = await supabase.from("exclusao_solicitacoes").insert({
        confirmacao: confirmacao.trim().toUpperCase(),
        motivo: motivo.trim() || null,
        solicitado_por: user!.id,
        solicitado_por_email: user!.email ?? null,
      });
      if (error) throw error;
      setConfirmacao("");
      setMotivo("");
      qc.invalidateQueries({ queryKey: [empresaId, "exclusao-solicitacao"] });
      toast.success("Pedido registrado. Entraremos em contato antes de concluir.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Privacidade e dados</CardTitle>
        <CardDescription>
          Baixe uma cópia de tudo o que está no sistema ou peça o encerramento da conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={exportar} disabled={exportando} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {exportando ? "Preparando..." : "Exportar dados da empresa"}
          </Button>
          <span className="text-sm text-muted-foreground">Arquivo ZIP com planilhas CSV.</span>
        </div>

        <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-sm font-medium">Excluir a conta</span>
          </div>

          {pedido ? (
            <Alert>
              <AlertDescription>
                Pedido registrado em {new Date(pedido.created_at).toLocaleDateString("pt-BR")}. A
                exclusão será concluída até {new Date(pedido.prazo_em).toLocaleDateString("pt-BR")}.
                Fale com o suporte para cancelar.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Apaga os dados da empresa em até {PRAZO_EXCLUSAO_DIAS} dias, respeitando prazos
                fiscais. Exporte antes: a ação não pode ser desfeita.
              </p>
              <div className="space-y-2">
                <Label htmlFor="motivo-exclusao">Motivo (opcional)</Label>
                <Textarea id="motivo-exclusao" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmacao-exclusao">Digite EXCLUIR para confirmar</Label>
                <Input
                  id="confirmacao-exclusao"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  placeholder="EXCLUIR"
                />
              </div>
              <Button variant="destructive" onClick={solicitarExclusao} disabled={enviando}>
                Solicitar exclusão da conta
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
