import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Plus, ScrollText, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";
import { useObraConfig } from "@/hooks/useObraConfig";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { gerarOrdemCompraPDF } from "@/lib/oc-pdf";
import { MapaCotacao } from "@/components/compras/MapaCotacao";
import { ReceberOCDialog } from "@/components/compras/ReceberOCDialog";

type ItemForm = { descricao: string; unidade: string; quantidade: string; observacao: string };
const itemVazio: ItemForm = { descricao: "", unidade: "un", quantidade: "1", observacao: "" };

const STATUS_SOL: Record<string, { texto: string; variante: "default" | "secondary" | "outline" | "destructive" }> = {
  rascunho: { texto: "Rascunho", variante: "outline" },
  aguardando_aprovacao: { texto: "Aguardando aprovação", variante: "outline" },
  aberta: { texto: "Aberta", variante: "default" },
  cotando: { texto: "Em cotação", variante: "secondary" },
  aprovada: { texto: "Aprovada", variante: "default" },
  reprovada: { texto: "Reprovada", variante: "destructive" },
  atendida: { texto: "Atendida", variante: "secondary" },
};

const STATUS_OC: Record<string, { texto: string; variante: "default" | "secondary" | "outline" | "destructive" }> = {
  aguardando_aprovacao: { texto: "Aguardando aprovação", variante: "outline" },
  emitida: { texto: "Emitida", variante: "default" },
  parcial: { texto: "Recebida em parte", variante: "secondary" },
  recebida: { texto: "Recebida", variante: "secondary" },
  cancelada: { texto: "Cancelada", variante: "destructive" },
};

