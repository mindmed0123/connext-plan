import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Link2, Undo2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";
import { useContasBancarias, useSaldosContas } from "@/hooks/useContasBancarias";
import { parseOFX, parseCSVExtrato, hashLinha, type LinhaExtrato } from "@/lib/ofx";

const emptyConta = { nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", saldo_inicial: "0", data_saldo_inicial: getTodayDateInputValue() };

function diffDias(a: string, b: string) {
  return Math.abs((new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 864e5);
}

export default function Bancos() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { contas } = useContasBancarias();
  const { data: saldos = [] } = useSaldosContas();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(emptyConta);
  const [contaSel, setContaSel] = useState<string>("");

  const contaAtual = contaSel || contas[0]?.id || "";

  const { data: extrato = [] } = useQuery({
    queryKey: [empresaId, "extrato", contaAtual],
    enabled: !!empresaId && !!contaAtual,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extrato_bancario")
        .select("*")
        .eq("conta_id", contaAtual)
        .order("data", { ascending: false })
        .order("id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: [empresaId, "lancamentos-conciliacao", contaAtual],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_financeiros")
        .select("id, descricao, valor, tipo, status, data_realizado, data_competencia, conta_bancaria_id")
        .eq("status", "realizado")
        .order("data_realizado", { ascending: false })
        .order("id")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const conciliadosIds = useMemo(
    () => new Set((extrato as any[]).filter((e) => e.lancamento_id).map((e) => e.lancamento_id)),
    [extrato],
  );
  const lancLivres = useMemo(
    () => (lancamentos as any[]).filter((l) => !conciliadosIds.has(l.id)),
    [lancamentos, conciliadosIds],
  );

  const sugestao = (linha: any) =>
    lancLivres.find((l) => {
      const valor = l.tipo === "receita" ? Number(l.valor) : -Number(l.valor);
      const dataL = l.data_realizado ?? l.data_competencia;
      return Math.abs(valor - Number(linha.valor)) < 0.01 && diffDias(dataL, linha.data) <= 3;
    });

  const saveConta = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome da conta");
      const { error } = await supabase.from("contas_bancarias").insert([{
        nome: form.nome.trim(), banco: form.banco || null, agencia: form.agencia || null,
        conta: form.conta || null, tipo: form.tipo,
        saldo_inicial: parseFloat(form.saldo_inicial) || 0,
        data_saldo_inicial: form.data_saldo_inicial || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta criada");
      setForm(emptyConta); setDialog(false);
      qc.invalidateQueries({ queryKey: [empresaId, "contas-bancarias"] });
      qc.invalidateQueries({ queryKey: [empresaId, "saldos-contas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importar = useMutation({
    mutationFn: async (file: File) => {
      if (!contaAtual) throw new Error("Selecione uma conta bancária");
      const texto = await file.text();
      const linhas: LinhaExtrato[] = /OFX|STMTTRN/i.test(texto) ? parseOFX(texto) : parseCSVExtrato(texto);
      if (!linhas.length) throw new Error("Nenhum movimento encontrado no arquivo");
      const payload = linhas.map((l) => ({
        conta_id: contaAtual, data: l.data, descricao: l.descricao,
        valor: l.valor, documento: l.documento, hash_unico: hashLinha(l),
      }));
      const { error, count } = await supabase
        .from("extrato_bancario")
        .upsert(payload, { onConflict: "empresa_id,conta_id,hash_unico", ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      return { total: linhas.length, novos: count ?? 0 };
    },
    onSuccess: (r) => {
      toast.success(`${r.novos} novo(s) movimento(s) de ${r.total} lido(s)`);
      qc.invalidateQueries({ queryKey: [empresaId, "extrato", contaAtual] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const conciliar = useMutation({
    mutationFn: async ({ linhaId, lancId }: { linhaId: string; lancId: string }) => {
      const { error } = await supabase
        .from("extrato_bancario")
        .update({ lancamento_id: lancId, conciliado: true })
        .eq("id", linhaId);
      if (error) throw error;
      await supabase.from("lancamentos_financeiros").update({ conta_bancaria_id: contaAtual }).eq("id", lancId);
    },
    onSuccess: () => {
      toast.success("Movimento conciliado");
      qc.invalidateQueries({ queryKey: [empresaId, "extrato", contaAtual] });
      qc.invalidateQueries({ queryKey: [empresaId, "saldos-contas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desfazer = useMutation({
    mutationFn: async (linhaId: string) => {
      const { error } = await supabase
        .from("extrato_bancario")
        .update({ lancamento_id: null, conciliado: false })
        .eq("id", linhaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conciliação desfeita");
      qc.invalidateQueries({ queryKey: [empresaId, "extrato", contaAtual] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarLancamento = useMutation({
    mutationFn: async (linha: any) => {
      const receita = Number(linha.valor) >= 0;
      const { data, error } = await supabase.from("lancamentos_financeiros").insert([{
        tipo: receita ? "receita" : "despesa",
        status: "realizado",
        descricao: linha.descricao,
        valor: Math.abs(Number(linha.valor)),
        data_competencia: linha.data,
        data_realizado: linha.data,
        conta_bancaria_id: contaAtual,
        empresa_id: empresaId!,
      }]).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("extrato_bancario")
        .update({ lancamento_id: data.id, conciliado: true })
        .eq("id", linha.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Lançamento criado e conciliado");
      qc.invalidateQueries({ queryKey: [empresaId, "extrato", contaAtual] });
      qc.invalidateQueries({ queryKey: [empresaId, "lancamentos-conciliacao", contaAtual] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const consolidado = (saldos as any[]).reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bancos</h1>
          <p className="text-sm text-muted-foreground">Contas, saldos e conciliação do extrato com o razão.</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="mr-2 h-4 w-4" /> Nova conta</Button>
      </div>

      <Tabs defaultValue="contas">
        <TabsList>
          <TabsTrigger value="contas">Contas e saldos</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo consolidado</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{formatCurrency(consolidado)}</CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(saldos as any[]).map((c) => (
              <Card key={c.conta_id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">{c.banco ?? "—"}</p>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="text-2xl font-bold">{formatCurrency(Number(c.saldo_atual))}</div>
                  <p className="text-muted-foreground">Inicial {formatCurrency(Number(c.saldo_inicial))} · Movimento {formatCurrency(Number(c.movimento))}</p>
                  {Number(c.nao_conciliado) > 0 && (
                    <Badge variant="destructive">Não conciliado: {formatCurrency(Number(c.nao_conciliado))}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
            {saldos.length === 0 && <p className="text-muted-foreground">Nenhuma conta cadastrada ainda.</p>}
          </div>
        </TabsContent>

        <TabsContent value="conciliacao" className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Conta</Label>
              <Select value={contaAtual} onValueChange={setContaSel}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="inline-flex">
              <Button asChild variant="outline"><span><Upload className="mr-2 h-4 w-4" /> Importar OFX/CSV</span></Button>
              <input type="file" accept=".ofx,.csv,.txt" className="hidden"
                onChange={(e) => e.target.files?.[0] && importar.mutate(e.target.files[0])} />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Extrato do banco</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(extrato as any[]).length === 0 && <p className="text-sm text-muted-foreground">Importe um arquivo do banco para começar.</p>}
                {(extrato as any[]).map((l) => {
                  const sug = l.conciliado ? null : sugestao(l);
                  return (
                    <div key={l.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{l.descricao}</p>
                          <p className="text-xs text-muted-foreground">{formatDateBR(l.data)} {l.documento ? `· ${l.documento}` : ""}</p>
                        </div>
                        <span className={Number(l.valor) >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-destructive"}>
                          {formatCurrency(Number(l.valor))}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {l.conciliado ? (
                          <>
                            <Badge variant="secondary">Conciliado</Badge>
                            <Button size="sm" variant="ghost" onClick={() => desfazer.mutate(l.id)}>
                              <Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer
                            </Button>
                          </>
                        ) : sug ? (
                          <>
                            <Badge variant="outline" className="max-w-[220px] truncate">Sugestão: {sug.descricao}</Badge>
                            <Button size="sm" onClick={() => conciliar.mutate({ linhaId: l.id, lancId: sug.id })}>
                              <Link2 className="mr-1 h-3.5 w-3.5" /> Conciliar
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => criarLancamento.mutate(l)}>
                            <PlusCircle className="mr-1 h-3.5 w-3.5" /> Criar lançamento
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Lançamentos sem conciliação</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {lancLivres.length === 0 && <p className="text-sm text-muted-foreground">Tudo conciliado.</p>}
                {lancLivres.slice(0, 100).map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.descricao}</p>
                      <p className="text-xs text-muted-foreground">{formatDateBR(l.data_realizado ?? l.data_competencia)}</p>
                    </div>
                    <span className={l.tipo === "receita" ? "font-semibold text-emerald-600" : "font-semibold text-destructive"}>
                      {formatCurrency(Number(l.valor))}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova conta bancária</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1"><Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Banco</Label>
                <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></div>
              <div className="space-y-1"><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Agência</Label>
                <Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></div>
              <div className="space-y-1"><Label>Conta</Label>
                <Input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} /></div>
              <div className="space-y-1"><Label>Saldo inicial</Label>
                <Input type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} /></div>
              <div className="space-y-1"><Label>Data do saldo</Label>
                <Input type="date" value={form.data_saldo_inicial} onChange={(e) => setForm({ ...form, data_saldo_inicial: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveConta.mutate()} disabled={saveConta.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
