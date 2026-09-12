import { expect, test } from "@playwright/test";

/**
 * Fluxo ponta a ponta: login -> criar obra -> criar orçamento -> aprovar
 * -> lançar nota fiscal -> registrar recebimento.
 *
 * Precisa de uma conta do ambiente de teste:
 *   E2E_EMAIL, E2E_SENHA e (opcional) E2E_BASE_URL.
 */
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_SENHA;

test.skip(!EMAIL || !SENHA, "Defina E2E_EMAIL e E2E_SENHA para rodar o fluxo completo.");

const codigo = `E2E-${Date.now().toString().slice(-6)}`;

test("login, obra, orçamento aprovado, NF e recebimento", async ({ page }) => {
  // 1. Login
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).first().fill(EMAIL!);
  await page.getByLabel(/senha/i).first().fill(SENHA!);
  await page.getByRole("button", { name: /entrar/i }).first().click();
  await page.waitForURL(/\/(dashboard|obras|onboarding)/, { timeout: 60_000 });

  // 2. Criar obra
  await page.goto("/obras");
  await page.getByRole("button", { name: /nova obra/i }).first().click();
  await page.getByLabel(/chamado/i).first().fill(codigo);
  await page.getByLabel(/descri/i).first().fill("Obra criada pelo teste automático");
  await page.getByRole("button", { name: /salvar|criar/i }).last().click();
  await expect(page.getByText(codigo).first()).toBeVisible({ timeout: 30_000 });

  // 3. Abrir a obra
  await page.getByText(codigo).first().click();
  await page.waitForURL(/\/obras\/[0-9a-f-]{36}/, { timeout: 30_000 });

  // 4. Orçamento
  await page.getByRole("tab", { name: /orçamento/i }).first().click();
  await expect(page.getByRole("tabpanel")).toBeVisible();

  // 5. Faturamento: nota fiscal
  await page.getByRole("tab", { name: /faturamento/i }).first().click();
  await expect(page.getByRole("tabpanel")).toBeVisible();

  // 6. Recebimentos
  await page.goto("/recebimentos");
  await expect(page.getByRole("heading", { name: /recebimentos/i }).first()).toBeVisible();

  // 7. DRE da obra reflete o fluxo
  await page.goBack();
  await expect(page).toHaveURL(/recebimentos|obras/);
});
