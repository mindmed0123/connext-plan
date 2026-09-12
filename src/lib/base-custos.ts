/**
 * Leitura e conferência de planilhas de insumos e composições.
 * Nada é gravado aqui: estas funções só reconhecem colunas, validam linhas e
 * listam erros. A gravação acontece em uma única transação no banco.
 */

export type CampoInsumo = "codigo" | "descricao" | "unidade" | "preco_unitario" | "ignorar";

export const CAMPOS_INSUMO: { campo: CampoInsumo; rotulo: string; obrigatorio: boolean }[] = [
  { campo: "codigo", rotulo: "Código", obrigatorio: true },
  { campo: "descricao", rotulo: "Descrição", obrigatorio: true },
  { campo: "unidade", rotulo: "Unidade", obrigatorio: false },
  { campo: "preco_unitario", rotulo: "Preço unitário", obrigatorio: true },
];

const SINONIMOS: Record<Exclude<CampoInsumo, "ignorar">, string[]> = {
  codigo: ["codigo", "código", "cod", "cod.", "code", "item"],
  descricao: ["descricao", "descrição", "descricao do insumo", "discriminacao", "discriminação", "nome"],
  unidade: ["unidade", "und", "un", "um", "unid"],
  preco_unitario: ["preco", "preço", "preco unitario", "preço unitário", "valor", "custo", "preco_unitario", "custo unitario", "custo unitário"],
};

const normalizar = (s: string) =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Sugere o mapeamento coluna → campo a partir do cabeçalho da planilha. */
export function sugerirMapeamento(cabecalho: string[]): CampoInsumo[] {
  const nomes = cabecalho.map((c) => normalizar(c ?? ""));
  const mapa: CampoInsumo[] = nomes.map(() => "ignorar");

  // 1ª passada: nome exato. 2ª passada: nome contido (sinônimos longos apenas,
  // para "un" não roubar a coluna "Preço Unitário").
  for (const exato of [true, false]) {
    for (const [campo, sinonimos] of Object.entries(SINONIMOS)) {
      if (mapa.includes(campo as CampoInsumo)) continue;
      const i = nomes.findIndex((n, k) => {
        if (mapa[k] !== "ignorar") return false;
        return sinonimos.some((x) => {
          const s = normalizar(x);
          return exato ? n === s : s.length >= 4 && n.includes(s);
        });
      });
      if (i >= 0) mapa[i] = campo as CampoInsumo;
    }
  }
  return mapa;
}

export function formatoReconhecido(mapa: CampoInsumo[]): boolean {
  return CAMPOS_INSUMO.filter((c) => c.obrigatorio).every((c) => mapa.includes(c.campo));
}

export function converterNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  let t = String(valor).trim().replace(/[R$\s]/g, "");
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface LinhaInsumo {
  codigo: string;
  descricao: string;
  unidade: string;
  preco_unitario: string;
}

export interface ConferenciaImportacao {
  linhas: LinhaInsumo[];
  erros: { linha: number; motivo: string }[];
  total: number;
}

/**
 * Converte as linhas da planilha no formato de gravação.
 * Uma única linha inválida já impede a importação: quem chama deve conferir
 * `erros.length === 0` antes de gravar — nunca importar pela metade.
 */
export function conferirInsumos(linhas: unknown[][], mapa: CampoInsumo[]): ConferenciaImportacao {
  const idx = (campo: CampoInsumo) => mapa.indexOf(campo);
  const res: LinhaInsumo[] = [];
  const erros: { linha: number; motivo: string }[] = [];

  linhas.forEach((linha, i) => {
    const numero = i + 2; // 1 = cabeçalho
    const vazia = linha.every((c) => c === null || c === undefined || String(c).trim() === "");
    if (vazia) return;

    const codigo = String(linha[idx("codigo")] ?? "").trim();
    const descricao = String(linha[idx("descricao")] ?? "").trim();
    const unidade = idx("unidade") >= 0 ? String(linha[idx("unidade")] ?? "").trim() : "";
    const preco = converterNumero(linha[idx("preco_unitario")]);

    if (!codigo) erros.push({ linha: numero, motivo: "sem código" });
    else if (!descricao) erros.push({ linha: numero, motivo: "sem descrição" });
    else if (preco === null) erros.push({ linha: numero, motivo: "preço inválido" });
    else if (preco < 0) erros.push({ linha: numero, motivo: "preço negativo" });
    else res.push({ codigo, descricao, unidade: unidade || "un", preco_unitario: String(preco) });
  });

  return { linhas: res, erros, total: res.length + erros.length };
}
