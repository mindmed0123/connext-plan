export interface EtapaCronograma {
  id: string;
  nome: string;
  data_inicio: string; // yyyy-mm-dd — data desejada, usada como piso
  duracao_dias: number;
  valor_previsto?: number;
  percentual_previsto?: number;
  percentual_realizado?: number;
}

export interface DependenciaCronograma {
  etapa_id: string; // sucessora
  depende_de_etapa_id: string; // predecessora
  tipo: "FI" | "II";
  folga_dias: number;
}

export interface EtapaCalculada extends EtapaCronograma {
  inicio: number; // dias a partir do início do projeto
  fim: number;
  folga: number;
  critica: boolean;
  data_inicio_calc: string;
  data_fim_calc: string;
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

/**
 * Ordena as etapas de modo que toda predecessora venha antes da sucessora.
 * Lança erro quando as dependências formam uma referência circular.
 */
export function ordenarTopologico(
  etapas: EtapaCronograma[],
  deps: DependenciaCronograma[],
): EtapaCronograma[] {
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const predecessoras = new Map<string, string[]>();
  for (const d of deps) {
    if (!porId.has(d.etapa_id) || !porId.has(d.depende_de_etapa_id)) continue;
    predecessoras.set(d.etapa_id, [...(predecessoras.get(d.etapa_id) ?? []), d.depende_de_etapa_id]);
  }

  const ordem: EtapaCronograma[] = [];
  const visitando = new Set<string>();
  const pronto = new Set<string>();

  const visita = (id: string) => {
    if (pronto.has(id)) return;
    if (visitando.has(id)) {
      throw new Error("Dependência circular no cronograma: uma etapa acabaria dependendo dela mesma.");
    }
    visitando.add(id);
    for (const p of predecessoras.get(id) ?? []) visita(p);
    visitando.delete(id);
    pronto.add(id);
    ordem.push(porId.get(id)!);
  };

  for (const e of etapas) visita(e.id);
  return ordem;
}

/** Detecta se ligar `predecessora -> sucessora` fecharia um ciclo. */
export function criaCiclo(
  deps: DependenciaCronograma[],
  predecessora: string,
  sucessora: string,
): boolean {
  if (predecessora === sucessora) return true;
  const ids = new Set<string>([predecessora, sucessora]);
  for (const d of deps) {
    ids.add(d.etapa_id);
    ids.add(d.depende_de_etapa_id);
  }
  const etapas = [...ids].map((id) => ({ id, nome: id, data_inicio: "2026-01-01", duracao_dias: 1 }));
  try {
    ordenarTopologico(etapas, [
      ...deps,
      { etapa_id: sucessora, depende_de_etapa_id: predecessora, tipo: "FI", folga_dias: 0 },
    ]);
    return false;
  } catch {
    return true;
  }
}

export interface ResultadoGantt {
  etapas: EtapaCalculada[];
  duracaoTotal: number;
  inicioProjeto: string;
}

/** CPM sobre dias corridos: datas cedo, datas tarde, folga e caminho crítico. */
export function calcularGantt(
  etapas: EtapaCronograma[],
  deps: DependenciaCronograma[],
): ResultadoGantt {
  if (etapas.length === 0) return { etapas: [], duracaoTotal: 0, inicioProjeto: "" };

  const ordem = ordenarTopologico(etapas, deps);
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const inicioProjeto = etapas.map((e) => e.data_inicio).sort()[0];
  const dur = (e: EtapaCronograma) => Math.max(Number(e.duracao_dias) || 0, 0);

  const predecessoras = new Map<string, DependenciaCronograma[]>();
  const sucessoras = new Map<string, DependenciaCronograma[]>();
  for (const d of deps) {
    if (!porId.has(d.etapa_id) || !porId.has(d.depende_de_etapa_id)) continue;
    predecessoras.set(d.etapa_id, [...(predecessoras.get(d.etapa_id) ?? []), d]);
    sucessoras.set(d.depende_de_etapa_id, [...(sucessoras.get(d.depende_de_etapa_id) ?? []), d]);
  }

  const cedoIni: Record<string, number> = {};
  const cedoFim: Record<string, number> = {};
  for (const e of ordem) {
    let ini = diffDias(inicioProjeto, e.data_inicio);
    for (const d of predecessoras.get(e.id) ?? []) {
      const p = porId.get(d.depende_de_etapa_id)!;
      const base = d.tipo === "II" ? cedoIni[p.id] : cedoFim[p.id];
      ini = Math.max(ini, base + (Number(d.folga_dias) || 0));
    }
    cedoIni[e.id] = ini;
    cedoFim[e.id] = ini + dur(e);
  }

  const duracaoTotal = Math.max(...etapas.map((e) => cedoFim[e.id]));

  const tardeFim: Record<string, number> = {};
  for (const e of [...ordem].reverse()) {
    const suc = sucessoras.get(e.id) ?? [];
    if (suc.length === 0) {
      tardeFim[e.id] = duracaoTotal;
      continue;
    }
    let fim = Infinity;
    for (const d of suc) {
      const s = porId.get(d.etapa_id)!;
      const sTardeIni = tardeFim[s.id] - dur(s);
      const limite = d.tipo === "II"
        ? sTardeIni + dur(e) - (Number(d.folga_dias) || 0)
        : sTardeIni - (Number(d.folga_dias) || 0);
      fim = Math.min(fim, limite);
    }
    tardeFim[e.id] = fim;
  }

  const calculadas: EtapaCalculada[] = etapas.map((e) => {
    const folga = Math.round(tardeFim[e.id] - cedoFim[e.id]);
    return {
      ...e,
      inicio: cedoIni[e.id],
      fim: cedoFim[e.id],
      folga,
      critica: folga <= 0,
      data_inicio_calc: somarDias(inicioProjeto, cedoIni[e.id]),
      data_fim_calc: somarDias(inicioProjeto, cedoFim[e.id]),
    };
  });

  return { etapas: calculadas, duracaoTotal, inicioProjeto };
}

export interface PrevistoMes {
  mes: string; // primeiro dia do mês, yyyy-mm-01
  valor: number;
}

/** Distribui o valor previsto de cada etapa, dia a dia, pelos meses que ela atravessa. */
export function previstoMensal(etapas: EtapaCalculada[]): PrevistoMes[] {
  const meses = new Map<string, number>();
  for (const e of etapas) {
    const valor = Number(e.valor_previsto ?? 0);
    if (!valor) continue;
    const dias = Math.max(dias_de(e), 1);
    const porDia = valor / dias;
    for (let k = 0; k < dias; k++) {
      const iso = somarDias(e.data_inicio_calc, k);
      const mes = `${iso.slice(0, 7)}-01`;
      meses.set(mes, (meses.get(mes) ?? 0) + porDia);
    }
  }
  return [...meses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }));
}

