import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/obra-helpers";
import { useObraConfig } from "@/hooks/useObraConfig";

type Linha = {
  obra_id: string;
  codigo_chamado: string;
  descricao: string | null;
  receita_orcada: number;
  custo_orcado: number;
  custo_realizado: number;
  pct_executado: number;
  pct_previsto: number | null;
  valor_agregado: number;
  valor_planejado: number;
  idc: number | null;
  idp: number | null;
  custo_previsto_fim: number;
  estouro_projetado: number;
  medido_acumulado: number;
  saldo_a_medir: number;
  comprometido: number;
  contas_a_vencer: number;
  margem_projetada: number | null;
  tem_linha_base: boolean;
};

const indice = (v: number | null) => (v == null ? "—" : v.toFixed(2).replace(".", ","));

function Semaforo({ valor }: { valor: number | null }) {
  if (valor == null) return <Badge variant="outline">sem base</Badge>;
  if (valor >= 1) return <Badge variant="secondary">{indice(valor)} · dentro</Badge>;
  if (valor >= 0.9) return <Badge variant="outline">{indice(valor)} · atenção</Badge>;
  return <Badge variant="destructive">{indice(valor)} · ruim</Badge>;
}

export default function Desempenho() {
  const { empresaId } = useAuth();
  const { rotulos } = useObraConfig();
  const obra = rotulos.obra_singular.toLowerCase();
  const obras = rotulos.obra_plural.toLowerCase();

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: [empresaId, "desempenho-obras"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_desempenho_obras", { _obra_id: null });
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
  });

  const total = useMemo(() => {
    const soma = (f: (l: Linha) => number) => linhas.reduce((s, l) => s + (Number(f(l)) || 0), 0);
    const receita = soma((l) => l.receita_orcada);
    const previstoFim = soma((l) => l.custo_previsto_fim);
    return {
      receita,
      comprometido: soma((l) => l.comprometido),
      saldoMedir: soma((l) => l.saldo_a_medir),
      aVencer: soma((l) => l.contas_a_vencer),
      margem: receita > 0 ? ((receita - previstoFim) / receita) * 100 : null,
      estourando: linhas.filter((l) => Number(l.estouro_projetado) > 0),
    };
  }, [linhas]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Desempenho de custo e prazo</h1>
        <p className="text-sm text-muted-foreground">
          Como cada {obra} está andando em dinheiro e em tempo, e a projeção de quanto vai custar no fim.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Margem projetada</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {total.margem == null ? "—" : `${total.margem.toFixed(1).replace(".", ",")}%`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Custo comprometido</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(total.comprometido)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Saldo a medir</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(total.saldoMedir)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Contas a vencer (30 dias)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(total.aVencer)}</CardContent>
        </Card>
        <Card className={total.estourando.length ? "border-destructive" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              {total.estourando.length > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
              {rotulos.obra_plural} com estouro
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{total.estourando.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Por {obra}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{rotulos.obra_singular}</TableHead>
                <TableHead className="text-right">Orçado (custo)</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Executado</TableHead>
                <TableHead>Índice de custo</TableHead>
                <TableHead>Índice de prazo</TableHead>
                <TableHead className="text-right">Previsto até o fim</TableHead>
                <TableHead className="text-right">Estouro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhuma {obra} em andamento.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((l) => (
                <TableRow key={l.obra_id}>
                  <TableCell>
                    <div className="font-medium">{l.codigo_chamado}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{l.descricao}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(l.custo_orcado))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(l.custo_realizado))}</TableCell>
                  <TableCell className="text-right">
                    {Number(l.pct_executado).toFixed(0)}%
                    {l.pct_previsto != null && (
                      <span className="block text-xs text-muted-foreground">
                        previsto {Number(l.pct_previsto).toFixed(0)}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell><Semaforo valor={l.idc} /></TableCell>
                  <TableCell><Semaforo valor={l.idp} /></TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(l.custo_previsto_fim))}</TableCell>
                  <TableCell className={`text-right ${Number(l.estouro_projetado) > 0 ? "text-destructive font-semibold" : ""}`}>
                    {Number(l.estouro_projetado) > 0 ? formatCurrency(Number(l.estouro_projetado)) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Como estas contas são feitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="exec">
              <AccordionTrigger>O que já foi entregue</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                É o quanto da {obra} já foi executado, em porcentagem. Quando existe medição aprovada, usamos o medido
                acumulado dividido pelo valor contratado. Sem medição, usamos o custo já gasto dividido pelo custo
                orçado. Multiplicando essa porcentagem pelo orçado, temos o <strong>valor do que foi entregue</strong>.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="idc">
              <AccordionTrigger>Índice de custo</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <strong>Valor do que foi entregue ÷ quanto já foi gasto.</strong> Acima de 1 você está gastando menos do
                que o previsto para o que já entregou. Abaixo de 1, está gastando mais. Exemplo: entregou R$ 100 mil de
                serviço e gastou R$ 125 mil, o índice é 0,80 — cada real entregue está custando R$ 1,25.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="idp">
              <AccordionTrigger>Índice de prazo</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <strong>Porcentagem executada ÷ porcentagem que deveria estar pronta hoje</strong>, segundo o
                cronograma. Acima de 1 está adiantado, abaixo de 1 está atrasado. Só aparece para {obras} com
                cronograma preenchido.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="eac">
              <AccordionTrigger>Previsto até o fim e estouro</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <strong>Custo orçado ÷ índice de custo.</strong> Se o ritmo de gasto continuar como está até aqui, é
                esse o custo final esperado. O estouro é a diferença entre esse número e o orçado. A margem projetada é
                o que sobra do contrato depois desse custo previsto.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="comp">
              <AccordionTrigger>Custo comprometido</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Dinheiro já assumido mas ainda não pago: ordens de compra emitidas ou recebidas em parte e parcelas de
                contas a pagar em aberto.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
