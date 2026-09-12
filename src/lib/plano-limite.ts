/** Traduz erros de limite de plano vindos do banco em mensagem de gente. */
export type LimitePlano = { tipo: "obras" | "usuarios"; mensagem: string } | null;

export function detectarLimitePlano(erro: unknown): LimitePlano {
  const texto = String((erro as { message?: string } | null)?.message ?? erro ?? "");
  if (texto.includes("LIMITE_PLANO_OBRAS")) {
    return {
      tipo: "obras",
      mensagem:
        "Você chegou ao número de obras ativas do seu plano. Arquive uma obra concluída ou mude para um plano maior.",
    };
  }
  if (texto.includes("LIMITE_PLANO_USUARIOS")) {
    return {
      tipo: "usuarios",
      mensagem:
        "Você chegou ao número de pessoas com acesso do seu plano. Desative um acesso ou mude para um plano maior.",
    };
  }
  return null;
}
