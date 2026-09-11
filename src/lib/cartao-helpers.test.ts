import { describe, expect, it } from "vitest";
import { fechamentoDaCompra, vencimentoDaCompra } from "./cartao-helpers";

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("fatura de cartão", () => {
  it("fecha 3 / vence 10, compra em 11/09/2026", () => {
    expect(key(fechamentoDaCompra("2026-09-11", 3))).toBe("2026-10-03");
    expect(key(vencimentoDaCompra("2026-09-11", 3, 10))).toBe("2026-10-10");
  });

  it("fecha 25 / vence 5, compra em 11/09/2026", () => {
    expect(key(fechamentoDaCompra("2026-09-11", 25))).toBe("2026-09-25");
    expect(key(vencimentoDaCompra("2026-09-11", 25, 5))).toBe("2026-10-05");
  });

  it("fecha 31 / vence 10, compra em 15/02/2026", () => {
    expect(key(fechamentoDaCompra("2026-02-15", 31))).toBe("2026-02-28");
    expect(key(vencimentoDaCompra("2026-02-15", 31, 10))).toBe("2026-03-10");
  });

  it("compra no dia do fechamento vai para a fatura seguinte", () => {
    expect(key(fechamentoDaCompra("2026-09-03", 3))).toBe("2026-10-03");
    expect(key(vencimentoDaCompra("2026-09-03", 3, 10))).toBe("2026-10-10");
  });

  it("compra em 31/01/2026 em 3x (fecha 10 / vence 20)", () => {
    expect(key(vencimentoDaCompra("2026-01-31", 10, 20, 0))).toBe("2026-02-20");
    expect(key(vencimentoDaCompra("2026-01-31", 10, 20, 1))).toBe("2026-03-20");
    expect(key(vencimentoDaCompra("2026-01-31", 10, 20, 2))).toBe("2026-04-20");
  });
});
