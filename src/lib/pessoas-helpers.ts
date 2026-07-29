export const PESSOA_TIPO_LIST = ["administrativo", "operacional", "terceirizado"] as const;
export type PessoaTipo = (typeof PESSOA_TIPO_LIST)[number];

export const PESSOA_TIPO_LABEL: Record<PessoaTipo, string> = {
  administrativo: "Administrativo",
  operacional: "CLT",
  terceirizado: "Terceirizado",
};

export const PESSOA_TIPO_DESC: Record<PessoaTipo, string> = {
  administrativo: "Funcionários internos com acesso amplo (supervisores, coordenadores)",
  operacional: "Funcionários CLT de campo (pedreiro, eletricista, encanador, etc.) com pasta de documentos",
  terceirizado: "Prestadores externos que executam obras",
};

export const DOCUMENTO_TIPOS = [
  "NR-06",
  "NR-10",
  "NR-12",
  "NR-18",
  "NR-33",
  "NR-35",
  "ASO",
  "Ficha de registro",
  "Contrato de trabalho",
  "CTPS",
  "RG / CPF",
  "Comprovante de residência",
  "Certificado / Curso",
  "Exame periódico",
  "Outro",
] as const;


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
