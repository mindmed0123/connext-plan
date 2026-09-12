export interface TarefaGantt {
  id: string;
  nome: string;
  inicio: string; // yyyy-mm-dd
  fim: string; // yyyy-mm-dd
  percentual_previsto: number;
  percentual_realizado: number;
  valor_previsto: number;
}

export interface DependenciaGantt {
  etapa_id: string; // sucessora
  depende_de_etapa_id: string; // predecessora
  tipo: "FI" | "II";
  folga_dias: number;
}

export const DIA_MS = 86_400_000;

export function paraData(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, (m ?? 1) - 1, d ?? 1));
}

export function paraIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  return paraIso(new Date(paraData(iso).getTime() + dias * DIA_MS));
}

export function diffDias(a: string, b: string): number {
  return Math.round((paraData(b).getTime() - paraData(a).getTime()) / DIA_MS);
}

/** Detecta se ligar `de -> para` fecharia um ciclo nas dependências existentes. */
export function criaCiclo(deps: DependenciaGantt[], predecessora: string, sucessora: string): boolean {
  if (predecessora === sucessora) return true;
  const adj = new Map<string, string[]>();
  for (const d of [...deps, { depende_de_etapa_id: predecessora, etapa_id: sucessora } as DependenciaGantt]) {
    const lista = adj.get(d.depende_de_etapa_id) ?? [];
    lista.push(d.etapa_id);
    adj.set(d.depende_de_etapa_id, lista);
  }
  const visitando = new Set<string>();
  const pronto = new Set<string>();
  const visita = (no: string): boolean => {
    if (visitando.has(no)) return true;
    if (pronto.has(no)) return false;
    visitando.add(no);
    for (const p of adj.get(no) ?? []) if (visita(p)) return true;
    visitando.delete(no);
    pronto.add(no);
    return false;
  };
  return visita(predecessora);
}

export interface ResultadoCpm {
  folga: Record<string, number>;
  critica: Set<string>;
  inicioProjeto: string;
  fimProjeto: string;
}

/** CPM simples sobre datas de calendário (sem calendário de feriados). */
export function caminhoCritico(tarefas: TarefaGantt[], deps: DependenciaGantt[]): ResultadoCpm {
  if (tarefas.length === 0) {
    return { folga: {}, critica: new Set(), inicioProjeto: "", fimProjeto: "" };
  }
  const porId = new Map(tarefas.map((t) => [t.id, t]));
  const sucessoras = new Map<string, DependenciaGantt[]>();
  const predecessoras = new Map<string, DependenciaGantt[]>();
  for (const d of deps) {
    if (!porId.has(d.etapa_id) || !porId.has(d.depende_de_etapa_id)) continue;
    sucessoras.set(d.depende_de_etapa_id, [...(sucessoras.get(d.depende_de_etapa_id) ?? []), d]);
    predecessoras.set(d.etapa_id, [...(predecessoras.get(d.etapa_id) ?? []), d]);
  }

  const inicioProjeto = tarefas.map((t) => t.inicio).sort()[0];
  const duracao = (t: TarefaGantt) => Math.max(diffDias(t.inicio, t.fim), 0);

  // Datas cedo (forward pass), em dias a partir do início do projeto.
  const cedoIni: Record<string, number> = {};
  const cedoFim: Record<string, number> = {};
  const resolver = (id: string, pilha = new Set<string>()): number => {
    if (cedoIni[id] !== undefined) return cedoIni[id];
    if (pilha.has(id)) return diffDias(inicioProjeto, porId.get(id)!.inicio);
    pilha.add(id);
    const t = porId.get(id)!;
    let ini = diffDias(inicioProjeto, t.inicio);
    for (const d of predecessoras.get(id) ?? []) {
      const p = porId.get(d.depende_de_etapa_id)!;
      const pIni = resolver(p.id, pilha);
      const base = d.tipo === "II" ? pIni : pIni + duracao(p);
      ini = Math.max(ini, base + (d.folga_dias ?? 0));
    }
    cedoIni[id] = ini;
    cedoFim[id] = ini + duracao(t);
    return ini;
  };
  for (const t of tarefas) resolver(t.id);

  const fimProjetoDias = Math.max(...tarefas.map((t) => cedoFim[t.id]));

  // Datas tarde (backward pass).
  const tardeFim: Record<string, number> = {};
  const calcTarde = (id: string, pilha = new Set<string>()): number => {
    if (tardeFim[id] !== undefined) return tardeFim[id];
    if (pilha.has(id)) return fimProjetoDias;
    pilha.add(id);
    const suc = sucessoras.get(id) ?? [];
    let fim = suc.length ? Infinity : fimProjetoDias;
    for (const d of suc) {
      const s = porId.get(d.etapa_id)!;
      const sTarde = calcTarde(s.id, pilha) - duracao(s);
      fim = Math.min(fim, d.tipo === "II" ? sTarde + duracao(porId.get(id)!) - (d.folga_dias ?? 0) : sTarde - (d.folga_dias ?? 0));
    }
    tardeFim[id] = fim === Infinity ? fimProjetoDias : fim;
    return tardeFim[id];
  };
  for (const t of tarefas) calcTarde(t.id);

  const folga: Record<string, number> = {};
  const critica = new Set<string>();
  for (const t of tarefas) {
    const f = Math.round(tardeFim[t.id] - cedoFim[t.id]);
    folga[t.id] = f;
    if (f <= 0) critica.add(t.id);
  }

  return {
    folga,
    critica,
    inicioProjeto,
    fimProjeto: somarDias(inicioProjeto, fimProjetoDias),
  };
}

export interface PontoCurvaS {
  mes: string;
  previsto: number;
  realizado: number;
  previstoAcum: number;
  realizadoAcum: number;
}

/** Distribui o valor de cada tarefa linearmente pelos meses que ela atravessa. */
export function curvaS(tarefas: TarefaGantt[]): PontoCurvaS[] {
  const meses = new Map<string, { previsto: number; realizado: number }>();
  for (const t of tarefas) {
    const dias = Math.max(diffDias(t.inicio, t.fim), 1);
    const porDia = Number(t.valor_previsto || 0) / dias;
    for (let k = 0; k < dias; k++) {
      const iso = somarDias(t.inicio, k);
      const mes = iso.slice(0, 7);
      const atual = meses.get(mes) ?? { previsto: 0, realizado: 0 };
      atual.previsto += porDia;
      atual.realizado += (porDia * Number(t.percentual_realizado || 0)) / 100;
      meses.set(mes, atual);
    }
  }
  let pa = 0;
  let ra = 0;
  return [...meses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      pa += v.previsto;
      ra += v.realizado;
      return {
        mes,
        previsto: Math.round(v.previsto * 100) / 100,
        realizado: Math.round(v.realizado * 100) / 100,
        previstoAcum: Math.round(pa * 100) / 100,
        realizadoAcum: Math.round(ra * 100) / 100,
      };
    });
}
