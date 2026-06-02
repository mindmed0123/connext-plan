export interface PeriodoFatura {
  abre: Date;
  fecha: Date;
  vence: Date;
  label: string;
}

export interface InfoFaturas {
  faturaAtual: PeriodoFatura;
  proximaFatura: PeriodoFatura;
}

const labelMes = (d: Date) =>
  d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
    .replace(" de ", "/")
    .replace(" ", "/");

/**
 * Dado o dia de fechamento e o dia de vencimento do cartão,
 * calcula as datas exatas das faturas a partir de `hoje`.
 */
export function calcularFaturas(
  diaFechamento: number,
  diaVencimento: number,
  hoje: Date = new Date(),
): InfoFaturas {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const diaHoje = hoje.getDate();

  const faturaMesAtualJaFechou = diaHoje >= diaFechamento;

  let fechaAtual: Date;
  let fechaProxima: Date;

  if (!faturaMesAtualJaFechou) {
    fechaAtual = new Date(ano, mes, diaFechamento);
    fechaProxima = new Date(ano, mes + 1, diaFechamento);
  } else {
    fechaAtual = new Date(ano, mes + 1, diaFechamento);
    fechaProxima = new Date(ano, mes + 2, diaFechamento);
  }

  const abreAtual = new Date(fechaAtual);
  abreAtual.setMonth(abreAtual.getMonth() - 1);

  const abreProxima = new Date(fechaAtual);

  const venceAtual = new Date(
    fechaAtual.getFullYear(),
    fechaAtual.getMonth() + 1,
    diaVencimento,
  );
  const venceProxima = new Date(
    fechaProxima.getFullYear(),
    fechaProxima.getMonth() + 1,
    diaVencimento,
  );

  return {
    faturaAtual: { abre: abreAtual, fecha: fechaAtual, vence: venceAtual, label: labelMes(fechaAtual) },
    proximaFatura: {
      abre: abreProxima,
      fecha: fechaProxima,
      vence: venceProxima,
      label: labelMes(fechaProxima),
    },
  };
}

/** Retorna a qual fatura uma compra pertence, dado o cartão. */
export function faturaDeCompra(
  dataCompra: string | Date,
  diaFechamento: number,
  diaVencimento: number,
  hoje: Date = new Date(),
): "atual" | "proxima" | "anterior" | "futura" {
  const compra =
    typeof dataCompra === "string" ? new Date(dataCompra + "T12:00:00") : dataCompra;
  const { faturaAtual, proximaFatura } = calcularFaturas(diaFechamento, diaVencimento, hoje);

  if (compra >= faturaAtual.abre && compra < faturaAtual.fecha) return "atual";
  if (compra >= proximaFatura.abre && compra < proximaFatura.fecha) return "proxima";
  if (compra < faturaAtual.abre) return "anterior";
  return "futura";
}
