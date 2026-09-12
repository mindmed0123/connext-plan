import { describe, expect, it } from "vitest";
import { conferirInsumos, converterNumero, formatoReconhecido, sugerirMapeamento } from "@/lib/base-custos";
import { calcularPrecoComposicao, ComposicaoBase, InsumoBase } from "@/lib/composicao-calc";
import { calcularGantt, ordenarTopologico, previstoMensal } from "@/lib/gantt";

describe("importação de base de custos", () => {
  it("reconhece o cabeçalho mais comum", () => {
    const mapa = sugerirMapeamento(["Código", "Descrição", "Unid", "Preço Unitário"]);
    expect(mapa).toEqual(["codigo", "descricao", "unidade", "preco_unitario"]);
    expect(formatoReconhecido(mapa)).toBe(true);
  });

  it("avisa quando o formato não é reconhecido", () => {
    expect(formatoReconhecido(sugerirMapeamento(["coluna A", "coluna B"]))).toBe(false);
  });

  it("converte preço em formato brasileiro", () => {
    expect(converterNumero("R$ 1.234,56")).toBeCloseTo(1234.56);
    expect(converterNumero("12.5")).toBeCloseTo(12.5);
    expect(converterNumero("abc")).toBeNull();
  });

  it("não deixa importar quando há linha inválida no meio", () => {
    const mapa = sugerirMapeamento(["Código", "Descrição", "Unidade", "Preço"]);
    const r = conferirInsumos(
      [
        ["001", "Cimento CP II", "sc", "35,90"],
        ["002", "Areia média", "m3", "xis"],
        ["003", "Brita 1", "m3", "110,00"],
      ],
      mapa,
    );
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0].linha).toBe(3);
    expect(r.total).toBe(3);
    expect(r.linhas).toHaveLength(2);
  });
});

describe("preço de composição", () => {
  const insumos = new Map<string, InsumoBase>([
    ["i1", { id: "i1", preco_unitario: 10, precos: [{ data_referencia: "2026-01-01", preco_unitario: 8 }] }],
    ["i2", { id: "i2", preco_unitario: 4 }],
  ]);
  const composicoes = new Map<string, ComposicaoBase>([
    ["cFilha", { id: "cFilha", itens: [{ tipo: "insumo", insumo_id: "i2", coeficiente: 2 }] }],
    [
      "cPai",
      {
        id: "cPai",
        itens: [
          { tipo: "insumo", insumo_id: "i1", coeficiente: 1.5 },
          { tipo: "composicao", composicao_filha_id: "cFilha", coeficiente: 3 },
        ],
      },
    ],
  ]);

  it("soma insumo e subcomposição", () => {
    // 1,5 × 10 + 3 × (2 × 4) = 15 + 24
    expect(calcularPrecoComposicao("cPai", composicoes, insumos)).toBeCloseTo(39);
  });

  it("recalcula por data de referência", () => {
    // insumo i1 valia 8 em 01/2026 → 1,5 × 8 + 24
    expect(calcularPrecoComposicao("cPai", composicoes, insumos, "2026-06-01")).toBeCloseTo(36);
  });

  it("aborta em referência circular", () => {
    const circ = new Map<string, ComposicaoBase>([
      ["a", { id: "a", itens: [{ tipo: "composicao", composicao_filha_id: "b", coeficiente: 1 }] }],
      ["b", { id: "b", itens: [{ tipo: "composicao", composicao_filha_id: "a", coeficiente: 1 }] }],
    ]);
    expect(() => calcularPrecoComposicao("a", circ, insumos)).toThrow(/circular/i);
  });
});

describe("cronograma de Gantt", () => {
  const etapas = [
    { id: "e1", nome: "Fundação", data_inicio: "2026-01-01", duracao_dias: 10, valor_previsto: 10000 },
    { id: "e2", nome: "Estrutura", data_inicio: "2026-01-01", duracao_dias: 20 },
    { id: "e3", nome: "Alvenaria", data_inicio: "2026-01-01", duracao_dias: 5 },
    { id: "e4", nome: "Cobertura", data_inicio: "2026-01-01", duracao_dias: 8 },
    { id: "e5", nome: "Acabamento", data_inicio: "2026-01-01", duracao_dias: 12 },
  ];
  const deps = [
    { etapa_id: "e2", depende_de_etapa_id: "e1", tipo: "FI" as const, folga_dias: 0 },
    { etapa_id: "e5", depende_de_etapa_id: "e2", tipo: "FI" as const, folga_dias: 0 },
  ];

  it("propaga as datas pelas dependências", () => {
    const { etapas: calc, duracaoTotal } = calcularGantt(etapas, deps);
    const porId = new Map(calc.map((e) => [e.id, e]));
    expect(porId.get("e2")!.inicio).toBe(10);
    expect(porId.get("e5")!.inicio).toBe(30);
    expect(duracaoTotal).toBe(42);
  });

  it("marca o caminho crítico e a folga", () => {
    const { etapas: calc } = calcularGantt(etapas, deps);
    const criticas = calc.filter((e) => e.critica).map((e) => e.id).sort();
    expect(criticas).toEqual(["e1", "e2", "e5"]);
    expect(calc.find((e) => e.id === "e3")!.folga).toBeGreaterThan(0);
  });

  it("aborta em dependência circular", () => {
    expect(() =>
      ordenarTopologico(etapas, [
        ...deps,
        { etapa_id: "e1", depende_de_etapa_id: "e5", tipo: "FI", folga_dias: 0 },
      ]),
    ).toThrow(/circular/i);
  });

  it("distribui o valor da etapa pelos meses", () => {
    const { etapas: calc } = calcularGantt(etapas, deps);
    const meses = previstoMensal(calc);
    expect(meses).toHaveLength(1);
    expect(meses[0]).toEqual({ mes: "2026-01-01", valor: 10000 });
  });
});
