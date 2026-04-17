export const PESSOA_TIPO_LIST = ["administrativo", "operacional", "terceirizado"] as const;
export type PessoaTipo = (typeof PESSOA_TIPO_LIST)[number];

export const PESSOA_TIPO_LABEL: Record<PessoaTipo, string> = {
  administrativo: "Administrativo",
  operacional: "Operacional",
  terceirizado: "Terceirizado",
};

export const PESSOA_TIPO_DESC: Record<PessoaTipo, string> = {
  administrativo: "Funcionários internos com acesso amplo (supervisores, coordenadores)",
  operacional: "Funcionários de campo (pedreiro, eletricista, encanador, etc.)",
  terceirizado: "Prestadores externos que executam obras",
};

export const OBRA_PAPEL_LIST = ["responsavel_administrativo", "executor_operacional", "terceirizado"] as const;
export type ObraPapel = (typeof OBRA_PAPEL_LIST)[number];

export const OBRA_PAPEL_LABEL: Record<ObraPapel, string> = {
  responsavel_administrativo: "Responsável administrativo",
  executor_operacional: "Executor operacional",
  terceirizado: "Terceirizado",
};

export const PAPEL_PARA_TIPO: Record<ObraPapel, PessoaTipo> = {
  responsavel_administrativo: "administrativo",
  executor_operacional: "operacional",
  terceirizado: "terceirizado",
};

export const CARGOS_OPERACIONAIS = [
  "Pedreiro",
  "Eletricista",
  "Encanador",
  "Ajudante",
  "Pintor",
  "Serralheiro",
  "Técnico",
  "Outros",
] as const;
