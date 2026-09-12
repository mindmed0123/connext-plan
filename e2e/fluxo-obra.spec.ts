import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Fluxo ponta a ponta de verdade:
 *   login -> criar obra -> orçamento -> aprovar -> nota fiscal
 *   -> recebimento gerado -> baixa do recebimento -> lançamento no razão
 *
 * A parte de navegação usa a interface; a parte de dados usa a MESMA sessão do
 * usuário logado (token do navegador), de modo que todas as regras de banco
 * (RLS, gatilhos, limites de plano) são exercidas como em produção.
 *
 * Variáveis necessárias: E2E_EMAIL, E2E_SENHA e as chaves públicas do backend
 * (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, ou E2E_SUPABASE_URL /
 * E2E_SUPABASE_ANON_KEY). Sem elas o teste FALHA — nunca é pulado em silêncio.
 */

function doArquivoEnv(chave: string): string | undefined {
  try {
    const linha = readFileSync(".env", "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith(`${chave}=`));
    return linha?.slice(linha.indexOf("=") + 1).trim() || undefined;
  } catch {
    return undefined;
  }
}

function obrigatorio(nomes: string[]): string {
  for (const n of nomes) {
    const v = process.env[n] ?? doArquivoEnv(n);
    if (v) return v;
  }
  throw new Error(
    `Teste ponta a ponta não pôde rodar: defina ${nomes.join(" ou ")}. ` +
      "O fluxo é obrigatório no CI e não deve ser pulado.",
  );
}

const EMAIL = () => obrigatorio(["E2E_EMAIL"]);
const SENHA = () => obrigatorio(["E2E_SENHA"]);
const SUPABASE_URL = () => obrigatorio(["VITE_SUPABASE_URL", "E2E_SUPABASE_URL"]);
const ANON_KEY = () => obrigatorio(["VITE_SUPABASE_PUBLISHABLE_KEY", "E2E_SUPABASE_ANON_KEY"]);

const sufixo = Date.now().toString().slice(-8);
const CHAMADO = `E2E-${sufixo}`;
const NUMERO_NF = `E2E${sufixo}`;
const VALOR = 1500;

/** Cliente REST autenticado com o token da sessão do navegador. */
function api(request: APIRequestContext, token: string) {
  const base = SUPABASE_URL().replace(/\/$/, "");
  const headers = {
    apikey: ANON_KEY(),
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  return {
    async rpc<T = any>(nome: string, args: Record<string, unknown> = {}): Promise<T> {
      const r = await request.post(`${base}/rest/v1/rpc/${nome}`, { headers, data: args });
      expect(r.ok(), `rpc ${nome} falhou: ${await r.text()}`).toBeTruthy();
      return (await r.json()) as T;
    },
    async select<T = any>(tabela: string, query: string): Promise<T[]> {
      const r = await request.get(`${base}/rest/v1/${tabela}?${query}`, { headers });
      expect(r.ok(), `leitura de ${tabela} falhou: ${await r.text()}`).toBeTruthy();
      return (await r.json()) as T[];
    },
    async insert<T = any>(tabela: string, linha: Record<string, unknown>): Promise<T[]> {
      const r = await request.post(`${base}/rest/v1/${tabela}`, {
        headers: { ...headers, Prefer: "return=representation" },
        data: linha,
      });
      expect(r.ok(), `inserção em ${tabela} falhou: ${await r.text()}`).toBeTruthy();
      return (await r.json()) as T[];
    },
    async remove(tabela: string, query: string) {
      await request.delete(`${base}/rest/v1/${tabela}?${query}`, { headers });
    },
  };
}

test("fluxo completo: obra, orçamento aprovado, NF, recebimento e baixa", async ({
  page,
  request,
}) => {
  const email = EMAIL();
  const senha = SENHA();

  // 1. Login pela interface
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).first().fill(email);
  await page.getByLabel(/senha/i).first().fill(senha);
  await page.getByRole("button", { name: /entrar/i }).first().click();
  await page.waitForURL(/\/(dashboard|obras|onboarding)/, { timeout: 60_000 });

  // 2. Token da sessão real do navegador
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (/^sb-.*-auth-token$/.test(k)) {
        try {
          return JSON.parse(localStorage.getItem(k)!)?.access_token ?? null;
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  expect(token, "não foi possível recuperar a sessão após o login").toBeTruthy();
  const db = api(request, token as string);

  // 3. Criar obra (passa pelo limite de plano e pela RLS)
  await db.rpc("criar_obra_segura", {
    _codigo_chamado: CHAMADO,
    _origem: "Teste automático",
    _regiao_label: "",
    _engenheiro_responsavel: "Teste E2E",
    _descricao_servico: "Obra criada pelo teste ponta a ponta",
    _endereco: "Rua de Teste, 100",
    _data_recebimento: new Date().toISOString().slice(0, 10),
  });

  const [obra] = await db.select<any>(
    "obras",
    `select=id,empresa_id,codigo_chamado&codigo_chamado=eq.${CHAMADO}`,
  );
  expect(obra, "a obra não foi criada").toBeTruthy();
  const empresaId = obra.empresa_id as string;

  // 4. Orçamento com um item (os totais são calculados pelo banco)
  const orcamentoId = await db.rpc<string>("salvar_orcamento", {
    _orcamento: {
      id: null,
      empresa_id: empresaId,
      obra_id: obra.id,
      codigo_chamado: CHAMADO,
      titulo: "Orçamento do teste automático",
      data_orcamento: new Date().toISOString().slice(0, 10),
      data_emissao: new Date().toISOString().slice(0, 10),
      validade_dias: 15,
      desconto_global_pct: 0,
      condicao_pagamento: "a_vista",
      numero_parcelas: 1,
      intervalo_parcelas: 30,
      percentual_entrada: 0,
      status: "em_elaboracao",
    },
    _itens: [
      {
        tipo: "servico",
        descricao: "Serviço do teste automático",
        unidade: "un",
        quantidade: 1,
        preco_unitario: VALOR,
        desconto_pct: 0,
        aliquota_iss: 0,
        ordem: 0,
      },
    ],
  });
  expect(orcamentoId, "o orçamento não foi salvo").toBeTruthy();

  const [orcSalvo] = await db.select<any>(
    "orcamentos",
    `select=id,valor_total,status&id=eq.${orcamentoId}`,
  );
  expect(Number(orcSalvo.valor_total)).toBeCloseTo(VALOR, 2);

  // 5. Aprovar o orçamento
  await db.rpc("aprovar_orcamento", { _id: orcamentoId });
  const [orcAprovado] = await db.select<any>(
    "orcamentos",
    `select=status&id=eq.${orcamentoId}`,
  );
  expect(orcAprovado.status).toBe("aprovado");

  // 6. Nota fiscal da obra -> gera o recebimento previsto
  const [nf] = await db.insert<any>("notas_fiscais", {
    empresa_id: empresaId,
    obra_id: obra.id,
    numero_nf: NUMERO_NF,
    data_emissao: new Date().toISOString().slice(0, 10),
    valor: VALOR,
    valor_bruto: VALOR,
  });
  expect(nf?.id, "a nota fiscal não foi criada").toBeTruthy();

  let recebimentos: any[] = [];
  await expect
    .poll(
      async () => {
        recebimentos = await db.select<any>(
          "recebimentos",
          `select=id,valor,status,saldo&obra_id=eq.${obra.id}`,
        );
        return recebimentos.length;
      },
      { message: "a nota fiscal não gerou recebimento", timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  const recebimento = recebimentos[0];
  expect(Number(recebimento.valor)).toBeCloseTo(VALOR, 2);

  // 7. Baixa do recebimento -> vira lançamento realizado no razão
  await db.rpc("confirmar_recebimento", {
    _id: recebimento.id,
    _valor: Number(recebimento.valor),
    _data: new Date().toISOString().slice(0, 10),
  });

  const [recebido] = await db.select<any>(
    "recebimentos",
    `select=status&id=eq.${recebimento.id}`,
  );
  expect(recebido.status).toBe("recebido");

  const lancamentos = await db.select<any>(
    "lancamentos_financeiros",
    `select=id,tipo,status,valor&obra_id=eq.${obra.id}&tipo=eq.receita&status=eq.realizado`,
  );
  expect(lancamentos.length, "nenhuma receita realizada no razão").toBeGreaterThan(0);

  // 8. A interface mostra o que foi criado
  await page.goto("/obras");
  await expect(page.getByText(CHAMADO).first()).toBeVisible({ timeout: 30_000 });

  await page.goto("/recebimentos");
  await expect(page.getByRole("heading", { name: /recebimentos/i }).first()).toBeVisible();
  await expect(page.getByText(CHAMADO).first()).toBeVisible({ timeout: 30_000 });

  // 9. Limpeza (a RLS garante que só apagamos o da própria empresa)
  await db.remove("lancamentos_financeiros", `obra_id=eq.${obra.id}`);
  await db.remove("recebimento_pagamentos", `recebimento_id=eq.${recebimento.id}`);
  await db.remove("recebimentos", `obra_id=eq.${obra.id}`);
  await db.remove("notas_fiscais", `id=eq.${nf.id}`);
  await db.remove("orcamento_itens", `orcamento_id=eq.${orcamentoId}`);
  await db.remove("orcamentos", `id=eq.${orcamentoId}`);
  await db.remove("obras", `id=eq.${obra.id}`);
});
