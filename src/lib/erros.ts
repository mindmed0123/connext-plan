import { toast } from "sonner";

const FALLBACK = "Não foi possível concluir a ação. Tente novamente.";
let toastErrorOriginal: typeof toast.error | null = null;

const hasPortugueseText = (message: string) =>
  /[áàâãéêíóôõúç]/i.test(message) ||
  /\b(não|erro|informe|selecione|sessão|empresa|permissão|cadastro|convite|assinatura|pagamento)\b/i.test(message);

export function erroEmPortugues(error: unknown, fallback = FALLBACK) {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object"
        ? String((error as { message?: unknown; details?: unknown; code?: unknown }).message ??
            (error as { details?: unknown }).details ??
            (error as { code?: unknown }).code ??
            "")
        : "";

  const message = raw.trim();
  const lower = message.toLowerCase();

  if (!message) return fallback;
  if (hasPortugueseText(message)) return message;

  if (lower.includes("row-level security") || lower.includes("rls")) {
    return "Você não tem permissão para realizar esta ação. Saia e entre novamente; se continuar, verifique seu vínculo com a empresa.";
  }
  if (lower.includes("not_authenticated") || lower.includes("jwt") || lower.includes("auth session")) {
    return "Sua sessão expirou. Faça login novamente.";
  }
  if (lower.includes("empresa_nao_identificada")) {
    return "Não encontramos uma empresa vinculada ao seu usuário.";
  }
  if (lower.includes("sem_permissao")) {
    return "Seu usuário não tem permissão para realizar esta ação.";
  }
  if (lower.includes("codigo_chamado_obrigatorio")) {
    return "Informe o código do chamado.";
  }
  if (lower.includes("duplicate key") || lower.includes("23505")) {
    return "Já existe um cadastro com essas informações.";
  }
  if (lower.includes("foreign key") || lower.includes("23503")) {
    return "Não foi possível salvar porque existe um vínculo obrigatório ausente.";
  }
  if (lower.includes("not-null") || lower.includes("null value") || lower.includes("23502")) {
    return "Preencha todos os campos obrigatórios antes de continuar.";
  }
  if (lower.includes("invalid input value for enum")) {
    return "Uma das opções selecionadas não é válida para este cadastro.";
  }
  if (lower.includes("invalid login credentials")) {
    return "E-mail ou senha inválidos.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "Este e-mail já está cadastrado.";
  }
  if (lower.includes("password") && lower.includes("characters")) {
    return "A senha não atende aos requisitos mínimos.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("fetch")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  return fallback;
}

export function instalarErrosEmPortugues() {
  if (toastErrorOriginal) return;

  toastErrorOriginal = toast.error;
  toast.error = ((message: unknown, data?: Parameters<typeof toast.error>[1]) => {
    const translatedMessage =
      typeof message === "string" ||
      (message && typeof message === "object" && ("message" in message || "details" in message || "code" in message))
        ? erroEmPortugues(message)
        : message;
    const translatedData =
      data && typeof data.description === "string"
        ? { ...data, description: erroEmPortugues(data.description) }
        : data;

    return toastErrorOriginal(translatedMessage as Parameters<typeof toast.error>[0], translatedData);
  }) as typeof toast.error;
}