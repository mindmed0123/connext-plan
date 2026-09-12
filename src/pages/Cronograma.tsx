import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useObraConfig } from "@/hooks/useObraConfig";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  calcularGantt, criaCiclo, curvaS, diffDias, somarDias,
  type DependenciaCronograma, type EtapaCronograma,
} from "@/lib/gantt";
import { formatCurrency } from "@/lib/obra-helpers";

interface LinhaCronograma {
  id: string;
  obra_id: string;
  etapa_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  duracao_dias: number | null;
  valor_previsto: number | null;
  percentual_previsto: number | null;
  percentual_realizado: number | null;
  mes: string | null;
}

const LARGURA_DIA = 14;

export default function Cronograma() {
  const { empresaId } = useAuth();
  const { rotulos } = useObraConfig();
  const qc = useQueryClient();
  const [obraId, setObraId] = useState("");
  const [novaDep, setNovaDep] = useState({ etapa_id: "", depende_de_etapa_id: "", tipo: "FI", folga_dias: "0" });
  const areaRef = useRef<HTMLDivElement>(null);

  const { data: obras = [] } = useQuery({
    queryKey: [empresaId, "obras", "cronograma"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, codigo_chamado, descricao_servico")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as { id: string; codigo_chamado: string; descricao_servico: string }[];
    },
  });

  const { data: linhas = [] } = useQuery({
    queryKey: [empresaId, "cronograma-etapas", obraId],
    enabled: !!empresaId && !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase.from("cronograma_etapas").select("*").eq("obra_id", obraId);
      if (error) throw error;
      return (data ?? []) as unknown as LinhaCronograma[];
    },
  });

  const { data: etapasObra = [] } = useQuery({
    queryKey: [empresaId, "obra-etapas", obraId],
    enabled: !!empresaId && !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase.from("obra_etapas").select("id, nome, ordem").eq("obra_id", obraId).order("ordem");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; ordem: number }[];
    },
  });

  const { data: deps = [] } = useQuery({
    queryKey: [empresaId, "cronograma-dependencias", obraId],
    enabled: !!empresaId && !!obraId,
    queryFn: async () => {
      const ids = linhas.map((l) => l.id);
      if (!ids.length) return [];
      const { data, error } = await supabase.from("cronograma_dependencias").select("*").in("etapa_id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as (DependenciaCronograma & { id: string })[];
    },
  });

  const nomeEtapa = useMemo(() => new Map(etapasObra.map((e) => [e.id, e.nome])), [etapasObra]);

  const entrada: EtapaCronograma[] = linhas.map((l) => ({
    id: l.id,
    nome: (l.etapa_id && nomeEtapa.get(l.etapa_id)) || "Etapa sem nome",
    data_inicio: l.data_inicio ?? l.mes ?? new Date().toISOString().slice(0, 10),
    duracao_dias: Number(l.duracao_dias ?? (l.data_inicio && l.data_fim ? diffDias(l.data_inicio, l.data_fim) : 0)),
    valor_previsto: Number(l.valor_previsto ?? 0),
    percentual_previsto: Number(l.percentual_previsto ?? 0),
    percentual_realizado: Number(l.percentual_realizado ?? 0),
  }));

  let resultado;
  let erroCiclo: string | null = null;
  try {
    resultado = calcularGantt(entrada, deps);
  } catch (e) {
    erroCiclo = e instanceof Error ? e.message : "Dependência circular.";
    resultado = { etapas: [], duracaoTotal: 0, inicioProjeto: "" };
  }
  const pontos = curvaS(resultado.etapas);

  const salvarDatas = useMutation({
    mutationFn: async (p: { id: string; inicio: string; duracao: number }) => {
      const { error } = await supabase
        .from("cronograma_etapas")
        .update({ data_inicio: p.inicio, data_fim: somarDias(p.inicio, p.duracao), duracao_dias: p.duracao } as never)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [empresaId, "cronograma-etapas", obraId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const criarDep = useMutation({
    mutationFn: async () => {
      if (!novaDep.etapa_id || !novaDep.depende_de_etapa_id) throw new Error("Escolha as duas etapas.");
      if (criaCiclo(deps, novaDep.depende_de_etapa_id, novaDep.etapa_id)) {
        throw new Error("Essa ligação fecharia um ciclo: a etapa acabaria dependendo dela mesma.");
      }
      const { error } = await supabase.from("cronograma_dependencias").insert({
        empresa_id: empresaId,
        etapa_id: novaDep.etapa_id,
        depende_de_etapa_id: novaDep.depende_de_etapa_id,
        tipo: novaDep.tipo,
        folga_dias: Number(novaDep.folga_dias) || 0,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      setNovaDep({ etapa_id: "", depende_de_etapa_id: "", tipo: "FI", folga_dias: "0" });
      await qc.invalidateQueries({ queryKey: [empresaId, "cronograma-dependencias", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerDep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cronograma_dependencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [empresaId, "cronograma-dependencias", obraId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const arrastar = (id: string, inicioAtual: string, duracao: number) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    const x0 = ev.clientX;
    const mover = (e: MouseEvent) => {
      const delta = Math.round((e.clientX - x0) / LARGURA_DIA);
      const barra = document.getElementById(`barra-${id}`);
      if (barra) barra.style.transform = `translateX(${delta * LARGURA_DIA}px)`;
    };
    const soltar = (e: MouseEvent) => {
      document.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseup", soltar);
      const barra = document.getElementById(`barra-${id}`);
      if (barra) barra.style.transform = "";
      const delta = Math.round((e.clientX - x0) / LARGURA_DIA);
      if (delta !== 0) salvarDatas.mutate({ id, inicio: somarDias(inicioAtual, delta), duracao });
    };
    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", soltar);
  };

  const redimensionar = (id: string, inicio: string, duracao: number) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    const x0 = ev.clientX;
    const soltar = (e: MouseEvent) => {
      document.removeEventListener("mouseup", soltar);
      const delta = Math.round((e.clientX - x0) / LARGURA_DIA);
      const nova = Math.max(duracao + delta, 1);
      if (nova !== duracao) salvarDatas.mutate({ id, inicio, duracao: nova });
    };
    document.addEventListener("mouseup", soltar);
  };

  const exportarPng = async () => {
    if (!areaRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(areaRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = `cronograma-${obraId.slice(0, 8)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast.error("Não consegui gerar a imagem do cronograma.");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cronograma</h1>
          <p className="text-sm text-muted-foreground">
            Barras por etapa, dependências, caminho crítico e curva S. Arraste a barra para mudar a data e puxe a
            borda direita para mudar a duração.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{rotulos.obra_singular}</Label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Escolher…" /></SelectTrigger>
              <SelectContent>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.codigo_chamado} · {o.descricao_servico}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => void exportarPng()} disabled={!obraId}>
            <Download className="mr-2 h-4 w-4" /> Exportar imagem
          </Button>
        </div>
      </header>

      {!obraId && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Escolha {rotulos.obra_singular.toLowerCase()} para ver o cronograma.
        </CardContent></Card>
      )}

      {obraId && erroCiclo && (
        <Card><CardContent className="py-6 text-sm text-destructive">{erroCiclo}</CardContent></Card>
      )}

      {obraId && !erroCiclo && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Gantt · {resultado.duracaoTotal} dias
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  barra vermelha = caminho crítico (atraso nela atrasa a entrega)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={areaRef} className="overflow-x-auto bg-background p-2">
                <div className="min-w-fit space-y-1">
                  {resultado.etapas.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma etapa com data no cronograma desta obra.
                    </p>
                  )}
                  {resultado.etapas.map((e) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <div className="w-48 shrink-0 truncate text-sm">{e.nome}</div>
                      <div className="relative h-7 flex-1" style={{ minWidth: (resultado.duracaoTotal + 2) * LARGURA_DIA }}>
                        <div
                          id={`barra-${e.id}`}
                          onMouseDown={arrastar(e.id, e.data_inicio_calc, Math.max(e.duracao_dias, 1))}
                          className={`absolute top-1 flex h-5 cursor-grab items-center rounded ${
                            e.critica ? "bg-destructive" : "bg-primary"
                          }`}
                          style={{
                            left: e.inicio * LARGURA_DIA,
                            width: Math.max(e.duracao_dias, 1) * LARGURA_DIA,
                          }}
                          title={`${e.data_inicio_calc} a ${e.data_fim_calc} · folga ${e.folga} dia(s)`}
                        >
                          <div
                            className="h-full rounded-l bg-primary-foreground/40"
                            style={{ width: `${Math.min(Number(e.percentual_realizado ?? 0), 100)}%` }}
                          />
                          <span
                            onMouseDown={redimensionar(e.id, e.data_inicio_calc, Math.max(e.duracao_dias, 1))}
                            className="absolute right-0 h-full w-2 cursor-ew-resize rounded-r bg-foreground/20"
                          />
                        </div>
                      </div>
                      <Badge variant={e.critica ? "destructive" : "outline"} className="shrink-0">
                        {e.critica ? "crítica" : `folga ${e.folga}d`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Curva S (acumulado)</CardTitle></CardHeader>
              <CardContent className="h-64">
                {pontos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem valor previsto nas etapas.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pontos}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tickFormatter={(m: string) => m.slice(0, 7)} fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                      <Area type="monotone" dataKey="previstoAcum" name="Previsto" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                      <Area type="monotone" dataKey="realizadoAcum" name="Realizado" stroke="hsl(var(--chart-2, var(--primary)))" fill="hsl(var(--primary) / 0.08)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Dependências</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select value={novaDep.depende_de_etapa_id} onValueChange={(v) => setNovaDep({ ...novaDep, depende_de_etapa_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Depois de…" /></SelectTrigger>
                    <SelectContent>
                      {resultado.etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={novaDep.etapa_id} onValueChange={(v) => setNovaDep({ ...novaDep, etapa_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Começa a etapa…" /></SelectTrigger>
                    <SelectContent>
                      {resultado.etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={novaDep.tipo} onValueChange={(v) => setNovaDep({ ...novaDep, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FI">Só começa quando a outra terminar</SelectItem>
                      <SelectItem value="II">Começa junto com a outra</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => criarDep.mutate()} disabled={criarDep.isPending}>
                    <Plus className="mr-2 h-4 w-4" /> Ligar
                  </Button>
                </div>

                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Depois de</TableHead><TableHead>Começa</TableHead><TableHead>Tipo</TableHead><TableHead />
                  </TableRow></TableHeader>
                  <TableBody>
                    {deps.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">Sem ligações.</TableCell></TableRow>
                    )}
                    {deps.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{resultado.etapas.find((e) => e.id === d.depende_de_etapa_id)?.nome ?? "—"}</TableCell>
                        <TableCell>{resultado.etapas.find((e) => e.id === d.etapa_id)?.nome ?? "—"}</TableCell>
                        <TableCell>{d.tipo === "FI" ? "após terminar" : "junto"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => removerDep.mutate(d.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
