export const TIPO_INSTITUICAO_LIST = [
  "construtora",
  "incorporadora",
  "industria",
  "concessionaria",
  "orgao_publico",
  "condominio",
  "comercio",
  "pessoa_fisica",
  "outro",
] as const;

export type TipoInstituicao = (typeof TIPO_INSTITUICAO_LIST)[number];

export const TIPO_INSTITUICAO_LABEL: Record<string, string> = {
  construtora: "Construtora",
  incorporadora: "Incorporadora",
  industria: "Indústria",
  concessionaria: "Concessionária",
  orgao_publico: "Órgão público",
  condominio: "Condomínio",
  comercio: "Comércio",
  pessoa_fisica: "Pessoa física",
  outro: "Outro",
};
