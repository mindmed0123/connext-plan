// Leitura de extratos bancários em OFX e CSV.
export type LinhaExtrato = {
  data: string; // yyyy-mm-dd
  descricao: string;
  valor: number;
  documento: string | null;
};

function normalizaData(bruta: string): string | null {
  const so = bruta.replace(/[^0-9]/g, "");
  if (so.length >= 8) {
    // OFX: yyyymmdd...
    const y = so.slice(0, 4), m = so.slice(4, 6), d = so.slice(6, 8);
    if (Number(y) > 1900) return `${y}-${m}-${d}`;
  }
  const br = bruta.trim().match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = bruta.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function normalizaValor(bruto: string): number {
  const limpo = bruto.trim().replace(/\s|R\$/g, "");
  // 1.234,56 -> 1234.56
  const ptbr = /,\d{1,2}$/.test(limpo);
  const n = ptbr ? limpo.replace(/\./g, "").replace(",", ".") : limpo.replace(/,/g, "");
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : 0;
}

export function parseOFX(texto: string): LinhaExtrato[] {
  const linhas: LinhaExtrato[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  for (const bloco of blocos) {
    const pega = (tag: string) => {
      const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const data = normalizaData(pega("DTPOSTED"));
    if (!data) continue;
    const valor = normalizaValor(pega("TRNAMT"));
    const descricao = pega("MEMO") || pega("NAME") || "Movimento";
    const documento = pega("FITID") || pega("CHECKNUM") || null;
    linhas.push({ data, descricao, valor, documento });
  }
  return linhas;
}

export function parseCSVExtrato(texto: string): LinhaExtrato[] {
  const linhas: LinhaExtrato[] = [];
  const rows = texto.split(/\r?\n/).filter((l) => l.trim());
  for (const row of rows) {
    const sep = row.includes(";") ? ";" : ",";
    const cols = row.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 3) continue;
    const data = normalizaData(cols[0]);
    if (!data) continue; // pula cabeçalho
    const valor = normalizaValor(cols[cols.length - 1]);
    if (!valor) continue;
    const descricao = cols[1] || "Movimento";
    const documento = cols.length > 3 ? cols[2] || null : null;
    linhas.push({ data, descricao, valor, documento });
  }
  return linhas;
}

export function hashLinha(l: LinhaExtrato): string {
  const base = `${l.data}|${l.valor.toFixed(2)}|${(l.documento ?? l.descricao).toLowerCase().slice(0, 60)}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (h * 31 + base.charCodeAt(i)) | 0;
  }
  return `${base.slice(0, 40)}#${(h >>> 0).toString(36)}`;
}
