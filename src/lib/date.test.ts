import { describe, expect, it } from "vitest";
import {
  formatDateBR,
  getTodayKeySaoPaulo,
  isVencido,
  parseDateString,
  toDateKey,
} from "./date";

describe("parseDateString", () => {
  it("não desloca o dia (bug do fuso)", () => {
    const d = parseDateString("2026-09-11")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(11);
    expect(toDateKey(d)).toBe("2026-09-11");
  });

  it("aceita data no formato brasileiro", () => {
    expect(toDateKey(parseDateString("11/09/2026")!)).toBe("2026-09-11");
    expect(toDateKey(parseDateString("1/2/26")!)).toBe("2026-02-01");
  });

  it("aceita timestamp ISO completo", () => {
    expect(toDateKey(parseDateString("2026-09-11T23:30:00Z")!)).toBe("2026-09-11");
  });

  it("rejeita datas inválidas", () => {
    expect(parseDateString("31/02/2026")).toBeNull();
    expect(parseDateString("2026-13-01")).toBeNull();
    expect(parseDateString("")).toBeNull();
    expect(parseDateString(null)).toBeNull();
  });
});

describe("formatDateBR", () => {
  it("formata em dd/MM/yyyy", () => {
    expect(formatDateBR("2026-01-05")).toBe("05/01/2026");
  });
  it("usa o fallback quando vazio", () => {
    expect(formatDateBR(null)).toBe("—");
    expect(formatDateBR(undefined, "sem data")).toBe("sem data");
  });
});

describe("isVencido", () => {
  it("hoje NÃO está vencido", () => {
    expect(isVencido(getTodayKeySaoPaulo())).toBe(false);
  });
  it("ontem está vencido, amanhã não", () => {
    expect(isVencido("2020-01-01")).toBe(true);
    expect(isVencido("2099-01-01")).toBe(false);
  });
  it("sem data não está vencido", () => {
    expect(isVencido(null)).toBe(false);
    expect(isVencido(undefined)).toBe(false);
  });
});

describe("getTodayKeySaoPaulo", () => {
  it("devolve YYYY-MM-DD", () => {
    expect(getTodayKeySaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
