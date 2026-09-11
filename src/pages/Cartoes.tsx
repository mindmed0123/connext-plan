import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, CreditCard, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { Badge } from "@/components/ui/badge";
import { formatDateBR, getTodayDateInputValue, parseDateString, toDateKey } from "@/lib/date";
import { arredondar2, dividirParcelas } from "@/lib/money";
import { useDraftState } from "@/hooks/useDraftState";
import { calcularFaturas, faturaDeCompra, somarMeses } from "@/lib/cartao-helpers";

type Cartao = {
  id: string; apelido: string; banco: string | null; bandeira: string | null;
  ultimos_4: string | null; titular: string | null; limite: number;
  dia_fechamento: number | null; dia_vencimento: number | null; ativo: boolean;
};

const emptyCartao = { apelido: "", banco: "", bandeira: "", ultimos_4: "", titular: "", limite: "0", dia_fechamento: "", dia_vencimento: "" };
const emptyDesp = { cartao_id: "", obra_id: "", comprador_id: "", descricao: "", valor: "", data_compra: getTodayDateInputValue(), parcelas: "1", observacoes: "", categoria: "" };

const CATEGORIAS_DESPESA = [
  "Almoço", "Café", "Mercado", "Combustível", "Transporte", "Estacionamento",
  "Pedágio", "Material de construção", "Ferramentas", "EPI", "Hospedagem",
  "Manutenção veículo", "Telefonia/Internet", "Escritório", "Outros",
];