function dias_de(e: EtapaCalculada): number {
  return Math.max(Number(e.duracao_dias) || 0, 0);
}

export interface PontoCurvaS {
  mes: string;
  previsto: number;
  realizado: number;
  previstoAcum: number;
  realizadoAcum: number;
}

/** Curva S: previsto e realizado por mês, com acumulado. */
export function curvaS(etapas: EtapaCalculada[]): PontoCurvaS[] {
  const previsto = previstoMensal(etapas);
  const realizadoPorMes = new Map<string, number>();
  for (const e of etapas) {
    const valor = (Number(e.valor_previsto ?? 0) * Number(e.percentual_realizado ?? 0)) / 100;
    if (!valor) continue;
    const dias = Math.max(dias_de(e), 1);
    const porDia = valor / dias;
    for (let k = 0; k < dias; k++) {
      const mes = `${somarDias(e.data_inicio_calc, k).slice(0, 7)}-01`;
      realizadoPorMes.set(mes, (realizadoPorMes.get(mes) ?? 0) + porDia);
    }
  }
  let pa = 0;
  let ra = 0;
  return previsto.map((p) => {
    const r = Math.round((realizadoPorMes.get(p.mes) ?? 0) * 100) / 100;
    pa += p.valor;
    ra += r;
    return {
      mes: p.mes,
      previsto: p.valor,
      realizado: r,
      previstoAcum: Math.round(pa * 100) / 100,
      realizadoAcum: Math.round(ra * 100) / 100,
    };
  });
}
