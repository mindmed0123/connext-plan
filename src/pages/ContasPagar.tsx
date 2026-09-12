import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Truck, Trash2, Paperclip, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR, getTodayDateInputValue, toDateKey } from "@/lib/date";
import { dividirParcelas } from "@/lib/money";
import { useContasBancarias, useFornecedores } from "@/hooks/useContasBancarias";
import { usePlanoContas } from "@/hooks/usePlanoContas";

type Filtro = "todas" | "hoje" | "atrasadas" | "30dias" | "pagas";

const emptyConta = {
  fornecedor_id: "", obra_id: "", categoria_id: "", descricao: "", numero_documento: "",
  valor_total: "", data_emissao: getTodayDateInputValue(), primeiro_vencimento: getTodayDateInputValue(),
  parcelas: "1", observacoes: "",
};
const emptyForn = { nome: "", cnpj_cpf: "", contato: "", telefone: "", email: "", observacoes: "" };

export default function ContasPagar() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { fornecedores } = useFornecedores();
  const { contas: contasBancarias } = useContasBancarias();
  const plano = usePlanoContas();
  const categorias: any[] = (plano as any)?.categorias ?? [];

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [fornFiltro, setFornFiltro] = useState("todos");
  const [obraFiltro, setObraFiltro] = useState("todas");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [contaDialog, setContaDialog] = useState(false);
  const [form, setForm] = useState(emptyConta);
  const [fornDialog, setFornDialog] = useState(false);
  const [fornForm, setFornForm] = useState(emptyForn);
  const [loteDialog, setLoteDialog] = useState(false);
  const [loteData, setLoteData] = useState(getTodayDateInputValue());
  const [loteConta, setLoteConta] = useState("");

  const { data: obras = [] } = useQuery({
    queryKey: [empresaId, "obras-min-cp"],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("obras").select("id, codigo_chamado, descricao_servico").eq("arquivada", false).order("created_at", { ascending: false })).data ?? [],
  });
  const obraLabel = (o: any) => {
    const d = (o?.descricao_servico ?? "").trim();
    return d ? `${o.codigo_chamado} — ${d.slice(0, 50)}` : o?.codigo_chamado ?? "";
  };

  const { data: parcelas = [] } = useQuery({
    queryKey: [empresaId, "contas-pagar-parcelas"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar_parcelas")
        .select("*, contas_pagar(id, descricao, numero_documento, obra_id, fornecedor_id, obras(codigo_chamado), fornecedores(nome))")
        .order("data_vencimento")
        .order("id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const hoje = toDateKey(new Date());
  const em30 = toDateKey(new Date(Date.now() + 30 * 864e5));

  const lista = useMemo(() => {
    return (parcelas as any[]).filter((p) => {
      const paga = !!p.data_pagamento;
      if (filtro === "pagas" && !paga) return false;
      if (filtro !== "pagas" && filtro !== "todas" && paga) return false;
      if (filtro === "hoje" && p.data_vencimento !== hoje) return false;
      if (filtro === "atrasadas" && !(p.data_vencimento < hoje)) return false;
      if (filtro === "30dias" && !(p.data_vencimento >= hoje && p.data_vencimento <= em30)) return false;
      if (fornFiltro !== "todos" && p.contas_pagar?.fornecedor_id !== fornFiltro) return false;
      if (obraFiltro !== "todas" && p.contas_pagar?.obra_id !== obraFiltro) return false;
      return true;
    });
  }, [parcelas, filtro, fornFiltro, obraFiltro, hoje, em30]);

  const totalAberto = lista.filter((p: any) => !p.data_pagamento).reduce((s: number, p: any) => s + Number(p.valor), 0);
  const totalAtrasado = (parcelas as any[])
    .filter((p) => !p.data_pagamento && p.data_vencimento < hoje)
    .reduce((s, p) => s + Number(p.valor), 0);

  const saveForn = useMutation({
    mutationFn: async () => {
      if (!fornForm.nome.trim()) throw new Error("Informe o nome do fornecedor");
      const { error } = await supabase.from("fornecedores").insert([{
        nome: fornForm.nome.trim(),
        cnpj_cpf: fornForm.cnpj_cpf || null,
        contato: fornForm.contato || null,
        telefone: fornForm.telefone || null,
        email: fornForm.email || null,
        observacoes: fornForm.observacoes || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor cadastrado");
      qc.invalidateQueries({ queryKey: [empresaId, "fornecedores"] });
      setFornForm(emptyForn);
      setFornDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveConta = useMutation({
    mutationFn: async () => {
      const total = parseFloat(form.valor_total) || 0;
      const qtd = Math.max(1, parseInt(form.parcelas) || 1);
      if (!form.descricao.trim()) throw new Error("Informe a descrição");
      if (total <= 0) throw new Error("Informe o valor total");
      const { data: conta, error } = await supabase.from("contas_pagar").insert([{
        fornecedor_id: form.fornecedor_id || null,
        obra_id: form.obra_id || null,
        categoria_id: form.categoria_id || null,
        descricao: form.descricao.trim(),
        numero_documento: form.numero_documento || null,
        valor_total: total,
        data_emissao: form.data_emissao,
        observacoes: form.observacoes || null,
      }]).select("id").single();
      if (error) throw error;

      const valores = dividirParcelas(total, qtd);
      const base = new Date(`${form.primeiro_vencimento}T12:00:00`);
      const linhas = valores.map((v, i) => {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        return { conta_id: conta.id, numero: i + 1, valor: v, data_vencimento: toDateKey(d) };
      });
      const { error: e2 } = await supabase.from("contas_pagar_parcelas").insert(linhas);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Conta a pagar criada");
      qc.invalidateQueries({ queryKey: [empresaId, "contas-pagar-parcelas"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      setForm(emptyConta);
      setContaDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pagarLote = useMutation({
    mutationFn: async () => {
      if (!selecionadas.length) throw new Error("Selecione ao menos uma parcela");
      const { error } = await supabase
        .from("contas_pagar_parcelas")
        .update({ data_pagamento: loteData, conta_bancaria_id: loteConta || null })
        .in("id", selecionadas);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamentos registrados");
      setSelecionadas([]);
      setLoteDialog(false);
      qc.invalidateQueries({ queryKey: [empresaId, "contas-pagar-parcelas"] });
      qc.invalidateQueries({ queryKey: [empresaId, "saldos-contas"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estornar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contas_pagar_parcelas")
        .update({ data_pagamento: null, valor_pago: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento estornado");
      qc.invalidateQueries({ queryKey: [empresaId, "contas-pagar-parcelas"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirConta = useMutation({
    mutationFn: async (contaId: string) => {
      const { error } = await supabase.from("contas_pagar").delete().eq("id", contaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta excluída");
      qc.invalidateQueries({ queryKey: [empresaId, "contas-pagar-parcelas"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const anexar = async (parcelaId: string, file: File) => {
    if (!empresaId) return;
    const path = `${empresaId}/contas-pagar/${parcelaId}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("comprovantes-pagamento").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { error: e2 } = await supabase.from("contas_pagar_parcelas").update({ comprovante_url: path }).eq("id", parcelaId);
    if (e2) return toast.error(e2.message);
    toast.success("Comprovante anexado");
    qc.invalidateQueries({ queryKey: [empresaId, "contas-pagar-parcelas"] });
  };

  const abrirComprovante = async (path: string) => {
    const { data, error } = await supabase.storage.from("comprovantes-pagamento").createSignedUrl(path, 600);
    if (error || !data) return toast.error("Não foi possível abrir o comprovante");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contas a pagar</h1>
          <p className="text-sm text-muted-foreground">Títulos de fornecedores, ligados ao razão do financeiro.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFornDialog(true)}>
            <Truck className="mr-2 h-4 w-4" /> Novo fornecedor
          </Button>
          <Button onClick={() => setContaDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova conta
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Em aberto (filtro)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrency(totalAberto)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Atrasado</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{formatCurrency(totalAtrasado)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Selecionadas</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-bold">{selecionadas.length}</span>
            <Button size="sm" disabled={!selecionadas.length} onClick={() => setLoteDialog(true)}>
              <CheckCheck className="mr-2 h-4 w-4" /> Pagar em lote
            </Button>
          </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="hoje">Vencendo hoje</SelectItem>
            <SelectItem value="atrasadas">Atrasadas</SelectItem>
            <SelectItem value="30dias">Próximos 30 dias</SelectItem>
            <SelectItem value="pagas">Pagas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fornFiltro} onValueChange={setFornFiltro}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os fornecedores</SelectItem>
            {(fornecedores as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={obraFiltro} onValueChange={setObraFiltro}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Obra" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as obras</SelectItem>
            {(obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{obraLabel(o)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhum título encontrado.</TableCell></TableRow>
              )}
              {lista.map((p: any) => {
                const paga = !!p.data_pagamento;
                const atrasada = !paga && p.data_vencimento < hoje;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {!paga && (
                        <Checkbox
                          checked={selecionadas.includes(p.id)}
                          onCheckedChange={(c) =>
                            setSelecionadas((s) => (c ? [...s, p.id] : s.filter((i) => i !== p.id)))
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>{p.contas_pagar?.fornecedores?.nome ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{p.contas_pagar?.descricao}</TableCell>
                    <TableCell>{p.contas_pagar?.obras?.codigo_chamado ?? "—"}</TableCell>
                    <TableCell>{p.numero}</TableCell>
                    <TableCell>{formatDateBR(p.data_vencimento)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(p.valor_pago ?? p.valor))}</TableCell>
                    <TableCell>
                      {paga ? <Badge variant="secondary">Paga {formatDateBR(p.data_pagamento)}</Badge>
                        : atrasada ? <Badge variant="destructive">Atrasada</Badge>
                        : <Badge variant="outline">Em aberto</Badge>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {p.comprovante_url ? (
                        <Button size="icon" variant="ghost" onClick={() => abrirComprovante(p.comprovante_url)}>
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      ) : (
                        <label className="inline-flex cursor-pointer items-center px-2 text-muted-foreground hover:text-foreground">
                          <Paperclip className="h-4 w-4" />
                          <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && anexar(p.id, e.target.files[0])} />
                        </label>
                      )}
                      {paga && <Button size="sm" variant="ghost" onClick={() => estornar.mutate(p.id)}>Estornar</Button>}
                      <Button size="icon" variant="ghost" onClick={() => excluirConta.mutate(p.conta_id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Nova conta */}
      <Dialog open={contaDialog} onOpenChange={setContaDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova conta a pagar</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(fornecedores as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Obra (opcional)</Label>
              <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sem obra" /></SelectTrigger>
                <SelectContent>
                  {(obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{obraLabel(o)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Padrão" /></SelectTrigger>
                <SelectContent>
                  {categorias.filter((c: any) => c.tipo === "despesa").map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nº do documento</Label>
              <Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Valor total</Label>
              <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Parcelas</Label>
              <Input type="number" min="1" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Emissão</Label>
              <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>1º vencimento</Label>
              <Input type="date" value={form.primeiro_vencimento} onChange={(e) => setForm({ ...form, primeiro_vencimento: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContaDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveConta.mutate()} disabled={saveConta.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fornecedor */}
      <Dialog open={fornDialog} onOpenChange={setFornDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo fornecedor</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1"><Label>Nome</Label>
              <Input value={fornForm.nome} onChange={(e) => setFornForm({ ...fornForm, nome: e.target.value })} /></div>
            <div className="space-y-1"><Label>CNPJ/CPF</Label>
              <Input value={fornForm.cnpj_cpf} onChange={(e) => setFornForm({ ...fornForm, cnpj_cpf: e.target.value })} /></div>
            <div className="space-y-1"><Label>Contato</Label>
              <Input value={fornForm.contato} onChange={(e) => setFornForm({ ...fornForm, contato: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Telefone</Label>
                <Input value={fornForm.telefone} onChange={(e) => setFornForm({ ...fornForm, telefone: e.target.value })} /></div>
              <div className="space-y-1"><Label>E-mail</Label>
                <Input value={fornForm.email} onChange={(e) => setFornForm({ ...fornForm, email: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Observações</Label>
              <Textarea value={fornForm.observacoes} onChange={(e) => setFornForm({ ...fornForm, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFornDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveForn.mutate()} disabled={saveForn.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagamento em lote */}
      <Dialog open={loteDialog} onOpenChange={setLoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagar {selecionadas.length} parcela(s)</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1"><Label>Data do pagamento</Label>
              <Input type="date" value={loteData} onChange={(e) => setLoteData(e.target.value)} /></div>
            <div className="space-y-1"><Label>Conta bancária</Label>
              <Select value={loteConta} onValueChange={setLoteConta}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoteDialog(false)}>Cancelar</Button>
            <Button onClick={() => pagarLote.mutate()} disabled={pagarLote.isPending}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