export default function Compras() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { rotulos } = useObraConfig();
  const { config } = useEmpresaConfig();

  const [novaSol, setNovaSol] = useState(false);
  const [mapaId, setMapaId] = useState<string | null>(null);
  const [receberId, setReceberId] = useState<string | null>(null);
  const [form, setForm] = useState({ obra_id: "", etapa_id: "", data: getTodayDateInputValue(), observacoes: "" });
  const [itens, setItens] = useState<ItemForm[]>([{ ...itemVazio }, { ...itemVazio }, { ...itemVazio }]);

  const { data: obras = [] } = useQuery({
    queryKey: [empresaId, "obras-min-compras"],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("obras").select("id, codigo_chamado, descricao_servico").eq("arquivada", false)
        .order("created_at", { ascending: false })).data ?? [],
  });
  const obraLabel = (o: any) => {
    const d = (o?.descricao_servico ?? "").trim();
    return d ? `${o.codigo_chamado} — ${d.slice(0, 45)}` : o?.codigo_chamado ?? "";
  };

  const { data: etapas = [] } = useQuery({
    queryKey: [empresaId, "etapas-compras", form.obra_id],
    enabled: !!empresaId && !!form.obra_id,
    queryFn: async () =>
      (await supabase.from("obra_etapas").select("id, nome").eq("obra_id", form.obra_id).order("ordem")).data ?? [],
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: [empresaId, "solicitacoes-compra"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_compra")
        .select("*, obras(codigo_chamado), solicitacao_itens(id)")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: ordens = [] } = useQuery({
    queryKey: [empresaId, "ordens-compra"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_compra")
        .select("*, fornecedores(nome), obras(codigo_chamado)")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const salvarSolicitacao = useMutation({
    mutationFn: async () => {
      const linhas = itens.filter((i) => i.descricao.trim() && Number(i.quantidade) > 0);
      if (!linhas.length) throw new Error("Informe ao menos um item");
      const { data: sol, error } = await supabase
        .from("solicitacoes_compra")
        .insert([{
          obra_id: form.obra_id || null,
          etapa_id: form.etapa_id || null,
          data: form.data,
          observacoes: form.observacoes || null,
          status: "aberta",
        }])
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("solicitacao_itens").insert(
        linhas.map((l, i) => ({
          solicitacao_id: sol.id,
          descricao: l.descricao.trim(),
          unidade: l.unidade || "un",
          quantidade: Number(l.quantidade),
          observacao: l.observacao || null,
          ordem: i,
        })),
      );
      if (e2) throw e2;

      // Alçada de aprovação (se houver faixa configurada para solicitação)
      const { data: pendentes } = await supabase.rpc("solicitar_aprovacao", {
        _documento: "solicitacao",
        _registro_id: sol.id,
        _valor: 0,
        _descricao: "Solicitação de compra",
      });
      if ((pendentes ?? 0) > 0) {
        await supabase.from("solicitacoes_compra").update({ status: "aguardando_aprovacao" }).eq("id", sol.id);
      }
    },
    onSuccess: () => {
      toast.success("Solicitação de compra criada");
      qc.invalidateQueries({ queryKey: [empresaId, "solicitacoes-compra"] });
      setForm({ obra_id: "", etapa_id: "", data: getTodayDateInputValue(), observacoes: "" });
      setItens([{ ...itemVazio }, { ...itemVazio }, { ...itemVazio }]);
      setNovaSol(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirSolicitacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("solicitacoes_compra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação excluída");
      qc.invalidateQueries({ queryKey: [empresaId, "solicitacoes-compra"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixarPDF = async (ordemId: string) => {
    if (!empresaId) return;
    const [{ data: oc }, { data: itensOC }, { data: empresa }] = await Promise.all([
      supabase.from("ordens_compra")
        .select("*, fornecedores(nome, cnpj_cpf, telefone, email), obras(codigo_chamado, descricao_servico)")
        .eq("id", ordemId).single(),
      supabase.from("ordem_compra_itens").select("*").eq("ordem_compra_id", ordemId).order("ordem"),
      supabase.from("empresas").select("*").eq("id", empresaId).single(),
    ]);
    if (!oc) return toast.error("Ordem de compra não encontrada");
    const e = (empresa ?? {}) as any;
    await gerarOrdemCompraPDF(
      {
        numero: (oc as any).numero,
        data: (oc as any).data,
        condicao_pagamento: (oc as any).condicao_pagamento,
        prazo_entrega: (oc as any).prazo_entrega,
        observacoes: (oc as any).observacoes,
        frete: (oc as any).frete,
        valor_total: Number((oc as any).valor_total),
        fornecedor: (oc as any).fornecedores,
        obra: (oc as any).obras,
      },
      (itensOC ?? []).map((i: any) => ({
        descricao: i.descricao, unidade: i.unidade,
        quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario), subtotal: Number(i.subtotal),
      })),
      {
        nome: e.nome ?? "Empresa", cnpj: e.cnpj ?? null, endereco: e.endereco ?? null, bairro: e.bairro ?? null,
        cidade: e.cidade ?? null, uf: e.uf ?? null, cep: e.cep ?? null, telefone: e.telefone ?? null,
        email: e.email ?? null, logo_url: e.logo_url ?? null,
        cor_primaria: config.cor_primaria, texto_rodape: config.texto_rodape,
      },
      rotulos.codigo_obra,
    );
    toast.success("PDF gerado!");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Solicitação, cotação e ordem de compra. O custo entra na obra pelo recebimento.
          </p>
        </div>
        <Button onClick={() => setNovaSol(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova solicitação
        </Button>
      </div>

      <Tabs defaultValue="solicitacoes">
        <TabsList>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          <TabsTrigger value="ordens">Ordens de compra</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitacoes" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>{rotulos.codigo_obra}</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitacoes.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhuma solicitação de compra.
                    </TableCell></TableRow>
                  )}
                  {solicitacoes.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.numero ?? "—"}</TableCell>
                      <TableCell>{formatDateBR(s.data)}</TableCell>
                      <TableCell>{s.obras?.codigo_chamado ?? "—"}</TableCell>
                      <TableCell className="text-right">{s.solicitacao_itens?.length ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_SOL[s.status]?.variante ?? "outline"}>
                          {STATUS_SOL[s.status]?.texto ?? s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => setMapaId(s.id)}>
                          <ScrollText className="mr-2 h-4 w-4" /> Cotações
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => excluirSolicitacao.mutate(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ordens" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>{rotulos.codigo_obra}</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordens.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhuma ordem de compra emitida.
                    </TableCell></TableRow>
                  )}
                  {ordens.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.numero ?? "—"}</TableCell>
                      <TableCell>{formatDateBR(o.data)}</TableCell>
                      <TableCell>{o.fornecedores?.nome ?? "—"}</TableCell>
                      <TableCell>{o.obras?.codigo_chamado ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(o.valor_total))}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_OC[o.status]?.variante ?? "outline"}>
                          {STATUS_OC[o.status]?.texto ?? o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => baixarPDF(o.id)}>
                          <FileDown className="mr-2 h-4 w-4" /> PDF
                        </Button>
                        {o.status !== "recebida" && o.status !== "cancelada" && (
                          <Button size="sm" className="ml-2" onClick={() => setReceberId(o.id)}>
                            <Truck className="mr-2 h-4 w-4" /> Receber
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Nova solicitação */}
      <Dialog open={novaSol} onOpenChange={setNovaSol}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova solicitação de compra</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label>{rotulos.codigo_obra}</Label>
              <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v, etapa_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(obras as any[]).map((o) => <SelectItem key={o.id} value={o.id}>{obraLabel(o)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label>Etapa (opcional)</Label>
              <Select value={form.etapa_id} onValueChange={(v) => setForm({ ...form, etapa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sem etapa" /></SelectTrigger>
                <SelectContent>
                  {(etapas as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Itens</Label>
            {itens.map((it, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-12">
                <Input
                  className="sm:col-span-6" placeholder="Descrição do material"
                  value={it.descricao}
                  onChange={(e) => setItens((l) => l.map((x, i) => (i === idx ? { ...x, descricao: e.target.value } : x)))}
                />
                <Input
                  className="sm:col-span-2" placeholder="Un."
                  value={it.unidade}
                  onChange={(e) => setItens((l) => l.map((x, i) => (i === idx ? { ...x, unidade: e.target.value } : x)))}
                />
                <Input
                  className="sm:col-span-2" type="number" step="0.01" placeholder="Qtd."
                  value={it.quantidade}
                  onChange={(e) => setItens((l) => l.map((x, i) => (i === idx ? { ...x, quantidade: e.target.value } : x)))}
                />
                <Button
                  className="sm:col-span-2" variant="ghost" size="sm"
                  onClick={() => setItens((l) => l.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItens((l) => [...l, { ...itemVazio }])}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar item
            </Button>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaSol(false)}>Cancelar</Button>
            <Button onClick={() => salvarSolicitacao.mutate()} disabled={salvarSolicitacao.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MapaCotacao solicitacaoId={mapaId} onClose={() => setMapaId(null)} />
      <ReceberOCDialog ordemId={receberId} onClose={() => setReceberId(null)} />
    </div>
  );
}
