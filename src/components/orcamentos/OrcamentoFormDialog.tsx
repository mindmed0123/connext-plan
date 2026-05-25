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
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Minus, X, Search, Loader2, ArrowRight, ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/obra-helpers";
import { cn } from "@/lib/utils";
import { getTodayDateInputValue } from "@/lib/date";

type ItemForm = {
  id?: string;
  servico_id?: string | null;
  codigo?: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
  aliquota_iss?: number;
};

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

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export function OrcamentoFormDialog({
  open, onOpenChange, orcamentoId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orcamentoId?: string | null;
}) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);

  // Etapa 1
  const [chamado, setChamado] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [dataOrcamento, setDataOrcamento] = useState(getTodayDateInputValue());
  const [validadeDias, setValidadeDias] = useState(30);
  const [condicoes, setCondicoes] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteCnpj, setClienteCnpj] = useState("");
  const [clienteIE, setClienteIE] = useState("");
  const [clienteEndereco, setClienteEndereco] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);

  // Etapa 2
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [numero, setNumero] = useState<string | null>(null);
  const [servicoSearch, setServicoSearch] = useState("");

  // Proposta comercial (campos extras Omie-like)
  const [objeto, setObjeto] = useState("");
  const [prazoExecucao, setPrazoExecucao] = useState("");
  const [localExecucao, setLocalExecucao] = useState("");
  const [descontoGlobalPct, setDescontoGlobalPct] = useState(0);
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>("a_vista");
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [intervaloParcelas, setIntervaloParcelas] = useState(30);
  const [percentualEntrada, setPercentualEntrada] = useState(0);
  const [observacoesInternas, setObservacoesInternas] = useState("");


  const { data: servicos } = useQuery({
    queryKey: ["servicos-ativos", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase.from("servicos").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("*").order("nome");
      return data ?? [];
    },
  });

  const aplicarCliente = (c: {
    nome: string; cnpj: string;
    inscricao_estadual: string | null; endereco: string | null;
    email: string | null; telefone: string | null;
  }) => {
    setClienteNome(c.nome ?? "");
    setClienteCnpj(formatCnpj(c.cnpj ?? ""));
    setClienteIE(c.inscricao_estadual ?? "");
    setClienteEndereco(c.endereco ?? "");
    setClienteEmail(c.email ?? "");
    setClienteTelefone(c.telefone ?? "");
    setClientePopoverOpen(false);
  };

  const buscarCnpj = async () => {
    const cnpjLimpo = clienteCnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      toast.error("Informe um CNPJ válido (14 dígitos)");
      return;
    }
    setBuscandoCnpj(true);
    try {
      // 1) Já existe localmente?
      const existente = clientes?.find((c) => c.cnpj.replace(/\D/g, "") === cnpjLimpo);
      if (existente) {
        aplicarCliente(existente);
        toast.success("Cliente já cadastrado — dados carregados!");
        return;
      }
      // 2) Busca BrasilAPI
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const d = await res.json();
      setClienteNome(d.razao_social || d.nome_fantasia || "");
      const endereco = [
        `${d.logradouro || ""}${d.numero ? ", " + d.numero : ""}`,
        d.complemento, d.bairro,
        `${d.municipio || ""}${d.uf ? " - " + d.uf : ""}`,
        d.cep ? `CEP: ${d.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : "",
      ].filter(Boolean).join(" - ");
      setClienteEndereco(endereco);
      if (d.email) setClienteEmail(d.email);
      if (d.ddd_telefone_1) setClienteTelefone(`(${d.ddd_telefone_1.slice(0, 2)}) ${d.ddd_telefone_1.slice(2)}`);
      toast.success("Dados carregados — serão salvos ao concluir o orçamento.");
    } catch (e) {
      toast.error((e as Error).message || "Erro ao buscar CNPJ");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  // Carregar orçamento existente
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setServicoSearch("");
    if (!orcamentoId) {
      setChamado(""); setTitulo(""); setDataOrcamento(getTodayDateInputValue());
      setValidadeDias(30); setCondicoes(""); setClienteNome(""); setClienteCnpj("");
      setClienteIE(""); setClienteEndereco(""); setClienteEmail(""); setClienteTelefone("");
      setObservacoes(""); setItens([]); setNumero(null);
      setObjeto(""); setPrazoExecucao(""); setLocalExecucao("");
      setDescontoGlobalPct(0); setCondicaoPagamento("a_vista");
      setNumeroParcelas(1); setIntervaloParcelas(30); setPercentualEntrada(0);
      setObservacoesInternas("");
      return;
    }
    (async () => {
      const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", orcamentoId).single();
      if (!orc) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setChamado((orc as any).codigo_chamado ?? "");
      setTitulo(orc.titulo ?? "");
      setDataOrcamento(orc.data_orcamento ?? getTodayDateInputValue());
      setValidadeDias(orc.validade_dias ?? 30);
      setCondicoes(orc.condicoes_pagamento ?? "");
      setClienteNome(orc.cliente_nome ?? "");
      setClienteCnpj(orc.cliente_cnpj ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setClienteIE((orc as any).cliente_inscricao_estadual ?? "");
      setClienteEndereco(orc.cliente_endereco ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setClienteEmail((orc as any).cliente_email ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setClienteTelefone((orc as any).cliente_telefone ?? "");
      setObservacoes(orc.observacoes ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = orc as any;
      setNumero(o.numero || o.numero_orcamento || null);
      setObjeto(o.objeto ?? "");
      setPrazoExecucao(o.prazo_execucao ?? "");
      setLocalExecucao(o.local_execucao ?? "");
      setDescontoGlobalPct(Number(o.desconto_global_pct ?? 0));
      setCondicaoPagamento(o.condicao_pagamento ?? "a_vista");
      setNumeroParcelas(Number(o.numero_parcelas ?? 1));
      setIntervaloParcelas(Number(o.intervalo_parcelas ?? 30));
      setPercentualEntrada(Number(o.percentual_entrada ?? 0));
      setObservacoesInternas(o.observacoes_internas ?? "");
      const { data: its } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId).order("ordem");
      setItens(((its ?? []) as ItemForm[]).map((i) => ({
        id: i.id, servico_id: i.servico_id, codigo: i.codigo ?? null,
        descricao: i.descricao, unidade: i.unidade,
        quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario),
        desconto_pct: Number(i.desconto_pct),
        aliquota_iss: Number(i.aliquota_iss ?? 0),
      })));
    })();
  }, [open, orcamentoId]);

  const total = useMemo(() => itens.reduce((s, i) => s + subtotal(i), 0), [itens]);

  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const adicionarServico = (servicoId: string) => {
    const s = servicos?.find((x) => x.id === servicoId);
    if (!s) return;
    const existIdx = itens.findIndex((i) => i.servico_id === servicoId);
    if (existIdx >= 0) {
      updateItem(existIdx, { quantidade: Number(itens[existIdx].quantidade) + 1 });
    } else {
      setItens([...itens, {
        servico_id: s.id, codigo: (s as { codigo?: string | null }).codigo ?? null,
        descricao: s.nome, unidade: s.unidade,
        quantidade: 1, preco_unitario: Number(s.preco_unitario), desconto_pct: 0,
        aliquota_iss: Number((s as { aliquota_iss?: number }).aliquota_iss ?? 0),
      }]);
    }
  };

  const removerItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx));

  const irParaServicos = () => {
    if (!chamado.trim()) { toast.error("Informe o chamado"); return; }
    setStep(2);
  };

  const servicosFiltrados = useMemo(() => {
    const q = servicoSearch.trim().toLowerCase();
    if (!q) return servicos ?? [];
    return (servicos ?? []).filter((s) =>
      s.nome.toLowerCase().includes(q) ||
      (s.codigo ?? "").toLowerCase().includes(q) ||
      (s.descricao ?? "").toLowerCase().includes(q)
    );
  }, [servicos, servicoSearch]);

  const save = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não identificada");
      if (!chamado.trim()) throw new Error("Informe o chamado");
      if (itens.length === 0) throw new Error("Adicione pelo menos um serviço");
      const num = numero ?? (await generateNumero(empresaId));

      // Persiste/atualiza cliente se tiver CNPJ
      const cnpjLimpo = clienteCnpj.replace(/\D/g, "");
      if (cnpjLimpo.length === 14 && clienteNome.trim()) {
        await supabase.from("clientes").upsert({
          empresa_id: empresaId,
          cnpj: clienteCnpj,
          nome: clienteNome,
          inscricao_estadual: clienteIE || null,
          endereco: clienteEndereco || null,
          email: clienteEmail || null,
          telefone: clienteTelefone || null,
        }, { onConflict: "empresa_id,cnpj" });
      }

      // Garante uma obra correspondente ao chamado (via RPC com privilégios elevados)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: obraIdData, error: obraErr } = await (supabase as any).rpc("ensure_obra_for_chamado", {
        _chamado: chamado,
        _descricao: titulo || clienteNome || chamado,
        _endereco: clienteEndereco || null,
      });
      if (obraErr) throw obraErr;
      const obraId: string | null = (obraIdData as string) ?? null;

      const payload = {
        empresa_id: empresaId,
        obra_id: obraId,
        codigo_chamado: chamado,
        numero_orcamento: num,
        titulo: titulo || null,
        data_orcamento: dataOrcamento,
        data_emissao: dataOrcamento,
        validade_dias: validadeDias,
        condicoes_pagamento: condicoes || null,
        cliente_nome: clienteNome || null,
        cliente_cnpj: clienteCnpj || null,
        cliente_inscricao_estadual: clienteIE || null,
        cliente_endereco: clienteEndereco || null,
        cliente_email: clienteEmail || null,
        cliente_telefone: clienteTelefone || null,
        observacoes: observacoes || null,
        observacoes_internas: observacoesInternas || null,
        objeto: objeto || null,
        prazo_execucao: prazoExecucao || null,
        local_execucao: localExecucao || null,
        desconto_global_pct: Number(descontoGlobalPct) || 0,
        condicao_pagamento: condicaoPagamento,
        numero_parcelas: Number(numeroParcelas) || 1,
        intervalo_parcelas: Number(intervaloParcelas) || 30,
        percentual_entrada: Number(percentualEntrada) || 0,
        status: "em_elaboracao" as const,
        valor_orcamento: total,
        data_envio: null,
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

      const { error } = await supabase.from("orcamento_itens").insert(
        itens.map((it, idx) => ({
          orcamento_id: id!, empresa_id: empresaId,
          servico_id: it.servico_id || null,
          codigo: it.codigo || null,
          tipo: "servico",
          descricao: it.descricao, unidade: it.unidade,
          quantidade: Number(it.quantidade) || 0,
          preco_unitario: Number(it.preco_unitario) || 0,
          desconto_pct: Number(it.desconto_pct) || 0,
          aliquota_iss: Number(it.aliquota_iss) || 0,
          ordem: idx,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orçamento salvo!");
      qc.invalidateQueries({ queryKey: ["orcamentos"] });
      qc.invalidateQueries({ queryKey: ["all-orcamentos"] });
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["clientes", empresaId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {orcamentoId ? "Editar orçamento" : "Novo orçamento"}{numero ? ` — ${numero}` : ""}
          </DialogTitle>
          {/* Stepper */}
          <div className="flex items-center gap-2 pt-2">
            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
              step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              <span className="h-5 w-5 rounded-full bg-background/20 flex items-center justify-center">1</span>
              Dados & cliente
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
              step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              <span className="h-5 w-5 rounded-full bg-background/20 flex items-center justify-center">2</span>
              Serviços
            </div>
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-5">
            {/* Cabeçalho */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Chamado</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Chamado *</Label>
                  <Input
                    value={chamado}
                    onChange={(e) => setChamado(e.target.value)}
                    placeholder="Ex.: 12345 ou OS-2026-001"
                  />
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
              <h3 className="text-sm font-semibold text-muted-foreground">Cliente</h3>

              <div className="rounded-md border bg-primary/5 p-3 space-y-3">
                <div>
                  <Label className="text-xs">Selecionar cliente cadastrado</Label>
                  <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {clienteNome || "Buscar cliente já cadastrado..."}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nome ou CNPJ..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente cadastrado ainda.</CommandEmpty>
                          <CommandGroup>
                            {clientes?.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.nome} ${c.cnpj}`}
                                onSelect={() => aplicarCliente(c)}
                              >
                                <Check className={cn("h-4 w-4 mr-2",
                                  clienteCnpj.replace(/\D/g, "") === c.cnpj.replace(/\D/g, "") ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span className="font-medium">{c.nome}</span>
                                  <span className="text-xs text-muted-foreground">{c.cnpj}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="text-center text-xs text-muted-foreground">— OU —</div>

                <div>
                  <Label className="text-xs">Buscar pelo CNPJ</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={clienteCnpj}
                      onChange={(e) => setClienteCnpj(formatCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarCnpj(); } }}
                    />
                    <Button type="button" onClick={buscarCnpj} disabled={buscandoCnpj}>
                      {buscandoCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Buscar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Buscamos automaticamente; o cliente é salvo ao concluir o orçamento e nas próximas vezes aparece na lista acima.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Razão social / Nome</Label>
                  <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input value={clienteIE} onChange={(e) => setClienteIE(e.target.value)} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço completo</Label>
                  <Input value={clienteEndereco} onChange={(e) => setClienteEndereco(e.target.value)} />
                </div>
              </div>
            </section>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={irParaServicos}>
                Avançar para serviços <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {chamado && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <span className="font-semibold">Chamado: {chamado}</span>
                {clienteNome && <span className="text-muted-foreground"> · {clienteNome}</span>}
              </div>
            )}

            {/* Catálogo de serviços */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Adicionar serviços do catálogo</h3>
              </div>
              <Input
                placeholder="Buscar serviço por nome, código ou descrição..."
                value={servicoSearch}
                onChange={(e) => setServicoSearch(e.target.value)}
              />
              <div className="rounded-md border max-h-64 overflow-y-auto divide-y">
                {(servicosFiltrados.length === 0) ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {(servicos?.length ?? 0) === 0
                      ? "Nenhum serviço cadastrado. Cadastre na aba Serviços."
                      : "Nenhum serviço encontrado."}
                  </div>
                ) : servicosFiltrados.map((s) => {
                  const jaIncluido = itens.some((i) => i.servico_id === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => adicionarServico(s.id)}
                      className="w-full grid grid-cols-[1fr_140px_32px] items-center gap-3 p-3 text-left hover:bg-accent transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2 truncate">
                          <span className="truncate">{s.nome}</span>
                          {jaIncluido && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded shrink-0">incluído</span>}
                        </div>
                        {s.descricao && <div className="text-xs text-muted-foreground truncate">{s.descricao}</div>}
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="text-sm font-semibold">{formatCurrency(Number(s.preco_unitario))}</div>
                        <div className="text-[11px] text-muted-foreground">por {s.unidade}</div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground justify-self-end" />
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Itens selecionados */}
            <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Itens do orçamento ({itens.length})</h3>
              </div>

              {itens.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum item ainda. Clique nos serviços acima para adicionar.
                </div>
              ) : (
                <div className="space-y-2">
                  {itens.map((item, idx) => (
                    <div key={idx} className="rounded-md border bg-background p-3 grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 md:col-span-5">
                        <Label className="text-xs">Descrição</Label>
                        <Input value={item.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Label className="text-xs">Qtd</Label>
                        <div className="flex">
                          <Button type="button" size="icon" variant="outline" className="rounded-r-none h-10 w-9"
                            onClick={() => updateItem(idx, { quantidade: Math.max(0, Number(item.quantidade) - 1) })}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input type="number" step="0.01" className="rounded-none text-center"
                            value={item.quantidade}
                            onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })} />
                          <Button type="button" size="icon" variant="outline" className="rounded-l-none h-10 w-9"
                            onClick={() => updateItem(idx, { quantidade: Number(item.quantidade) + 1 })}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Label className="text-xs">Preço un. (R$)</Label>
                        <Input type="number" step="0.01" value={item.preco_unitario}
                          onChange={(e) => updateItem(idx, { preco_unitario: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-4 md:col-span-1">
                        <Label className="text-xs">Desc%</Label>
                        <Input type="number" step="1" min={0} max={100} value={item.desconto_pct}
                          onChange={(e) => updateItem(idx, { desconto_pct: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-10 md:col-span-1">
                        <Label className="text-xs">Subtotal</Label>
                        <div className="h-10 flex items-center px-2 rounded-md border bg-muted/50 text-sm font-semibold">
                          {formatCurrency(subtotal(item))}
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-end">
                        <Button type="button" size="icon" variant="ghost" onClick={() => removerItem(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <div className="text-lg font-bold">
                    TOTAL: <span className="text-primary">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <Label>Observações / Escopo de serviços</Label>
              <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </section>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                Salvar orçamento
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
