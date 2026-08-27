import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { format, addDays, isBefore, parseISO } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, Plus, CheckCircle2,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";

const fmt = formatCurrency;
const fmtDate = (d?: string | null) => formatDateBR(d);

type LancamentoForm = {
  tipo: "receita" | "despesa";
  status: "previsto" | "realizado" | "cancelado";
  descricao: string;
  valor: number;
  data_competencia: string;
  data_vencimento?: string | null;
  data_realizado?: string | null;
  fornecedor_nome?: string | null;
  documento_num?: string | null;
  forma_pagamento?: any;
  observacoes?: string | null;
  obra_id?: string | null;
  categoria_id?: string | null;
};

const emptyForm: LancamentoForm = {
  tipo: "despesa",
  status: "previsto",
  descricao: "",
  valor: 0,
  data_competencia: getTodayDateInputValue(),
  data_vencimento: null,
  data_realizado: null,
  fornecedor_nome: "",
  documento_num: "",
  forma_pagamento: null,
  observacoes: "",
  obra_id: null,
  categoria_id: null,
};

export default function Financeiro() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("visao-geral");
  const [openLanc, setOpenLanc] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LancamentoForm>(emptyForm);

  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroObra, setFiltroObra] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"venc_asc" | "venc_desc" | "valor_desc" | "valor_asc" | "criado_desc" | "criado_asc">("venc_asc");

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: fluxo = [] } = useQuery({
    queryKey: ["fluxo-caixa-mensal", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_fluxo_caixa_mensal" as any, {
        _empresa_id: empresaId!, _meses_atras: 5, _meses_frente: 3,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: dre = [] } = useQuery({
    queryKey: ["dre-obras", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dre_obra" as any, { _empresa_id: empresaId! });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ["lancamentos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lancamentos_financeiros")
        .select("*, categorias_financeiras(nome, cor), obras(codigo_chamado)")
        .order("data_vencimento", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: parcelas = [] } = useQuery({
    queryKey: ["parcelas-fin", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("parcelas_pagamento")
        .select("*, contratacoes_terceirizado(obra_id, obras(codigo_chamado), pessoas:terceirizado_id(nome))")
        .order("data_prevista", { ascending: true });
      return data ?? [];
    },
  });

  const { data: recebimentos = [] } = useQuery({
    queryKey: ["recebimentos-fin", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("recebimentos")
        .select("*, obras(codigo_chamado)")
        .order("data_prevista", { ascending: true });
      return data ?? [];
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-fin-select", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("obras").select("id, codigo_chamado, descricao_servico").order("codigo_chamado");
      return data ?? [];
    },
  });
  const obraLabel = (o: any) => {
    const desc = (o?.descricao_servico ?? "").trim();
    return desc ? `${o.codigo_chamado} — ${desc.length > 60 ? desc.slice(0, 60) + "…" : desc}` : o.codigo_chamado;
  };
  const [buscaObra, setBuscaObra] = useState("");
  const obrasFiltradas = useMemo(() => {
    const s = buscaObra.trim().toLowerCase();
    if (!s) return obras as any[];
    return (obras as any[]).filter((o) => obraLabel(o).toLowerCase().includes(s));
  }, [obras, buscaObra]);


  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-fin", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("categorias_financeiras").select("*").eq("ativo", true).order("nome");
      return (data ?? []) as any[];
    },
  });

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const all = lancamentos as any[];
    const receita_real =
      all.filter((l) => l.tipo === "receita" && l.status === "realizado").reduce((s, l) => s + Number(l.valor), 0)
      + (recebimentos as any[]).filter((r) => r.status === "recebido").reduce((s, r) => s + Number(r.valor), 0);

    const despesa_real =
      all.filter((l) => l.tipo === "despesa" && l.status === "realizado").reduce((s, l) => s + Number(l.valor), 0)
      + (parcelas as any[]).filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0);

    const receita_prev =
      all.filter((l) => l.tipo === "receita" && l.status === "previsto").reduce((s, l) => s + Number(l.valor), 0)
      + (recebimentos as any[]).filter((r) => r.status === "a_receber").reduce((s, r) => s + Number(r.valor), 0);

    const despesa_prev =
      all.filter((l) => l.tipo === "despesa" && l.status === "previsto").reduce((s, l) => s + Number(l.valor), 0)
      + (parcelas as any[]).filter((p) => p.status === "pendente").reduce((s, p) => s + Number(p.valor), 0);

    const margem = receita_real - despesa_real;
    const margem_pct = receita_real > 0 ? (margem / receita_real) * 100 : 0;

    const hoje = new Date();
    const limite7 = addDays(hoje, 7);
    const vencendo = (parcelas as any[])
      .filter((p) => p.status === "pendente" && p.data_prevista && isBefore(parseISO(p.data_prevista), limite7))
      .reduce((s, p) => s + Number(p.valor), 0);
    const vencidos =
      (parcelas as any[]).filter((p) => p.status === "pendente" && p.data_prevista && isBefore(parseISO(p.data_prevista), hoje)).length
      + all.filter((l) => l.tipo === "despesa" && l.status === "previsto" && l.data_vencimento && isBefore(parseISO(l.data_vencimento), hoje)).length;

    return { receita_real, despesa_real, receita_prev, despesa_prev, margem, margem_pct, vencendo, vencidos };
  }, [lancamentos, parcelas, recebimentos]);

  const lancFiltrados = useMemo(() => {
    const arr = (lancamentos as any[]).filter((l) => {
      if (filtroTipo !== "all" && l.tipo !== filtroTipo) return false;
      if (filtroStatus !== "all" && l.status !== filtroStatus) return false;
      if (filtroObra !== "all" && l.obra_id !== filtroObra) return false;
      if (search) {
        const s = search.toLowerCase();
        const ok = l.descricao?.toLowerCase().includes(s)
          || (l.fornecedor_nome ?? "").toLowerCase().includes(s)
          || (l.obras?.codigo_chamado ?? "").toLowerCase().includes(s);
        if (!ok) return false;
      }
      return true;
    });
    const cmpDate = (a: string | null, b: string | null, dir: 1 | -1) => {
      const va = a ? new Date(a).getTime() : (dir === 1 ? Infinity : -Infinity);
      const vb = b ? new Date(b).getTime() : (dir === 1 ? Infinity : -Infinity);
      return (va - vb) * dir;
    };
    arr.sort((a, b) => {
      switch (sortBy) {
        case "venc_asc":  return cmpDate(a.data_vencimento, b.data_vencimento, 1);
        case "venc_desc": return cmpDate(a.data_vencimento, b.data_vencimento, -1);
        case "valor_desc": return Number(b.valor) - Number(a.valor);
        case "valor_asc":  return Number(a.valor) - Number(b.valor);
        case "criado_desc": return cmpDate(a.created_at, b.created_at, -1);
        case "criado_asc":  return cmpDate(a.created_at, b.created_at, 1);
      }
    });
    return arr;
  }, [lancamentos, filtroTipo, filtroStatus, filtroObra, search, sortBy]);

  const proximosVenc = useMemo(() => {
    const hoje = new Date();
    const limite = addDays(hoje, 30);
    const itens: Array<{ data: Date; descricao: string; valor: number; tipo: string; vencido: boolean }> = [];

    (parcelas as any[]).filter((p) => p.status === "pendente" && p.data_prevista).forEach((p) => {
      const d = parseISO(p.data_prevista);
      if (isBefore(d, limite)) {
        itens.push({
          data: d,
          descricao: `${p.contratacoes_terceirizado?.pessoas?.nome ?? "Terceirizado"} — ${p.contratacoes_terceirizado?.obras?.codigo_chamado ?? ""}`,
          valor: Number(p.valor),
          tipo: "Parcela",
          vencido: isBefore(d, hoje),
        });
      }
    });

    (lancamentos as any[]).filter((l) => l.tipo === "despesa" && l.status === "previsto" && l.data_vencimento).forEach((l) => {
      const d = parseISO(l.data_vencimento);
      if (isBefore(d, limite)) {
        itens.push({
          data: d,
          descricao: l.descricao + (l.fornecedor_nome ? ` — ${l.fornecedor_nome}` : ""),
          valor: Number(l.valor),
          tipo: "Despesa",
          vencido: isBefore(d, hoje),
        });
      }
    });

    return itens.sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [parcelas, lancamentos]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const salvar = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, valor: Number(form.valor) || 0 };
      if (!payload.data_vencimento) payload.data_vencimento = null;
      if (!payload.data_realizado) payload.data_realizado = null;
      if (!payload.obra_id) payload.obra_id = null;
      if (!payload.categoria_id) payload.categoria_id = null;
      if (!payload.forma_pagamento) payload.forma_pagamento = null;

      if (editId) {
        const { error } = await (supabase as any)
          .from("lancamentos_financeiros").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("lancamentos_financeiros").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Lançamento atualizado" : "Lançamento criado");
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fluxo-caixa-mensal"] });
      qc.invalidateQueries({ queryKey: ["dre-obras"] });
      setOpenLanc(false); setEditId(null); setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const realizar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("lancamentos_financeiros")
        .update({ status: "realizado", data_realizado: getTodayDateInputValue() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como realizado");
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["fluxo-caixa-mensal"] });
      qc.invalidateQueries({ queryKey: ["dre-obras"] });
    },
  });

  const excluir = useMutation({
    mutationFn: async (l: any) => {
      // Lançamentos gerados por outras abas (recebimentos/parcelas) precisam ter
      // a origem apagada também, senão o DRE da obra continua mostrando o valor.
      if (l?.origem === "recebimento" && l?.origem_id) {
        const { error } = await (supabase as any).from("recebimentos").delete().eq("id", l.origem_id);
        if (error) throw error;
      } else if (l?.origem === "parcela" && l?.origem_id) {
        throw new Error("Este lançamento vem de uma parcela de contratação. Exclua a parcela na obra.");
      }
      const { data, error } = await (supabase as any)
        .from("lancamentos_financeiros").delete().eq("id", l.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Você não tem permissão para excluir este lançamento.");
    },
    onSuccess: () => {
      toast.success("Lançamento excluído");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNovo = () => { setEditId(null); setForm(emptyForm); setOpenLanc(true); };
  const openEditar = (l: any) => {
    setEditId(l.id);
    setForm({
      tipo: l.tipo, status: l.status, descricao: l.descricao, valor: Number(l.valor),
      data_competencia: l.data_competencia, data_vencimento: l.data_vencimento,
      data_realizado: l.data_realizado, fornecedor_nome: l.fornecedor_nome,
      documento_num: l.documento_num, forma_pagamento: l.forma_pagamento,
      observacoes: l.observacoes, obra_id: l.obra_id, categoria_id: l.categoria_id,
    });
    setOpenLanc(true);
  };

  const categoriasFiltradas = (categorias as any[]).filter((c) => c.tipo === form.tipo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Fluxo de caixa · DRE por obra · Contas a pagar/receber · Lançamentos
          </p>
        </div>
        <Button onClick={openNovo}>
          <Plus className="h-4 w-4 mr-1" /> Novo lançamento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Receita realizada" value={fmt(kpis.receita_real)} sub={`Previsto: ${fmt(kpis.receita_prev)}`} icon={ArrowUpRight} tone="emerald" />
        <Kpi label="Despesa realizada" value={fmt(kpis.despesa_real)} sub={`Previsto: ${fmt(kpis.despesa_prev)}`} icon={ArrowDownRight} tone="red" />
        <Kpi
          label="Margem bruta"
          value={fmt(kpis.margem)}
          sub={`${kpis.margem_pct.toFixed(1)}% de margem`}
          icon={kpis.margem >= 0 ? TrendingUp : TrendingDown}
          tone={kpis.margem >= 0 ? "emerald" : "red"}
        />
        <Kpi
          label="Vencendo (7 dias)"
          value={fmt(kpis.vencendo)}
          sub={kpis.vencidos > 0 ? `${kpis.vencidos} vencido(s)` : "Em dia"}
          icon={AlertTriangle}
          tone={kpis.vencidos > 0 ? "red" : "amber"}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="dre">DRE por obra</TabsTrigger>
          <TabsTrigger value="contas">Contas a pagar</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="text-base">Receitas × Despesas</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fluxo}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="receitas_real" name="Receitas" fill="hsl(var(--primary))" />
                      <Bar dataKey="despesas_real" name="Despesas" fill="hsl(var(--destructive))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Próximos vencimentos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-auto">
                {proximosVenc.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhum vencimento nos próximos 30 dias
                  </p>
                )}
                {proximosVenc.slice(0, 15).map((it, i) => (
                  <div key={i} className={cn("rounded-md border p-2", it.vencido && "border-red-300 bg-red-50/50 dark:bg-red-950/20")}>
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-xs font-medium truncate flex-1">{it.descricao}</p>
                      <p className="text-xs font-semibold whitespace-nowrap">{fmt(it.valor)}</p>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{it.tipo}</Badge>
                      <span className={cn("text-[10px] text-muted-foreground", it.vencido && "text-red-600 font-medium")}>
                        {format(it.data, "dd/MM/yyyy")}{it.vencido ? " ⚠ vencido" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Saldo acumulado</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fluxo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                    <Line type="monotone" dataKey="saldo_acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Saldo acumulado" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fluxo de caixa */}
        <TabsContent value="fluxo" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Previsto vs realizado</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fluxo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="receitas_prev" name="Rec. previstas" fill="#86efac" />
                    <Bar dataKey="receitas_real" name="Rec. realizadas" fill="#16a34a" />
                    <Bar dataKey="despesas_prev" name="Desp. previstas" fill="#fca5a5" />
                    <Bar dataKey="despesas_real" name="Desp. realizadas" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Rec. prev.</TableHead>
                  <TableHead className="text-right">Rec. real</TableHead>
                  <TableHead className="text-right">Desp. prev.</TableHead>
                  <TableHead className="text-right">Desp. real</TableHead>
                  <TableHead className="text-right">Saldo prev.</TableHead>
                  <TableHead className="text-right">Saldo real</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(fluxo as any[]).map((m) => (
                  <TableRow key={`${m.ano}-${m.mes_num}`}>
                    <TableCell className="font-medium">{m.mes}</TableCell>
                    <TableCell className="text-right">{fmt(m.receitas_prev)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmt(m.receitas_real)}</TableCell>
                    <TableCell className="text-right">{fmt(m.despesas_prev)}</TableCell>
                    <TableCell className="text-right text-red-700">{fmt(m.despesas_real)}</TableCell>
                    <TableCell className={cn("text-right", Number(m.saldo_prev) >= 0 ? "text-emerald-700" : "text-red-700")}>{fmt(m.saldo_prev)}</TableCell>
                    <TableCell className={cn("text-right font-medium", Number(m.saldo_real) >= 0 ? "text-emerald-700" : "text-red-700")}>{fmt(m.saldo_real)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", Number(m.saldo_acumulado) >= 0 ? "text-emerald-700" : "text-red-700")}>{fmt(m.saldo_acumulado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* DRE por obra */}
        <TabsContent value="dre">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obra</TableHead>
                  <TableHead className="text-right">Rec. contratada</TableHead>
                  <TableHead className="text-right">Rec. medida</TableHead>
                  <TableHead className="text-right">Rec. recebida</TableHead>
                  <TableHead className="text-right">Custo subcont.</TableHead>
                  <TableHead className="text-right">Materiais</TableHead>
                  <TableHead className="text-right">Custo total</TableHead>
                  <TableHead className="text-right">Margem bruta</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dre as any[]).length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Sem dados de DRE ainda</TableCell></TableRow>
                )}
                {(dre as any[]).map((row) => (
                  <TableRow key={row.obra_id}>
                    <TableCell className="font-medium">{row.obra_codigo}</TableCell>
                    <TableCell className="text-right">{fmt(row.receita_contratada)}</TableCell>
                    <TableCell className="text-right">{fmt(row.receita_medida)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmt(row.receita_recebida)}</TableCell>
                    <TableCell className="text-right">{fmt(row.custo_subcontratado)}</TableCell>
                    <TableCell className="text-right">{fmt(row.custo_materiais)}</TableCell>
                    <TableCell className="text-right text-red-700">{fmt(row.custo_total_real)}</TableCell>
                    <TableCell className={cn("text-right font-medium", Number(row.margem_bruta) >= 0 ? "text-emerald-700" : "text-red-700")}>{fmt(row.margem_bruta)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        Number(row.margem_pct) >= 20 ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                          : Number(row.margem_pct) >= 0 ? "border-amber-500 text-amber-700 bg-amber-50"
                          : "border-red-500 text-red-700 bg-red-50"
                      )}>
                        {Number(row.margem_pct ?? 0).toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Contas a pagar */}
        <TabsContent value="contas">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obra</TableHead>
                  <TableHead>Terceirizado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(parcelas as any[]).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sem parcelas</TableCell></TableRow>
                )}
                {(parcelas as any[]).map((p) => {
                  const venc = p.data_prevista ? parseISO(p.data_prevista) : null;
                  const vencido = p.status === "pendente" && venc && isBefore(venc, new Date());
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.contratacoes_terceirizado?.obras?.codigo_chamado ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.contratacoes_terceirizado?.pessoas?.nome ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(p.valor)}</TableCell>
                      <TableCell className={cn("text-sm", vencido && "text-red-600 font-medium")}>
                        {fmtDate(p.data_prevista)}{vencido ? " ⚠" : ""}
                      </TableCell>
                      <TableCell className="text-sm">{p.forma_pagamento ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          p.status === "pago" ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                            : vencido ? "border-red-500 text-red-700 bg-red-50"
                            : "border-amber-500 text-amber-700 bg-amber-50"
                        )}>
                          {p.status === "pago" ? "✓ Pago" : vencido ? "Vencido" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Lançamentos */}
        <TabsContent value="lancamentos" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-[220px]" />
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroObra} onValueChange={setFiltroObra}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as obras</SelectItem>
                {(obras as any[]).map((o) => (
                  <SelectItem key={o.id} value={o.id}>{obraLabel(o)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="venc_asc">Vencimento ↑ (próximos)</SelectItem>
                <SelectItem value="venc_desc">Vencimento ↓</SelectItem>
                <SelectItem value="valor_desc">Maior valor</SelectItem>
                <SelectItem value="valor_asc">Menor valor</SelectItem>
                <SelectItem value="criado_desc">Mais recentes</SelectItem>
                <SelectItem value="criado_asc">Mais antigos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancFiltrados.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhum lançamento</TableCell></TableRow>
                )}
                {lancFiltrados.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{l.descricao}</div>
                      {l.fornecedor_nome && <div className="text-xs text-muted-foreground">{l.fornecedor_nome}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{l.categorias_financeiras?.nome ?? "—"}</TableCell>
                    <TableCell className="text-xs">{l.obras?.codigo_chamado ?? "—"}</TableCell>
                    <TableCell className="text-xs">{fmtDate(l.data_vencimento)}</TableCell>
                    <TableCell className={cn("text-right font-medium", l.tipo === "receita" ? "text-emerald-700" : "text-red-700")}>
                      {l.tipo === "receita" ? "+" : "-"} {fmt(l.valor)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        l.tipo === "receita" ? "border-emerald-500 text-emerald-700" : "border-red-500 text-red-700"
                      )}>
                        {l.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        l.status === "realizado" ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                          : l.status === "cancelado" ? "border-muted text-muted-foreground"
                          : "border-amber-500 text-amber-700 bg-amber-50"
                      )}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {l.status === "previsto" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700"
                                onClick={() => realizar.mutate(l.id)} title="Marcar como realizado">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEditar(l)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600"
                              onClick={() => { if (confirm("Excluir lançamento?")) excluir.mutate(l); }}>
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Lançamento */}
      <Dialog open={openLanc} onOpenChange={(o) => { setOpenLanc(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v, categoria_id: null })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="previsto">Previsto</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor}
                     onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria_id ?? ""} onValueChange={(v) => setForm({ ...form, categoria_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categoriasFiltradas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data competência *</Label>
              <Input type="date" value={form.data_competencia}
                     onChange={(e) => setForm({ ...form, data_competencia: e.target.value })} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={form.data_vencimento ?? ""}
                     onChange={(e) => setForm({ ...form, data_vencimento: e.target.value || null })} />
            </div>
            <div>
              <Label>Data realizado</Label>
              <Input type="date" value={form.data_realizado ?? ""}
                     onChange={(e) => setForm({ ...form, data_realizado: e.target.value || null })} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.forma_pagamento ?? ""} onValueChange={(v) => setForm({ ...form, forma_pagamento: v || null })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>
                Obra vinculada {form.tipo === "despesa" && <span className="text-muted-foreground">(recomendado)</span>}
              </Label>
              <Select
                value={form.obra_id ?? "__none__"}
                onValueChange={(v) => setForm({ ...form, obra_id: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a obra..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <div className="p-2">
                    <Input
                      autoFocus
                      placeholder="Buscar obra..."
                      value={buscaObra}
                      onChange={(e) => setBuscaObra(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-8"
                    />
                  </div>
                  <SelectItem value="__none__">Sem obra (despesa geral)</SelectItem>
                  {obrasFiltradas.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{obraLabel(o)}</SelectItem>
                  ))}
                  {obrasFiltradas.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma obra encontrada</p>
                  )}
                </SelectContent>
              </Select>
              {form.tipo === "despesa" && !form.obra_id && (
                <p className="mt-1 text-xs text-amber-600">
                  Sem obra vinculada esta despesa não entra no balanço de nenhuma obra.
                </p>
              )}
            </div>

            <div>
              <Label>Fornecedor / cliente</Label>
              <Input value={form.fornecedor_nome ?? ""}
                     onChange={(e) => setForm({ ...form, fornecedor_nome: e.target.value })} />
            </div>
            <div>
              <Label>Documento (NF, boleto, etc)</Label>
              <Input value={form.documento_num ?? ""}
                     onChange={(e) => setForm({ ...form, documento_num: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes ?? ""}
                        onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenLanc(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={!form.descricao || !form.valor || salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: any; tone: "emerald" | "red" | "amber" | "blue" }) {
  const cls = {
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    red: "bg-red-500/15 text-red-700 dark:text-red-300",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold mt-1">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("h-8 w-8 rounded-md flex items-center justify-center", cls)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
