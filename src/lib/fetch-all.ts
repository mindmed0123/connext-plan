/**
 * O Supabase devolve no máximo 1.000 linhas por consulta.
 * Este helper pagina automaticamente para que totais e listas não fiquem truncados.
 *
 * IMPORTANTE: a consulta passada em `build` precisa ter uma ordenação estável
 * (sempre com `.order("id")` como desempate). Sem isso, acima de 1.000 linhas
 * o banco pode repetir ou pular registros entre as páginas.
 */
const PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => any,
  maxRows = 100000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
  console.warn(
    `[fetchAllRows] Limite de ${maxRows} linhas atingido — a lista pode estar incompleta.`,
  );
  return all;
}
