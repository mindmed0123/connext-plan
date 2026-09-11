/** Helpers de dinheiro — evitam erros de ponto flutuante (ex.: 100 * 1.15 = 114.99999999999999). */

/** Arredonda para 2 casas decimais de forma estável. */
export function arredondar2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Converte para centavos inteiros (comparações exatas de dinheiro). */
export function emCentavos(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100);
}

/**
 * Divide um total em N parcelas de 2 casas, com a última absorvendo a diferença,
 * de modo que a soma feche exatamente com o total.
 */
export function dividirParcelas(total: number, n: number): number[] {
  const qtd = Math.max(1, Math.floor(n));
  const totalCent = emCentavos(total);
  const base = Math.floor(totalCent / qtd);
  const parcelas = Array.from({ length: qtd }, () => base);
  parcelas[qtd - 1] = totalCent - base * (qtd - 1);
  return parcelas.map((c) => c / 100);
}
