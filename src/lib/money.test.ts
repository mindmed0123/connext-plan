import { describe, expect, it } from "vitest";
import { arredondar2, dividirParcelas, emCentavos } from "./money";

describe("arredondar2", () => {
  it("corrige o erro clássico de ponto flutuante", () => {
    expect(arredondar2(100 * 1.15)).toBe(115);
    expect(arredondar2(0.1 + 0.2)).toBe(0.3);
    expect(arredondar2(1.005)).toBe(1.01);
  });

  it("mantém negativos e trata valores inválidos", () => {
    expect(arredondar2(-2.345)).toBe(-2.34);
    expect(arredondar2(Number.NaN)).toBe(0);
    expect(arredondar2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("emCentavos", () => {
  it("converte para inteiros", () => {
    expect(emCentavos(10.555)).toBe(1056);
    expect(emCentavos(19.99)).toBe(1999);
    expect(emCentavos(0)).toBe(0);
    expect(emCentavos(Number.NaN)).toBe(0);
  });
});

describe("dividirParcelas", () => {
  it("fecha exatamente com o total", () => {
    const p = dividirParcelas(100, 3);
    expect(p).toEqual([33.33, 33.33, 33.34]);
    expect(emCentavos(p.reduce((s, v) => s + v, 0))).toBe(emCentavos(100));
  });

  it("divide valores exatos", () => {
    expect(dividirParcelas(1200, 12)).toEqual(Array(12).fill(100));
  });

  it("uma parcela devolve o total", () => {
    expect(dividirParcelas(9450, 1)).toEqual([9450]);
    expect(dividirParcelas(9450, 0)).toEqual([9450]);
  });

  it("soma sempre igual ao total, em qualquer divisão", () => {
    for (const n of [2, 3, 6, 7, 9, 11]) {
      const soma = dividirParcelas(9450.37, n).reduce((s, v) => s + v, 0);
      expect(emCentavos(soma)).toBe(emCentavos(9450.37));
    }
  });
});
