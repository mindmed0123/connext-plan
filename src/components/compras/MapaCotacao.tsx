import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { useFornecedores } from "@/hooks/useContasBancarias";
import { getTodayDateInputValue } from "@/lib/date";

type Props = { solicitacaoId: string | null; onClose: () => void };

export function MapaCotacao({ solicitacaoId, onClose }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { fornecedores } = useFornecedores();
  const [novaOpen, setNovaOpen] = useState(false);
  const [escolha, setEscolha] = useState<Record<string, string>>({});

  const { data: solicitacao } = useQuery({
    queryKey: [empresaId, "solicitacao", solicitacaoId],
    enabled: !!empresaId && !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_compra")
        .select("*, solicitacao_itens(*), obras(codigo_chamado, descricao_servico)")
        .eq("id", solicitacaoId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: cotacoes = [] } = useQuery({
    queryKey: [empresaId, "cotacoes", solicitacaoId],
    enabled: !!empresaId && !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select("*, fornecedores(nome), cotacao_itens(*)")
        .eq("solicitacao_id", solicitacaoId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const itens: any[] = useMemo(
    () => [...((solicitacao?.solicitacao_itens ?? []) as any[])].sort((a, b) => a.ordem - b.ordem),
    [solicitacao],
  );

  const precoDe = (cotacaoId: string, itemId: string) => {
    const c = cotacoes.find((x) => x.id === cotacaoId);
    const ci = (c?.cotacao_itens ?? []).find((i: any) => i.solicitacao_item_id === itemId);
    if (!ci || ci.disponivel === false) return null;
    return Number(ci.preco_unitario) || null;
  };

  const melhorPorItem = useMemo(() => {
    const mapa: Record<string, { cotacaoId: string; preco: number } | null> = {};
    itens.forEach((it) => {
      let melhor: { cotacaoId: string; preco: number } | null = null;
      cotacoes.forEach((c) => {
        const p = precoDe(c.id, it.id);
        if (p != null && (melhor == null || p < melhor.preco)) melhor = { cotacaoId: c.id, preco: p };
      });
      mapa[it.id] = melhor;
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, cotacoes]);

  const totalCotacao = (cotacaoId: string) => {
    const c = cotacoes.find((x) => x.id === cotacaoId);
    let soma = Number(c?.frete ?? 0);
    itens.forEach((it) => {
      const p = precoDe(cotacaoId, it.id);
      if (p != null) soma += p * Number(it.quantidade);
    });
    return soma;
  };

  const melhorTotal = useMemo(() => {
    let melhor: { id: string; total: number } | null = null;
    cotacoes.forEach((c) => {
      const t = totalCotacao(c.id);
      if (t > 0 && (melhor == null || t < melhor.total)) melhor = { id: c.id, total: t };
    });
    return melhor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotacoes, itens]);

  useEffect(() => {
    // escolha inicial: melhor preço de cada item
    const inicial: Record<string, string> = {};
    itens.forEach((it) => {
      const m = melhorPorItem[it.id];
      if (m) inicial[it.id] = m.cotacaoId;
    });
    setEscolha((atual) => (Object.keys(atual).length ? atual : inicial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(melhorPorItem)]);

  const gerarOC = useMutation({
    mutationFn: async () => {
      if (!solicitacao?.obra_id) throw new Error("A solicitação precisa estar ligada a uma obra para gerar a ordem de compra");
      const porCotacao: Record<string, any[]> = {};
      itens.forEach((it) => {
        const cid = escolha[it.id];
        if (!cid) return;
        const preco = precoDe(cid, it.id);
        if (preco == null) return;
        (porCotacao[cid] ||= []).push({ item: it, preco });
      });
      const cotacaoIds = Object.keys(porCotacao);
      if (!cotacaoIds.length) throw new Error("Escolha ao menos um fornecedor por item");

      const numeros: string[] = [];
      for (const cid of cotacaoIds) {
        const cot = cotacoes.find((c) => c.id === cid);
        const { data: oc, error } = await supabase
          .from("ordens_compra")
          .insert([{
            fornecedor_id: cot.fornecedor_id,
            obra_id: solicitacao.obra_id,
            solicitacao_id: solicitacao.id,
            data: getTodayDateInputValue(),
            condicao_pagamento: cot.condicao_pagamento,
            prazo_entrega: cot.prazo_entrega,
            frete: Number(cot.frete ?? 0),
          }])
          .select("id, numero")
          .single();
        if (error) throw error;
        const linhas = porCotacao[cid].map((l, i) => ({
          ordem_compra_id: oc.id,
          solicitacao_item_id: l.item.id,
          etapa_id: solicitacao.etapa_id ?? null,
          orcamento_item_id: l.item.orcamento_item_id ?? null,
          descricao: l.item.descricao,
          unidade: l.item.unidade,
          quantidade: Number(l.item.quantidade),
          preco_unitario: l.preco,
          ordem: i,
        }));
        const { error: e2 } = await supabase.from("ordem_compra_itens").insert(linhas);
        if (e2) throw e2;
        await supabase.from("cotacoes").update({ status: "escolhida" }).eq("id", cid);
        numeros.push(oc.numero ?? "");
      }
      await supabase.from("solicitacoes_compra").update({ status: "aprovada" }).eq("id", solicitacao.id);
      return numeros;
    },
    onSuccess: (numeros) => {
      toast.success(`Ordem de compra gerada: ${numeros.filter(Boolean).join(", ")}`);
      qc.invalidateQueries({ queryKey: [empresaId, "ordens-compra"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!solicitacaoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Mapa de cotação — {solicitacao?.numero ?? ""}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {solicitacao?.obras?.codigo_chamado ?? ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setNovaOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova cotação
          </Button>
        </div>

        {cotacoes.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Nenhuma cotação registrada. Cadastre a primeira para comparar os fornecedores.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Item</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  {cotacoes.map((c) => (
                    <TableHead key={c.id} className="text-right min-w-[130px]">
                      {c.fornecedores?.nome}
                      {melhorTotal?.id === c.id && (
                        <Badge className="ml-2" variant="secondary">melhor total</Badge>
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[180px]">Escolhido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{it.descricao}</div>
                      <div className="text-xs text-muted-foreground">{it.unidade}</div>
                    </TableCell>
                    <TableCell className="text-right">{Number(it.quantidade).toLocaleString("pt-BR")}</TableCell>
                    {cotacoes.map((c) => {
                      const p = precoDe(c.id, it.id);
                      const melhor = melhorPorItem[it.id]?.cotacaoId === c.id;
                      return (
                        <TableCell
                          key={c.id}
                          className={`text-right ${melhor ? "bg-primary/10 font-semibold text-primary" : ""}`}
                        >
                          {p == null ? "—" : formatCurrency(p)}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Select
                        value={escolha[it.id] ?? ""}
                        onValueChange={(v) => setEscolha((e) => ({ ...e, [it.id]: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Não comprar" /></SelectTrigger>
                        <SelectContent>
                          {cotacoes
                            .filter((c) => precoDe(c.id, it.id) != null)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.fornecedores?.nome}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Total (com frete)</TableCell>
                  <TableCell />
                  {cotacoes.map((c) => (
                    <TableCell
                      key={c.id}
                      className={`text-right font-semibold ${melhorTotal?.id === c.id ? "text-primary" : ""}`}
                    >
                      {formatCurrency(totalCotacao(c.id))}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => gerarOC.mutate()} disabled={gerarOC.isPending || !cotacoes.length}>
            <ShoppingCart className="mr-2 h-4 w-4" /> Gerar ordem de compra
          </Button>
        </DialogFooter>

        <NovaCotacaoDialog
          open={novaOpen}
          onClose={() => setNovaOpen(false)}
          solicitacaoId={solicitacaoId}
          itens={itens}
          fornecedores={fornecedores as any[]}
          onSaved={() => qc.invalidateQueries({ queryKey: [empresaId, "cotacoes", solicitacaoId] })}
        />
      </DialogContent>
    </Dialog>
  );
}

function NovaCotacaoDialog({
  open, onClose, solicitacaoId, itens, fornecedores, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  solicitacaoId: string | null;
  itens: any[];
  fornecedores: any[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fornecedor_id: "", data: getTodayDateInputValue(), validade: "",
    condicao_pagamento: "", prazo_entrega: "", frete: "0",
  });
  const [precos, setPrecos] = useState<Record<string, { preco: string; marca: string; disponivel: boolean }>>({});

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.fornecedor_id) throw new Error("Escolha o fornecedor");
      const { data: cot, error } = await supabase
        .from("cotacoes")
        .insert([{
          solicitacao_id: solicitacaoId,
          fornecedor_id: form.fornecedor_id,
          data: form.data,
          validade: form.validade || null,
          condicao_pagamento: form.condicao_pagamento || null,
          prazo_entrega: form.prazo_entrega || null,
          frete: Number(form.frete) || 0,
        }])
        .select("id")
        .single();
      if (error) throw error;
      const linhas = itens.map((it) => ({
        cotacao_id: cot.id,
        solicitacao_item_id: it.id,
        preco_unitario: Number(precos[it.id]?.preco) || 0,
        marca: precos[it.id]?.marca || null,
        disponivel: precos[it.id]?.disponivel !== false && (Number(precos[it.id]?.preco) || 0) > 0,
      }));
      const { error: e2 } = await supabase.from("cotacao_itens").insert(linhas);
      if (e2) throw e2;
      await supabase.from("solicitacoes_compra").update({ status: "cotando" }).eq("id", solicitacaoId!);
    },
    onSuccess: () => {
      toast.success("Cotação registrada");
      setForm({ fornecedor_id: "", data: getTodayDateInputValue(), validade: "", condicao_pagamento: "", prazo_entrega: "", frete: "0" });
      setPrecos({});
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova cotação</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <Label>Fornecedor</Label>
            <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Data</Label>
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
          <div className="space-y-1"><Label>Validade</Label>
            <Input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} /></div>
          <div className="space-y-1"><Label>Condição de pagamento</Label>
            <Input value={form.condicao_pagamento} onChange={(e) => setForm({ ...form, condicao_pagamento: e.target.value })} placeholder="30/60 dias" /></div>
          <div className="space-y-1"><Label>Prazo de entrega</Label>
            <Input value={form.prazo_entrega} onChange={(e) => setForm({ ...form, prazo_entrega: e.target.value })} placeholder="5 dias úteis" /></div>
          <div className="space-y-1"><Label>Frete</Label>
            <Input type="number" step="0.01" value={form.frete} onChange={(e) => setForm({ ...form, frete: e.target.value })} /></div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="w-[140px]">Preço unitário</TableHead>
              <TableHead className="w-[140px]">Marca</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  {it.descricao}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({Number(it.quantidade).toLocaleString("pt-BR")} {it.unidade})
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    type="number" step="0.01"
                    value={precos[it.id]?.preco ?? ""}
                    onChange={(e) =>
                      setPrecos((p) => ({ ...p, [it.id]: { ...(p[it.id] ?? { marca: "", disponivel: true }), preco: e.target.value } }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={precos[it.id]?.marca ?? ""}
                    onChange={(e) =>
                      setPrecos((p) => ({ ...p, [it.id]: { ...(p[it.id] ?? { preco: "", disponivel: true }), marca: e.target.value } }))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar cotação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