export default function Cartoes() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [cartaoDialog, setCartaoDialog] = useState(false);
  const [editingCartao, setEditingCartao] = useState<Cartao | null>(null);
  const [cartaoForm, setCartaoForm, clearCartaoDraft] = useDraftState("cartao-form", emptyCartao);
  const [despDialog, setDespDialog] = useState(false);
  const [editingDespId, setEditingDespId] = useState<string | null>(null);
  const [despForm, setDespForm, clearDespDraft] = useDraftState("desp-form", emptyDesp);
  const [filtroCartao, setFiltroCartao] = useState<string>("todos");
  const [periodoMeses, setPeriodoMeses] = useState<number | null>(12);

  const { data: cartoes = [] } = useQuery({
    queryKey: ["cartoes", empresaId], enabled: !!empresaId,
    queryFn: async () => ((await supabase.from("cartoes_credito" as any).select("*").order("apelido")).data as unknown as Cartao[]) ?? [],
  });
  const { data: obras = [] } = useQuery({
    queryKey: ["obras-min", empresaId], enabled: !!empresaId,
    queryFn: async () => (await (supabase.from("obras") as any).select("id, codigo_chamado, descricao_servico").eq("arquivada", false).order("created_at", { ascending: false })).data ?? [],
  });
  const obraLabel = (o: any) => {
    const desc = (o?.descricao_servico ?? "").trim();
    return desc ? `${o.codigo_chamado} — ${desc.length > 60 ? desc.slice(0,60) + "…" : desc}` : o.codigo_chamado;
  };
  const { data: compradores = [] } = useQuery({
    queryKey: ["compradores", empresaId], enabled: !!empresaId,
    queryFn: async () => (await supabase.from("compradores" as any).select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: despesas = [] } = useQuery({
    queryKey: ["cartao-despesas", empresaId, filtroCartao, periodoMeses], enabled: !!empresaId,
    queryFn: async () => {
      const desde = periodoMeses
        ? toDateKey(new Date(new Date().getFullYear(), new Date().getMonth() - periodoMeses, 1))
        : null;
      const linhas: any[] = [];
      const passo = 1000;
      for (let inicio = 0; ; inicio += passo) {
        let q = supabase.from("cartao_despesas" as any)
          .select("*, cartoes_credito(apelido), obras(codigo_chamado), compradores(nome)")
          .order("data_compra", { ascending: false })
          .range(inicio, inicio + passo - 1);
        if (filtroCartao !== "todos") q = q.eq("cartao_id", filtroCartao);
        if (desde) q = q.gte("data_compra", desde);
        const { data, error } = await q;
        if (error) throw error;
        linhas.push(...(data ?? []));
        if (!data || data.length < passo) break;
      }
      return linhas;
    },
  });

  const saveCartao = useMutation({
    mutationFn: async () => {
      const payload = {
        apelido: cartaoForm.apelido.trim(),
        banco: cartaoForm.banco || null,
        bandeira: cartaoForm.bandeira || null,
        ultimos_4: cartaoForm.ultimos_4 || null,
        titular: cartaoForm.titular || null,
        limite: parseFloat(cartaoForm.limite) || 0,
        dia_fechamento: cartaoForm.dia_fechamento ? parseInt(cartaoForm.dia_fechamento) : null,
        dia_vencimento: cartaoForm.dia_vencimento ? parseInt(cartaoForm.dia_vencimento) : null,
      };
      if (editingCartao) {
        const { error } = await supabase.from("cartoes_credito" as any).update(payload).eq("id", editingCartao.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cartoes_credito" as any).insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCartao ? "Cartão atualizado" : "Cartão criado");
      qc.invalidateQueries({ queryKey: ["cartoes", empresaId] });
      clearCartaoDraft();
      setCartaoDialog(false);
      setEditingCartao(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCartao = useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from("cartao_despesas" as any)
        .select("id", { count: "exact", head: true })
        .eq("cartao_id", id);
      if ((count ?? 0) > 0) {
        throw new Error(
          `Este cartão tem ${count} despesa(s) lançada(s) e não pode ser excluído. Use "Desativar" para tirá-lo de uso mantendo o histórico.`,
        );
      }
      const { error } = await supabase.from("cartoes_credito" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cartão removido"); qc.invalidateQueries({ queryKey: ["cartoes", empresaId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivoCartao = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("cartoes_credito" as any).update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.ativo ? "Cartão reativado" : "Cartão desativado");
      qc.invalidateQueries({ queryKey: ["cartoes", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDesp = useMutation({
    mutationFn: async () => {
      const totalParcelas = Math.max(1, parseInt(despForm.parcelas) || 1);
      const valorTotal = parseFloat(despForm.valor) || 0;
      const valorParcela = totalParcelas > 1 ? Math.round((valorTotal / totalParcelas) * 100) / 100 : valorTotal;
      const basePayload = {
        cartao_id: despForm.cartao_id,
        obra_id: despForm.obra_id || null,
        comprador_id: despForm.comprador_id || null,
        descricao: despForm.descricao.trim() || despForm.categoria || "Despesa",
        data_compra: despForm.data_compra,
        parcelas: totalParcelas,
        observacoes: despForm.observacoes || null,
        categoria: despForm.categoria || null,
      };
      if (editingDespId) {
        const { error } = await supabase.from("cartao_despesas" as any)
          .update({ ...basePayload, valor: valorTotal }).eq("id", editingDespId);
        if (error) throw error;
        return;
      }
      // Cria N linhas (uma por fatura) quando parcelado
      const base = parseDateString(despForm.data_compra) ?? new Date();
      const valores = dividirParcelas(arredondar2(valorTotal), totalParcelas);
      const rows = Array.from({ length: totalParcelas }, (_, i) => {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        const dataCompra = toDateKey(d);
        const descricao = totalParcelas > 1
          ? `${basePayload.descricao} (${i + 1}/${totalParcelas})`
          : basePayload.descricao;
        return { ...basePayload, data_compra: dataCompra, descricao, valor: valores[i] };
      });
      const { error } = await supabase.from("cartao_despesas" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingDespId ? "Despesa atualizada" : "Despesa registrada");
      qc.invalidateQueries({ queryKey: ["cartao-despesas"] });
      qc.invalidateQueries({ queryKey: ["obra-financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      clearDespDraft();
      setEditingDespId(null);
      setDespDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delDesp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartao_despesas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartao-despesas"] });
      qc.invalidateQueries({ queryKey: ["obra-financeiro-resumo"] });
      toast.success("Despesa excluída");
    },
  });

  const pagarFatura = useMutation({
    mutationFn: async ({ cartaoId, vencimento, pagar }: { cartaoId: string; vencimento: string; pagar: boolean }) => {
      const fn = pagar ? "pagar_fatura_cartao" : "reabrir_fatura_cartao";
      const args = pagar
        ? { _cartao_id: cartaoId, _vencimento: vencimento, _data_pagamento: getTodayDateInputValue() }
        : { _cartao_id: cartaoId, _vencimento: vencimento };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc(fn, args);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.pagar ? "Fatura marcada como paga" : "Fatura reaberta");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totaisPorCartao = useMemo(() => {
    const map = new Map<string, number>();
    (despesas as any[]).forEach((d) => map.set(d.cartao_id, (map.get(d.cartao_id) ?? 0) + Number(d.valor || 0)));
    return map;
  }, [despesas]);

  // Faturas por cartão (agrupadas pelo vencimento calculado no banco)
  const faturasPorCartao = useMemo(() => {
    const map = new Map<string, Map<string, { total: number; paga: boolean; qtd: number }>>();
    (despesas as any[]).forEach((d) => {
      const venc = d.fatura_vencimento as string | null;
      if (!venc) return;
      const porCartao = map.get(d.cartao_id) ?? new Map();
      const cur = porCartao.get(venc) ?? { total: 0, paga: true, qtd: 0 };
      cur.total += Number(d.valor || 0);
      cur.qtd += 1;
      if (!d.fatura_paga) cur.paga = false;
      porCartao.set(venc, cur);
      map.set(d.cartao_id, porCartao);
    });
    return map;
  }, [despesas]);

  const openEditDesp = (d: any) => {
    setEditingDespId(d.id);
    setDespForm({
      cartao_id: d.cartao_id ?? "",
      obra_id: d.obra_id ?? "",
      comprador_id: d.comprador_id ?? "",
      descricao: d.descricao ?? "",
      valor: String(d.valor ?? ""),
      data_compra: d.data_compra ?? getTodayDateInputValue(),
      parcelas: String(d.parcelas ?? "1"),
      observacoes: d.observacoes ?? "",
      categoria: d.categoria ?? "",
    });
    setDespDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cartões de Crédito</h1>
          <p className="text-sm text-muted-foreground">Gerencie cartões e despesas vinculadas a obras</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditingCartao(null); clearCartaoDraft(); setCartaoDialog(true); }}>
            <CreditCard className="h-4 w-4" /> Novo cartão
          </Button>
          <Button onClick={() => { setEditingDespId(null); clearDespDraft(); setDespDialog(true); }} disabled={cartoes.length === 0}>
            <Plus className="h-4 w-4" /> Nova despesa
          </Button>
        </div>
      </div>

      {/* Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cartoes.map((c) => {
          const info = c.dia_fechamento && c.dia_vencimento
            ? calcularFaturas(c.dia_fechamento, c.dia_vencimento)
            : null;
          const despesasDoCartao = (despesas as any[]).filter((d) => d.cartao_id === c.id);
          const totalFaturaAtual = info
            ? despesasDoCartao
                .filter((d) => faturaDeCompra(d.data_compra, c.dia_fechamento!, c.dia_vencimento!) === "atual")
                .reduce((s, d) => s + Number(d.valor || 0), 0)
            : 0;
          const totalFaturaProxima = info
            ? despesasDoCartao
                .filter((d) => faturaDeCompra(d.data_compra, c.dia_fechamento!, c.dia_vencimento!) === "proxima")
                .reduce((s, d) => s + Number(d.valor || 0), 0)
            : 0;

          return (
            <Card key={c.id} className={(c as any).ativo === false ? "opacity-70" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    {c.apelido}
                    {(c as any).ativo === false && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        Inativo
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => {
                      setEditingCartao(c);
                      setCartaoForm({
                        apelido: c.apelido, banco: c.banco ?? "", bandeira: c.bandeira ?? "",
                        ultimos_4: c.ultimos_4 ?? "", titular: c.titular ?? "",
                        limite: String(c.limite), dia_fechamento: c.dia_fechamento?.toString() ?? "",
                        dia_vencimento: c.dia_vencimento?.toString() ?? "",
                      });
                      setCartaoDialog(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => toggleAtivoCartao.mutate({ id: c.id, ativo: (c as any).ativo === false })}
                    >
                      {(c as any).ativo === false ? "Ativar" : "Desativar"}
                    </Button>
                    {despesasDoCartao.length === 0 && (
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir cartão?") && delCartao.mutate(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground text-xs">{c.banco ?? "—"} • {c.bandeira ?? "—"} {c.ultimos_4 ? `• •••• ${c.ultimos_4}` : ""}</p>
                <p className="text-xs">Limite: <span className="font-medium">{formatCurrency(c.limite)}</span></p>
                {info ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fatura atual · {info.faturaAtual.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateBR(toDateKey(info.faturaAtual.abre))} → {formatDateBR(toDateKey(info.faturaAtual.fecha))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Vence: {formatDateBR(toDateKey(info.faturaAtual.vence))}</p>
                      <p className="text-sm font-semibold tabular-nums mt-1">{formatCurrency(totalFaturaAtual)}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 border p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Próxima · {info.proximaFatura.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateBR(toDateKey(info.proximaFatura.abre))} → {formatDateBR(toDateKey(info.proximaFatura.fecha))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Vence: {formatDateBR(toDateKey(info.proximaFatura.vence))}</p>
                      <p className="text-sm font-semibold tabular-nums mt-1">{formatCurrency(totalFaturaProxima)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Fech. dia {c.dia_fechamento ?? "—"} • Venc. dia {c.dia_vencimento ?? "—"}</p>
                )}
                <p className="pt-1 text-xs">Total registrado: <Badge variant="secondary">{formatCurrency(totaisPorCartao.get(c.id) ?? 0)}</Badge></p>

                {/* Faturas: pagar marca as despesas como realizadas no financeiro */}
                {(() => {
                  const faturas = Array.from(faturasPorCartao.get(c.id)?.entries() ?? [])
                    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
                    .filter(([venc, f]) => !f.paga || venc >= toDateKey(new Date(new Date().setMonth(new Date().getMonth() - 2))))
                    .slice(0, 6);
                  if (faturas.length === 0) return null;
                  return (
                    <div className="pt-2 space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Faturas</p>
                      {faturas.map(([venc, f]) => (
                        <div key={venc} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                          <div className="min-w-0">
                            <p className="text-xs font-medium">Vence {formatDateBR(venc)}</p>
                            <p className="text-[10px] text-muted-foreground">{f.qtd} lançamento(s) · {formatCurrency(f.total)}</p>
                          </div>
                          {f.paga ? (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
                              onClick={() => pagarFatura.mutate({ cartaoId: c.id, vencimento: venc, pagar: false })}>
                              Paga · reabrir
                            </Button>
                          ) : (
                            <Button size="sm" className="h-7 px-2 text-[11px]"
                              disabled={pagarFatura.isPending}
                              onClick={() => pagarFatura.mutate({ cartaoId: c.id, vencimento: venc, pagar: true })}>
                              Pagar fatura
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}
        {cartoes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
        )}
      </div>

      {/* Despesas */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Despesas no cartão</h2>
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cartões</SelectItem>
              {cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.apelido}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Fatura</TableHead>
              <TableHead>Cartão</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead>Parc.</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(despesas as any[]).map((d) => {
              const cartao = cartoes.find((c) => c.id === d.cartao_id);
              let faturaCell: React.ReactNode = "—";
              if (cartao?.dia_fechamento && cartao?.dia_vencimento) {
                const qual = faturaDeCompra(d.data_compra, cartao.dia_fechamento, cartao.dia_vencimento);
                const { faturaAtual, proximaFatura } = calcularFaturas(cartao.dia_fechamento, cartao.dia_vencimento);
                if (qual === "atual") faturaCell = <Badge variant="default" className="text-[10px]">Atual · {faturaAtual.label}</Badge>;
                else if (qual === "proxima") faturaCell = <Badge variant="secondary" className="text-[10px]">Próxima · {proximaFatura.label}</Badge>;
                else if (qual === "anterior") faturaCell = <Badge variant="outline" className="text-[10px]">Anterior</Badge>;
                else faturaCell = <Badge variant="outline" className="text-[10px]">Futura</Badge>;
              }
              return (
                <TableRow key={d.id}>
                  <TableCell>{formatDateBR(d.data_compra)}</TableCell>
                  <TableCell>{faturaCell}</TableCell>
                  <TableCell>{d.cartoes_credito?.apelido ?? "—"}</TableCell>
                  <TableCell>{d.descricao}</TableCell>
                  <TableCell>{d.categoria ? <Badge variant="outline">{d.categoria}</Badge> : "—"}</TableCell>
                  <TableCell>{d.obras?.codigo_chamado ?? "—"}</TableCell>
                  <TableCell>{d.compradores?.nome ?? "—"}</TableCell>
                  <TableCell>{d.parcelas}x</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(d.valor)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditDesp(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir despesa?") && delDesp.mutate(d.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(despesas as any[]).length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma despesa.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cartão dialog */}
      <Dialog open={cartaoDialog} onOpenChange={(v) => { setCartaoDialog(v); if (!v) setEditingCartao(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingCartao ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Apelido*</Label><Input value={cartaoForm.apelido} onChange={(e) => setCartaoForm({ ...cartaoForm, apelido: e.target.value })} /></div>
            <div><Label>Banco</Label><Input value={cartaoForm.banco} onChange={(e) => setCartaoForm({ ...cartaoForm, banco: e.target.value })} /></div>
            <div><Label>Bandeira</Label><Input value={cartaoForm.bandeira} onChange={(e) => setCartaoForm({ ...cartaoForm, bandeira: e.target.value })} /></div>
            <div><Label>Últimos 4</Label><Input maxLength={4} value={cartaoForm.ultimos_4} onChange={(e) => setCartaoForm({ ...cartaoForm, ultimos_4: e.target.value })} /></div>
            <div><Label>Titular</Label><Input value={cartaoForm.titular} onChange={(e) => setCartaoForm({ ...cartaoForm, titular: e.target.value })} /></div>
            <div><Label>Limite</Label><Input type="number" step="0.01" value={cartaoForm.limite} onChange={(e) => setCartaoForm({ ...cartaoForm, limite: e.target.value })} /></div>
            <div><Label>Dia fechamento</Label><Input type="number" min={1} max={31} value={cartaoForm.dia_fechamento} onChange={(e) => setCartaoForm({ ...cartaoForm, dia_fechamento: e.target.value })} /></div>
            <div><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={cartaoForm.dia_vencimento} onChange={(e) => setCartaoForm({ ...cartaoForm, dia_vencimento: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartaoDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveCartao.mutate()} disabled={!cartaoForm.apelido || saveCartao.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Despesa dialog */}
      <Dialog open={despDialog} onOpenChange={(v) => { setDespDialog(v); if (!v) setEditingDespId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingDespId ? "Editar despesa" : "Nova despesa de cartão"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Cartão*</Label>
              <Select value={despForm.cartao_id} onValueChange={(v) => setDespForm({ ...despForm, cartao_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {cartoes
                    .filter((c) => (c as any).ativo !== false || c.id === despForm.cartao_id)
                    .map((c) => <SelectItem key={c.id} value={c.id}>{c.apelido}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Descrição</Label><Input value={despForm.descricao} onChange={(e) => setDespForm({ ...despForm, descricao: e.target.value })} /></div>
            <div><Label>Valor*</Label><Input type="number" step="0.01" value={despForm.valor} onChange={(e) => setDespForm({ ...despForm, valor: e.target.value })} /></div>
            <div><Label>Data</Label><Input type="date" value={despForm.data_compra} onChange={(e) => setDespForm({ ...despForm, data_compra: e.target.value })} /></div>
            <div>
              <Label>Parcelas</Label>
              <Input type="number" min={1} value={despForm.parcelas} onChange={(e) => setDespForm({ ...despForm, parcelas: e.target.value })} disabled={!!editingDespId} />
              {!editingDespId && parseInt(despForm.parcelas) > 1 && parseFloat(despForm.valor) > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {despForm.parcelas}x de {formatCurrency((parseFloat(despForm.valor) || 0) / (parseInt(despForm.parcelas) || 1))} — gera {despForm.parcelas} faturas mensais
                </p>
              )}
            </div>
            <div className="col-span-2">
              <Label>Categoria</Label>
              <Select value={despForm.categoria || "none"} onValueChange={(v) => setDespForm({ ...despForm, categoria: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem categoria —</SelectItem>
                  {CATEGORIAS_DESPESA.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Obra (origem)</Label>
              <Select value={despForm.obra_id || "none"} onValueChange={(v) => setDespForm({ ...despForm, obra_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem obra —</SelectItem>
                  {(obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{obraLabel(o)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Comprador</Label>
              <Select value={despForm.comprador_id || "none"} onValueChange={(v) => setDespForm({ ...despForm, comprador_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {(compradores as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Observações</Label><Input value={despForm.observacoes} onChange={(e) => setDespForm({ ...despForm, observacoes: e.target.value })} /></div>
            {despForm.cartao_id && despForm.data_compra && (() => {
              const cartao = cartoes.find((c) => c.id === despForm.cartao_id);
              if (!cartao?.dia_fechamento || !cartao?.dia_vencimento) return null;
              const qual = faturaDeCompra(despForm.data_compra, cartao.dia_fechamento, cartao.dia_vencimento);
              const { faturaAtual, proximaFatura } = calcularFaturas(cartao.dia_fechamento, cartao.dia_vencimento);
              const label = qual === "atual"
                ? `Fatura atual (${faturaAtual.label}) · vence ${formatDateBR(toDateKey(faturaAtual.vence))}`
                : qual === "proxima"
                ? `Próxima fatura (${proximaFatura.label}) · vence ${formatDateBR(toDateKey(proximaFatura.vence))}`
                : qual === "anterior"
                ? "Fatura anterior (já vencida)"
                : "Fatura futura";
              return (
                <div className="col-span-2 rounded-md bg-primary/5 border border-primary/20 p-2 text-xs">
                  📅 Esta compra entra na <span className="font-medium">{label}</span>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDespDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveDesp.mutate()} disabled={!despForm.cartao_id || !despForm.categoria || !despForm.valor || saveDesp.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
