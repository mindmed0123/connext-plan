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

/** Último dia do mês (fev = 28/29). */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

/** Cria uma data limitando o dia ao último dia do mês. */
export function diaDoMes(ano: number, mes: number, dia: number): Date {
  const ref = new Date(ano, mes, 1);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  return new Date(y, m, Math.min(dia, ultimoDiaDoMes(y, m)));
}

/** Soma meses mantendo o dia dentro do mês de destino. */
export function somarMeses(data: Date, meses: number): Date {
  return diaDoMes(data.getFullYear(), data.getMonth() + meses, data.getDate());
}

const toDate = (d: string | Date) => (typeof d === "string" ? new Date(d + "T12:00:00") : d);

/**
 * Fechamento da fatura em que a compra cai.
 * Compra no dia do fechamento (ou depois) vai para o fechamento do mês seguinte.
 */
export function fechamentoDaCompra(dataCompra: string | Date, diaFechamento: number): Date {
  const compra = toDate(dataCompra);
  const ano = compra.getFullYear();
  const mes = compra.getMonth();
  const fech = Math.min(diaFechamento, ultimoDiaDoMes(ano, mes));
  return compra.getDate() >= fech
    ? diaDoMes(ano, mes + 1, diaFechamento)
    : diaDoMes(ano, mes, diaFechamento);
}

/**
 * Vencimento da fatura em que a compra cai.
 * Vence no MESMO mês do fechamento quando dia_vencimento > dia_fechamento; senão, no mês seguinte.
 * `offsetMeses` desloca a fatura (usado em parcelamentos).
 */
export function vencimentoDaCompra(
  dataCompra: string | Date,
  diaFechamento: number,
  diaVencimento: number,
  offsetMeses = 0,
): Date {
  const fecha = fechamentoDaCompra(dataCompra, diaFechamento);
  const mesFech = fecha.getMonth() + offsetMeses;
  const mesVenc = diaVencimento > diaFechamento ? mesFech : mesFech + 1;
  return diaDoMes(fecha.getFullYear(), mesVenc, diaVencimento);
}

/** Datas das faturas atual e próxima a partir de `hoje`. */
export function calcularFaturas(
  diaFechamento: number,
  diaVencimento: number,
  hoje: Date = new Date(),
): InfoFaturas {
  const fechaAtual = fechamentoDaCompra(hoje, diaFechamento);
  const abreAtual = diaDoMes(fechaAtual.getFullYear(), fechaAtual.getMonth() - 1, diaFechamento);
  const fechaProxima = diaDoMes(fechaAtual.getFullYear(), fechaAtual.getMonth() + 1, diaFechamento);

  const venceAtual = vencimentoDaCompra(hoje, diaFechamento, diaVencimento);
  const venceProxima = vencimentoDaCompra(hoje, diaFechamento, diaVencimento, 1);

  return {
    faturaAtual: { abre: abreAtual, fecha: fechaAtual, vence: venceAtual, label: labelMes(fechaAtual) },
    proximaFatura: {
      abre: fechaAtual,
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
  const compra = toDate(dataCompra);
  const { faturaAtual, proximaFatura } = calcularFaturas(diaFechamento, diaVencimento, hoje);

  if (compra >= faturaAtual.abre && compra < faturaAtual.fecha) return "atual";
  if (compra >= proximaFatura.abre && compra < proximaFatura.fecha) return "proxima";
  if (compra < faturaAtual.abre) return "anterior";
  return "futura";
}
