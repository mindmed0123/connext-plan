import { describe, expect, it } from "vitest";
import { caminhoCritico, criaCiclo, curvaS, diffDias, somarDias, type DependenciaGantt, type TarefaGantt } from "./gantt";

const t = (id: string, inicio: string, fim: string, valor = 0, realizado = 0): TarefaGantt => ({
  id, nome: id, inicio, fim, percentual_previsto: 0, percentual_realizado: realizado, valor_previsto: valor,
});

describe("datas", () => {
  it("soma e subtrai dias", () => {
    expect(somarDias("2026-01-30", 3)).toBe("2026-02-02");
    expect(diffDias("2026-01-01", "2026-01-11")).toBe(10);
  });
});

describe("ciclos", () => {
  const deps: DependenciaGantt[] = [
    { etapa_id: "B", depende_de_etapa_id: "A", tipo: "FI", folga_dias: 0 },
    { etapa_id: "C", depende_de_etapa_id: "B", tipo: "FI", folga_dias: 0 },
  ];
  it("acusa laço direto", () => expect(criaCiclo(deps, "A", "A")).toBe(true));
  it("acusa laço indireto", () => expect(criaCiclo(deps, "C", "A")).toBe(true));
  it("aceita ligação válida", () => expect(criaCiclo(deps, "C", "D")).toBe(false));
});

describe("caminho crítico", () => {
  it("marca a cadeia longa como crítica e dá folga à curta", () => {
    const tarefas = [
      t("A", "2026-01-01", "2026-01-11"),
      t("B", "2026-01-11", "2026-01-31"),
      t("C", "2026-01-11", "2026-01-16"),
      t("D", "2026-01-31", "2026-02-05"),
    ];
    const deps: DependenciaGantt[] = [
      { etapa_id: "B", depende_de_etapa_id: "A", tipo: "FI", folga_dias: 0 },
      { etapa_id: "C", depende_de_etapa_id: "A", tipo: "FI", folga_dias: 0 },
      { etapa_id: "D", depende_de_etapa_id: "B", tipo: "FI", folga_dias: 0 },
      { etapa_id: "D", depende_de_etapa_id: "C", tipo: "FI", folga_dias: 0 },
    ];
    const r = caminhoCritico(tarefas, deps);
    expect([...r.critica].sort()).toEqual(["A", "B", "D"]);
    expect(r.folga.C).toBe(15);
    expect(r.fimProjeto).toBe("2026-02-05");
  });

  it("respeita folga de espera entre etapas", () => {
    const tarefas = [t("A", "2026-03-01", "2026-03-06"), t("B", "2026-03-06", "2026-03-11")];
    const deps: DependenciaGantt[] = [{ etapa_id: "B", depende_de_etapa_id: "A", tipo: "FI", folga_dias: 4 }];
    const r = caminhoCritico(tarefas, deps);
    expect(r.fimProjeto).toBe("2026-03-15");
  });
});

describe("curva S", () => {
  it("distribui o valor pelos meses e acumula", () => {
    const pontos = curvaS([t("A", "2026-01-01", "2026-03-01", 6000, 50)]);
    expect(pontos.map((p) => p.mes)).toEqual(["2026-01", "2026-02"]);
    expect(pontos[0].previsto + pontos[1].previsto).toBeCloseTo(6000, 1);
    expect(pontos[1].previstoAcum).toBeCloseTo(6000, 1);
    expect(pontos[1].realizadoAcum).toBeCloseTo(3000, 1);
  });
});
