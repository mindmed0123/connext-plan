import { describe, it, expect } from "vitest";
import { calcularValoresObras, valorFechado } from "./valor-obra";

describe("valor da obra", () => {
  it("obra só com contrato vale o contrato (caso MAKAI R$ 700 mil)", () => {
    const m = calcularValoresObras([], [], [{ obra_id: "a", status: "ativo", valor_global: 700000 }]);
    expect(m.get("a")).toEqual({ valor: 700000, fonte: "contrato" });
  });

  it("contrato manda sobre o orçamento e soma aditivos assinados", () => {
    const m = calcularValoresObras(
      [{ obra_id: "a", status: "aprovado", valor_orcamento: 500 }],
      [{ obra_id: "a", status: "assinado", valor_total: 50 }, { obra_id: "a", status: "rascunho", valor_total: 999 }],
      [{ obra_id: "a", status: "ativo", valor_global: 1000 }],
    );
    expect(m.get("a")!.valor).toBe(1050);
  });

  it("contrato encerrado não conta; cai para o orçamento aprovado", () => {
    const m = calcularValoresObras(
      [
        { obra_id: "a", status: "enviado", valor_orcamento: 900, created_at: "2026-02-01" },
        { obra_id: "a", status: "aprovado", valor_orcamento: 800, created_at: "2026-01-01" },
      ],
      [],
      [{ obra_id: "a", status: "encerrado", valor_global: 5000 }],
    );
    expect(m.get("a")).toEqual({ valor: 800, fonte: "orcamento_aprovado" });
  });

  it("orçamento ainda não aprovado não entra no valor fechado", () => {
    const m = calcularValoresObras([{ obra_id: "a", status: "enviado", valor_orcamento: 300 }], [], []);
    expect(m.get("a")!.valor).toBe(300);
    expect(valorFechado(m.get("a"))).toBe(0);
  });

  it("orçamento com total zerado usa o valor lançado (caso Infraestrutura Mogi)", () => {
    const m = calcularValoresObras([{ obra_id: "a", status: "aprovado", valor_orcamento: 342000, valor_total: 0 }], [], []);
    expect(m.get("a")!.valor).toBe(342000);
  });
});
