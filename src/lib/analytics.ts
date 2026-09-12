/**
 * Ponto único de medição de conversão.
 *
 * Ainda não há ferramenta de análise ligada. A função continua no lugar para
 * que, ao contratar uma (GA4, Plausible, Meta, etc.), baste preencher o corpo
 * abaixo — nenhuma chamada espalhada pelo app precisa mudar.
 *
 * Em desenvolvimento o evento aparece no console para conferência; em
 * produção não registra nada.
 */
type Destino = (nome: string, dados: Record<string, unknown>) => void;

let destino: Destino | null = null;

/** Liga uma ferramenta de análise em tempo de execução. */
export function configurarAnalytics(fn: Destino | null) {
  destino = fn;
}

export function trackEvent(nome: string, dados: Record<string, unknown> = {}) {
  if (destino) {
    try {
      destino(nome, dados);
    } catch {
      /* medição nunca pode quebrar a tela */
    }
    return;
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[analytics]", nome, dados);
  }
}
