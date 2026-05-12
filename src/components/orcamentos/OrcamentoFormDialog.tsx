import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { UNIDADES } from "@/components/servicos/ServicoFormDialog";
import { formatCurrency } from "@/lib/obra-helpers";

type ItemForm = {
  id?: string;
  servico_id?: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
};

const newItem = (): ItemForm => ({
  servico_id: null, descricao: "", unidade: "un",
  quantidade: 1, preco_unitario: 0, desconto_pct: 0,
});

const subtotal = (i: ItemForm) =>
  Number(i.quantidade) * Number(i.preco_unitario) * (1 - Number(i.desconto_pct) / 100);

async function generateNumero(empresaId: string) {
  const ym = format(new Date(), "yyyyMM");
  const { count } = await supabase
    .from("orcamentos")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .like("numero_orcamento", `ORC-${ym}-%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `ORC-${ym}-${seq}`;
}

export function OrcamentoFormDialog({
  open, onOpenChange, orcamentoId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orcamentoId?: string | null;
}) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const [obraId, setObraId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [dataOrcamento, setDataOrcamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [validadeDias, setValidadeDias] = useState(30);
  const [condicoes, setCondicoes] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteCnpj, setClienteCnpj] = useState("");
  const [clienteEndereco, setClienteEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([newItem()]);
  const [numero, setNumero] = useState<string | null>(null);

  const { data: obras } = useQuery({
    queryKey: ["orc-obras", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("obras")
        .select("id, codigo_chamado, descricao_servico, status")
        .in("status", ["recebido", "em_vistoria", "aguardando_orcamento", "em_aprovacao"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: servicos } = useQuery({
    queryKey: ["servicos-ativos", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase.from("servicos").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  // Carregar orçamento existente
  useEffect(() => {
    if (!open) return;
    if (!orcamentoId) {
      setObraId(""); setTitulo(""); setDataOrcamento(format(new Date(), "yyyy-MM-dd"));
      setValidadeDias(30); setCondicoes(""); setClienteNome(""); setClienteCnpj("");
      setClienteEndereco(""); setObservacoes(""); setItens([newItem()]); setNumero(null);
      return;
    }
    (async () => {
      const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", orcamentoId).single();
      if (!orc) return;
      setObraId(orc.obra_id);
      setTitulo(orc.titulo ?? "");
      setDataOrcamento(orc.data_orcamento ?? format(new Date(), "yyyy-MM-dd"));
      setValidadeDias(orc.validade_dias ?? 30);
      setCondicoes(orc.condicoes_pagamento ?? "");
      setClienteNome(orc.cliente_nome ?? "");
      setClienteCnpj(orc.cliente_cnpj ?? "");
      setClienteEndereco(orc.cliente_endereco ?? "");
      setObservacoes(orc.observacoes ?? "");
      setNumero(orc.numero_orcamento);
      const { data: its } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId).order("ordem");
      setItens(((its ?? []) as ItemForm[]).map((i) => ({
        id: i.id, servico_id: i.servico_id, descricao: i.descricao, unidade: i.unidade,
        quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario),
        desconto_pct: Number(i.desconto_pct),
      })) || [newItem()]);
    })();
  }, [open, orcamentoId]);

  const total = useMemo(() => itens.reduce((s, i) => s + subtotal(i), 0), [itens]);

  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const onSelectServico = (idx: number, sid: string) => {
    const s = servicos?.find((x) => x.id === sid);
    if (!s) return;
    updateItem(idx, {
      servico_id: s.id, descricao: s.nome,
      unidade: s.unidade, preco_unitario: Number(s.preco_unitario),
    });
  };

  const save = useMutation({
    mutationFn: async (statusFinal: "em_elaboracao" | "enviado") => {
      if (!empresaId) throw new Error("Empresa não identificada");
      if (!obraId) throw new Error("Selecione uma obra");
      if (itens.length === 0 || !itens.some((i) => i.descricao.trim())) {
        throw new Error("Adicione pelo menos um item");
      }
      const num = numero ?? (await generateNumero(empresaId));

      const payload = {
        empresa_id: empresaId,
        obra_id: obraId,
        numero_orcamento: num,
        titulo: titulo || null,
        data_orcamento: dataOrcamento,
        validade_dias: validadeDias,
        condicoes_pagamento: condicoes || null,
        cliente_nome: clienteNome || null,
        cliente_cnpj: clienteCnpj || null,
        cliente_endereco: clienteEndereco || null,
        observacoes: observacoes || null,
        status: statusFinal,
        valor_orcamento: total,
        data_envio: statusFinal === "enviado" ? format(new Date(), "yyyy-MM-dd") : null,
      };

      let id = orcamentoId;
      if (id) {
        const { error } = await supabase.from("orcamentos").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("orcamento_itens").delete().eq("orcamento_id", id);
      } else {
        const { data, error } = await supabase.from("orcamentos").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      const itensValidos = itens.filter((i) => i.descricao.trim());
      if (itensValidos.length > 0) {
        const { error } = await supabase.from("orcamento_itens").insert(
          itensValidos.map((it, idx) => ({
            orcamento_id: id!, empresa_id: empresaId,
            servico_id: it.servico_id || null,
            descricao: it.descricao, unidade: it.unidade,
            quantidade: Number(it.quantidade) || 0,
            preco_unitario: Number(it.preco_unitario) || 0,
            desconto_pct: Number(it.desconto_pct) || 0,
            ordem: idx,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: (_d, status) => {
      toast.success(status === "enviado" ? "Orçamento enviado!" : "Rascunho salvo!");
      qc.invalidateQueries({ queryKey: ["orcamentos"] });
      qc.invalidateQueries({ queryKey: ["all-orcamentos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orcamentoId ? "Editar orçamento" : "Novo orçamento"}{numero ? ` — ${numero}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Cabeçalho */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Cabeçalho</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Obra *</Label>
                <Select value={obraId} onValueChange={setObraId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                  <SelectContent>
                    {obras?.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.codigo_chamado} — {o.descricao_servico?.slice(0, 60)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Orçamento de reparo hidráulico" />
              </div>
              <div>
                <Label>Data do orçamento *</Label>
                <Input type="date" value={dataOrcamento} onChange={(e) => setDataOrcamento(e.target.value)} />
              </div>
              <div>
                <Label>Validade (dias) *</Label>
                <Input type="number" min={1} value={validadeDias} onChange={(e) => setValidadeDias(Number(e.target.value))} />
              </div>
              <div className="md:col-span-2">
                <Label>Condições de pagamento</Label>
                <Input value={condicoes} onChange={(e) => setCondicoes(e.target.value)} placeholder="Ex.: 30/60/90 dias" />
              </div>
            </div>
          </section>

          {/* Cliente */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Dados do cliente (aparece no PDF)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome do cliente</Label>
                <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={clienteCnpj} onChange={(e) => setClienteCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço</Label>
                <Input value={clienteEndereco} onChange={(e) => setClienteEndereco(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Itens */}
          <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens</h3>
              <Button size="sm" type="button" variant="outline" onClick={() => setItens([...itens, newItem()])}>
                <Plus className="h-4 w-4" /> Adicionar item
              </Button>
            </div>
            <div className="space-y-3">
              {itens.map((item, idx) => (
                <div key={idx} className="rounded-md border bg-background p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-4">
                        <Label className="text-xs">Buscar serviço</Label>
                        <Select value={item.servico_id ?? ""} onValueChange={(v) => onSelectServico(idx, v)}>
                          <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                          <SelectContent>
                            {servicos?.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.nome} — {formatCurrency(Number(s.preco_unitario))}/{s.unidade}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-12 md:col-span-8">
                        <Label className="text-xs">Descrição *</Label>
                        <Input value={item.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Label className="text-xs">Unidade *</Label>
                        <Select value={item.unidade} onValueChange={(v) => updateItem(idx, { unidade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Label className="text-xs">Qtd *</Label>
                        <Input type="number" step="0.0001" value={item.quantidade}
                          onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-4 md:col-span-3">
                        <Label className="text-xs">Preço unit. (R$) *</Label>
                        <Input type="number" step="0.01" value={item.preco_unitario}
                          onChange={(e) => updateItem(idx, { preco_unitario: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <Label className="text-xs">Desc. %</Label>
                        <Input type="number" step="0.01" min={0} max={100} value={item.desconto_pct}
                          onChange={(e) => updateItem(idx, { desconto_pct: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-6 md:col-span-3 flex flex-col">
                        <Label className="text-xs">Subtotal</Label>
                        <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-semibold">
                          {formatCurrency(subtotal(item))}
                        </div>
                      </div>
                    </div>
                    <Button type="button" size="icon" variant="ghost"
                      onClick={() => setItens(itens.filter((_, i) => i !== idx))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <div className="text-right space-y-1">
                <div className="text-sm text-muted-foreground">
                  Subtotal: <span className="font-medium text-foreground">{formatCurrency(itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0))}</span>
                </div>
                <div className="text-lg font-bold">
                  TOTAL: <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Observações */}
          <section>
            <Label>Observações / Escopo de serviços</Label>
            <Textarea rows={4} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => save.mutate("em_elaboracao")} disabled={save.isPending}>
            Salvar rascunho
          </Button>
          <Button onClick={() => save.mutate("enviado")} disabled={save.isPending}>
            Salvar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
