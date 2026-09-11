import { describe, expect, it } from "vitest";
import { calcularTotaisOrcamento, subtotalItem } from "./orcamento-calc";

describe("cálculo do orçamento", () => {
  it("subtotal 10.000, desconto global 10%, ISS 5% = 9.450", () => {
    const t = calcularTotaisOrcamento(
      [{ quantidade: 100, preco_unitario: 100, desconto_pct: 0, aliquota_iss: 5 }],
      10,
    );
    expect(t.subtotal).toBe(10000);
    expect(t.descGlobal).toBe(1000);
    expect(t.iss).toBe(450);
    expect(t.total).toBe(9450);
  });

  it("aplica o desconto do item antes do desconto global", () => {
    expect(subtotalItem({ quantidade: 2, preco_unitario: 100, desconto_pct: 10 })).toBe(180);
    const t = calcularTotaisOrcamento(
      [{ quantidade: 2, preco_unitario: 100, desconto_pct: 10, aliquota_iss: 0 }],
      0,
    );
    expect(t.total).toBe(180);
  });

  it("ISS por item com alíquotas diferentes", () => {
    const t = calcularTotaisOrcamento(
      [
        { quantidade: 1, preco_unitario: 1000, desconto_pct: 0, aliquota_iss: 5 },
        { quantidade: 1, preco_unitario: 1000, desconto_pct: 0, aliquota_iss: 2 },
      ],
      0,
    );
    expect(t.subtotal).toBe(2000);
    expect(t.iss).toBe(70);
    expect(t.total).toBe(2070);
  });

  it("sem itens retorna zeros", () => {
    expect(calcularTotaisOrcamento([], 10)).toEqual({
      subtotal: 0,
      descGlobal: 0,
      iss: 0,
      total: 0,
    });
  });

  it("não acumula erro de ponto flutuante", () => {
    const t = calcularTotaisOrcamento(
      [{ quantidade: 3, preco_unitario: 33.33, desconto_pct: 0, aliquota_iss: 5 }],
      0,
    );
    expect(t.subtotal).toBe(99.99);
    expect(t.total).toBe(104.99);
  });
});

describe("calcularBdiPct", () => {
  it("retorna 0 sem composição", () => {
    expect(calcularBdiPct({})).toBe(0);
  });
  it("calcula a fórmula clássica", () => {
    const bdi = calcularBdiPct({ ac: 4, s: 0.8, r: 1.2, df: 1, l: 7, i: 8.65 });
    expect(bdi).toBeCloseTo(25.36, 1);
  });
});
