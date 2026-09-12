/**
 * Cálculo de cronograma (Gantt): datas propagadas pelas dependências,
 * folga por etapa e caminho crítico. Funções puras, espelhando o que o
 * usuário vê na tela — sem acesso a banco.
 */

export type TipoDependencia = "FI" | "II";

export interface EtapaGantt {
  id: string;
  nome: string;
  data_inicio: string; // yyyy-mm-dd
  duracao_dias: number;
  percentual_realizado?: number;
  valor_previsto?: number;
}

export interface DependenciaGantt {
  etapa_id: string;
  depende_de_etapa_id: string;
  tipo: TipoDependencia;
  folga_dias: number;
}

export interface EtapaCalculada extends EtapaGantt {
  inicio: number; // dia (offset em dias a partir da data base)
  fim: number;
  inicioTarde: number;
  fimTarde: number;
  folga: number;
  critica: boolean;
  dataInicio: string;
  dataFim: string;
}

const DIA = 86_400_000;

export function diaParaData(base: Date, offset: number): string {
  return new Date(base.getTime() + offset * DIA).toISOString().slice(0, 10);
}

export function dataParaDia(base: Date, iso: string): number {
  return Math.round((new Date(`${iso}T00:00:00Z`).getTime() - base.getTime()) / DIA);
}

/** Ordena as etapas respeitando as dependências. Aborta em caso de ciclo. */
export function ordenarTopologico(
  etapas: EtapaGantt[],
  deps: DependenciaGantt[],
): string[] {
  const grau = new Map<string, number>(etapas.map((e) => [e.id, 0]));
  const saida = new Map<string, string[]>(etapas.map((e) => [e.id, []]));
  for (const d of deps) {
    if (!grau.has(d.etapa_id) || !grau.has(d.depende_de_etapa_id)) continue;
    grau.set(d.etapa_id, (grau.get(d.etapa_id) ?? 0) + 1);
    saida.get(d.depende_de_etapa_id)!.push(d.etapa_id);
  }
  const fila = etapas.filter((e) => (grau.get(e.id) ?? 0) === 0).map((e) => e.id);
  const ordem: string[] = [];
  while (fila.length) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const prox of saida.get(id) ?? []) {
      grau.set(prox, (grau.get(prox) ?? 0) - 1);
      if (grau.get(prox) === 0) fila.push(prox);
    }
  }
  if (ordem.length !== etapas.length) {
    throw new Error("Dependência circular entre etapas do cronograma");
  }
  return ordem;
}

/**
 * Calcula início/fim de cada etapa propagando as dependências, e marca o
 * caminho crítico (etapas com folga zero).
 */
export function calcularGantt(
  etapas: EtapaGantt[],
  deps: DependenciaGantt[],
): { etapas: EtapaCalculada[]; base: Date; duracaoTotal: number } {
  if (etapas.length === 0) return { etapas: [], base: new Date(), duracaoTotal: 0 };

  const baseIso = etapas
    .map((e) => e.data_inicio)
    .sort()[0];
  const base = new Date(`${baseIso}T00:00:00Z`);

  const ordem = ordenarTopologico(etapas, deps);
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const entrada = new Map<string, DependenciaGantt[]>();
  const saida = new Map<string, DependenciaGantt[]>();
  for (const d of deps) {
    if (!porId.has(d.etapa_id) || !porId.has(d.depende_de_etapa_id)) continue;
    entrada.set(d.etapa_id, [...(entrada.get(d.etapa_id) ?? []), d]);
    saida.set(d.depende_de_etapa_id, [...(saida.get(d.depende_de_etapa_id) ?? []), d]);
  }

  const inicio = new Map<string, number>();
  const fim = new Map<string, number>();
  for (const id of ordem) {
    const e = porId.get(id)!;
    const dur = Math.max(1, Number(e.duracao_dias) || 1);
    let ini = dataParaDia(base, e.data_inicio);
    for (const d of entrada.get(id) ?? []) {
      const pInicio = inicio.get(d.depende_de_etapa_id) ?? 0;
      const pFim = fim.get(d.depende_de_etapa_id) ?? 0;
      const minimo = (d.tipo === "II" ? pInicio : pFim) + (Number(d.folga_dias) || 0);
      if (minimo > ini) ini = minimo;
    }
    inicio.set(id, ini);
    fim.set(id, ini + dur);
  }

  const duracaoTotal = Math.max(...ordem.map((id) => fim.get(id) ?? 0));

  const fimTarde = new Map<string, number>();
  for (const id of [...ordem].reverse()) {
    const sucessores = saida.get(id) ?? [];
    if (sucessores.length === 0) {
      fimTarde.set(id, duracaoTotal);
      continue;
    }
    let limite = Infinity;
    for (const d of sucessores) {
      const sucId = d.etapa_id;
      const durSuc = Math.max(1, Number(porId.get(sucId)?.duracao_dias) || 1);
      const inicioTardeSuc = (fimTarde.get(sucId) ?? duracaoTotal) - durSuc;
      const cand = d.tipo === "II" ? inicioTardeSuc + durSuc - (Number(d.folga_dias) || 0)
                                   : inicioTardeSuc - (Number(d.folga_dias) || 0);
      if (cand < limite) limite = cand;
    }
    fimTarde.set(id, limite === Infinity ? duracaoTotal : limite);
  }

  const calculadas: EtapaCalculada[] = etapas.map((e) => {
    const dur = Math.max(1, Number(e.duracao_dias) || 1);
    const ini = inicio.get(e.id) ?? 0;
    const f = fim.get(e.id) ?? ini + dur;
    const ft = fimTarde.get(e.id) ?? duracaoTotal;
    const folga = Math.max(0, ft - f);
    return {
      ...e,
      inicio: ini,
      fim: f,
      inicioTarde: ft - dur,
      fimTarde: ft,
      folga,
      critica: folga === 0,
      dataInicio: diaParaData(base, ini),
      dataFim: diaParaData(base, f),
    };
  });

  return { etapas: calculadas, base, duracaoTotal };
}

/** Distribui o valor de cada etapa pelos meses que ela atravessa. */
export function previstoMensal(etapas: EtapaCalculada[]): { mes: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const e of etapas) {
    const valor = Number(e.valor_previsto) || 0;
    if (!valor) continue;
    const dias = Math.max(1, e.fim - e.inicio);
    const porDia = valor / dias;
    const ini = new Date(`${e.dataInicio}T00:00:00Z`);
    for (let d = 0; d < dias; d++) {
      const dia = new Date(ini.getTime() + d * DIA);
      const mes = `${dia.getUTCFullYear()}-${String(dia.getUTCMonth() + 1).padStart(2, "0")}-01`;
      mapa.set(mes, (mapa.get(mes) ?? 0) + porDia);
    }
  }
  return [...mapa.entries()]
    .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}
