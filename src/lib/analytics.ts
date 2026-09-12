/**
 * Ponto único de medição de conversão.
 * Hoje só registra no console. Para ligar numa ferramenta de análise
 * (GA4, Plausible, Meta, etc.), basta trocar o corpo desta função.
 */
export function trackEvent(nome: string, dados: Record<string, unknown> = {}) {
  // eslint-disable-next-line no-console
  console.log("[analytics]", nome, dados);
}
