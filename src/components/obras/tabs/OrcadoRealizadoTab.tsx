import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Download, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useEtapas } from "@/hooks/useEtapas";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const TODAS = "__all__";

type Linha = {
  etapa_id: string | null;
  etapa_nome: string | null;
  item_id: string | null;
  item_descricao: string | null;
  quantidade_orcada: number;
  valor_orcado: number;
  comprometido: number;
  realizado: number;
  saldo: number;
  pct_consumido: number;
};

export function OrcadoRealizadoTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState<string>(TODAS);
  const [novaEtapa, setNovaEtapa] = useState("");

  const { data: etapas = [] } = useEtapas(obraId);

  const { data: linhas = [] } = useQuery({
    queryKey: [empresaId, "orcado-realizado", obraId, inicio, fim],
    enabled: !!empresaId && !!obraId,
    queryFn: async (): Promise<Linha[]> => {
      const { data, error } = await supabase.rpc("get_orcado_realizado", {
        _obra_id: obraId,
        _inicio: inicio || undefined,
        _fim: fim || undefined,
      });
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const { data: curvaS = [] } = useQuery({
    queryKey: [empresaId, "curva-s", obraId],
    enabled: !!empresaId && !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_curva_s", { _obra_id: obraId });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: abc = [] } = useQuery({
    queryKey: [empresaId, "curva-abc", obraId, inicio, fim],
    enabled: !!empresaId && !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_curva_abc", {
        _obra_id: obraId,
        _inicio: inicio || undefined,
        _fim: fim || undefined,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cronograma = [] } = useQuery({
    queryKey: [empresaId, "cronograma-etapas", obraId],
    enabled: !!empresaId && !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_etapas")
        .select("id, etapa_id, mes, valor_previsto, percentual_previsto")
        .eq("obra_id", obraId)
        .order("mes");
      if (error) throw error;
      return data ?? [];
    },
  });

  const criarEtapa = useMutation({
    mutationFn: async () => {
      const nome = novaEtapa.trim();
      if (!nome) throw new Error("Informe o nome da etapa");
      const { error } = await supabase.from("obra_etapas").insert([{ obra_id: obraId, nome, ordem: etapas.length + 1 }]);
      if (error) throw error;
    },
    onSuccess: () => {
      setNovaEtapa("");
      toast.success("Etapa criada");
      qc.invalidateQueries({ queryKey: [empresaId, "obra-etapas", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerEtapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa removida");
      qc.invalidateQueries({ queryKey: [empresaId, "obra-etapas", obraId] });
      qc.invalidateQueries({ queryKey: [empresaId, "orcado-realizado", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarCronograma = useMutation({
    mutationFn: async (v: { etapa_id: string | null; mes: string; valor: number }) => {
      const existente = cronograma.find((c) => (c.etapa_id ?? null) === v.etapa_id && c.mes === v.mes);
      if (existente) {
        const { error } = await supabase
          .from("cronograma_etapas")
          .update({ valor_previsto: v.valor })
          .eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cronograma_etapas")
          .insert([{ obra_id: obraId, etapa_id: v.etapa_id, mes: v.mes, valor_previsto: v.valor }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cronograma atualizado");
      qc.invalidateQueries({ queryKey: [empresaId, "cronograma-etapas", obraId] });
      qc.invalidateQueries({ queryKey: [empresaId, "curva-s", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtradas = useMemo(
    () => (filtroEtapa === TODAS ? linhas : linhas.filter((l) => (l.etapa_id ?? "sem") === filtroEtapa)),
    [linhas, filtroEtapa],
  );

  const totais = useMemo(
    () =>
      filtradas.reduce(
        (a, l) => ({
          orcado: a.orcado + Number(l.valor_orcado || 0),
          comprometido: a.comprometido + Number(l.comprometido || 0),
          realizado: a.realizado + Number(l.realizado || 0),
          saldo: a.saldo + Number(l.saldo || 0),
        }),
        { orcado: 0, comprometido: 0, realizado: 0, saldo: 0 },
      ),
    [filtradas],
  );

  const exportarCsv = () => {
    const linhasCsv = [
      ["Etapa", "Item", "Qtd orçada", "Orçado", "Comprometido", "Realizado", "Saldo", "% consumido"],
      ...filtradas.map((l) => [
        l.etapa_nome ?? "Sem etapa",
        l.item_descricao ?? "",
        String(l.quantidade_orcada ?? 0),
        String(l.valor_orcado ?? 0),
        String(l.comprometido ?? 0),
        String(l.realizado ?? 0),
        String(l.saldo ?? 0),
        String(l.pct_consumido ?? 0),
      ]),
      ["TOTAL", "", "", String(totais.orcado), String(totais.comprometido), String(totais.realizado), String(totais.saldo), ""],
    ];
    const csv = linhasCsv.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "orcado-realizado.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Orçado × Realizado", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Etapa", "Item", "Orçado", "Comprometido", "Realizado", "Saldo", "% consumido"]],
      body: filtradas.map((l) => [
        l.etapa_nome ?? "Sem etapa",
        l.item_descricao ?? "",
        formatCurrency(Number(l.valor_orcado || 0)),
        formatCurrency(Number(l.comprometido || 0)),
        formatCurrency(Number(l.realizado || 0)),
        formatCurrency(Number(l.saldo || 0)),
        `${Number(l.pct_consumido || 0).toFixed(1)}%`,
      ]),
      foot: [[
        "TOTAL",
        "",
        formatCurrency(totais.orcado),
        formatCurrency(totais.comprometido),
        formatCurrency(totais.realizado),
        formatCurrency(totais.saldo),
        "",
      ]],
      styles: { fontSize: 8 },
    });
    doc.save("orcado-realizado.pdf");
  };

  return (
    <Tabs defaultValue="comparativo" className="space-y-4">
      <TabsList>
        <TabsTrigger value="comparativo">Orçado × Realizado</TabsTrigger>
        <TabsTrigger value="cronograma">Cronograma / Curva S</TabsTrigger>
        <TabsTrigger value="abc">Curva ABC</TabsTrigger>
        <TabsTrigger value="etapas">Etapas</TabsTrigger>
      </TabsList>

      <TabsContent value="comparativo" className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
            <div className="min-w-48">
              <Label className="text-xs">Etapa</Label>
              <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas</SelectItem>
                  <SelectItem value="sem">Sem etapa</SelectItem>
                  {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={exportarCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
              <Button variant="outline" size="sm" onClick={exportarPdf}><FileText className="mr-1 h-4 w-4" />PDF</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa / Item</TableHead>
                  <TableHead className="text-right">Qtd orçada</TableHead>
                  <TableHead className="text-right">Orçado</TableHead>
                  <TableHead className="text-right">Comprometido</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">% consumido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((l, i) => {
                  const estourou = Number(l.saldo) < 0;
                  return (
                    <TableRow key={`${l.etapa_id}-${l.item_id}-${i}`} className={estourou ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <div className="font-medium">{l.etapa_nome ?? "Sem etapa"}</div>
                        {l.item_descricao && <div className="text-xs text-muted-foreground">{l.item_descricao}</div>}
                      </TableCell>
                      <TableCell className="text-right">{Number(l.quantidade_orcada || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(l.valor_orcado || 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(l.comprometido || 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(l.realizado || 0))}</TableCell>
                      <TableCell className={`text-right ${estourou ? "font-semibold text-destructive" : ""}`}>
                        {formatCurrency(Number(l.saldo || 0))}
                      </TableCell>
                      <TableCell className={`text-right ${Number(l.pct_consumido) > 100 ? "font-semibold text-destructive" : ""}`}>
                        {Number(l.pct_consumido || 0).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtradas.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sem dados no período</TableCell></TableRow>
                )}
              </TableBody>
              {filtradas.length > 0 && (
                <tfoot>
                  <TableRow className="font-semibold">
                    <TableCell>Total geral</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{formatCurrency(totais.orcado)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totais.comprometido)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totais.realizado)}</TableCell>
                    <TableCell className={`text-right ${totais.saldo < 0 ? "text-destructive" : ""}`}>{formatCurrency(totais.saldo)}</TableCell>
                    <TableCell />
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="cronograma" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuir previsto por mês</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <CronogramaForm
              etapas={etapas.map((e) => ({ id: e.id, nome: e.nome }))}
              onSalvar={(v) => salvarCronograma.mutate(v)}
              salvando={salvarCronograma.isPending}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Previsto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cronograma.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.mes}</TableCell>
                    <TableCell>{etapas.find((e) => e.id === c.etapa_id)?.nome ?? "Geral"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(c.valor_previsto || 0))}</TableCell>
                  </TableRow>
                ))}
                {cronograma.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Nenhum mês cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Curva S — previsto × realizado (acumulado)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curvaS}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="previsto_acum" name="Previsto" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="realizado_acum" name="Realizado" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="abc">
        <Card>
          <CardHeader><CardTitle className="text-base">Curva ABC de custos</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">% acum.</TableHead>
                  <TableHead>Classe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abc.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.descricao}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(r.valor || 0))}</TableCell>
                    <TableCell className="text-right">{Number(r.pct || 0).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{Number(r.pct_acumulado || 0).toFixed(1)}%</TableCell>
                    <TableCell><Badge variant={r.classe === "A" ? "default" : r.classe === "B" ? "secondary" : "outline"}>{r.classe}</Badge></TableCell>
                  </TableRow>
                ))}
                {abc.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Sem custos no período</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="etapas">
        <Card>
          <CardHeader><CardTitle className="text-base">Etapas da obra</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Nova etapa (ex.: Fundação)" value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)} />
              <Button size="sm" onClick={() => criarEtapa.mutate()} disabled={criarEtapa.isPending}>
                <Plus className="mr-1 h-4 w-4" />Adicionar
              </Button>
            </div>
            <div className="divide-y rounded-md border">
              {etapas.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{e.nome}</span>
                  <Button variant="ghost" size="icon" onClick={() => removerEtapa.mutate(e.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {etapas.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma etapa cadastrada</p>}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function CronogramaForm({
  etapas,
  onSalvar,
  salvando,
}: {
  etapas: { id: string; nome: string }[];
  onSalvar: (v: { etapa_id: string | null; mes: string; valor: number }) => void;
  salvando: boolean;
}) {
  const [etapaId, setEtapaId] = useState<string>("geral");
  const [mes, setMes] = useState("");
  const [valor, setValor] = useState("");

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48">
        <Label className="text-xs">Etapa</Label>
        <Select value={etapaId} onValueChange={setEtapaId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="geral">Geral (sem etapa)</SelectItem>
            {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Mês</Label>
        <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Valor previsto</Label>
        <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={!mes || !valor || salvando}
        onClick={() => onSalvar({ etapa_id: etapaId === "geral" ? null : etapaId, mes: `${mes}-01`, valor: parseFloat(valor) || 0 })}
      >
        Salvar mês
      </Button>
    </div>
  );
}
