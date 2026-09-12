import { hashKey, type QueryClient } from "@tanstack/react-query";

/**
 * Escopo de empresa aplicado a TODO o cache de consultas.
 *
 * Em vez de repetir o empresaId em 255 chaves espalhadas pelo código (e correr o
 * risco de esquecer uma), o identificador da empresa entra no hash de todas as
 * chaves. Na prática cada empresa tem o seu próprio cache: dados de uma nunca
 * podem ser lidos por outra, mesmo em troca de usuário na mesma aba.
 */
let escopoEmpresa: string | null = null;

export function hashComEmpresa(queryKey: readonly unknown[]): string {
  return hashKey([escopoEmpresa, ...queryKey]);
}

/** Troca o escopo e limpa o cache quando a empresa (ou o usuário) muda. */
export function aplicarEscopoEmpresa(qc: QueryClient, empresaId: string | null) {
  if (escopoEmpresa === empresaId) return;
  escopoEmpresa = empresaId;
  qc.clear();
}

/** Logout: zera escopo e cache. */
export function limparEscopoEmpresa(qc: QueryClient) {
  escopoEmpresa = null;
  qc.clear();
}
