import { VERSAO_TERMOS } from "@/lib/legal";

export default function Termos() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Termos de uso</h1>
      <p className="mt-1 text-sm text-muted-foreground">Versão {VERSAO_TERMOS}</p>

      <div className="prose prose-sm mt-6 max-w-none text-foreground">
        <p>
          Este texto é um resumo provisório e será substituído pelo documento oficial fornecido pela
          empresa responsável pelo sistema.
        </p>
        <h2>1. Uso do sistema</h2>
        <p>
          O sistema é disponibilizado por assinatura para gestão de obras, orçamentos, faturamento e
          controle financeiro. Cada empresa é responsável pelos dados que cadastra e pelos acessos
          que concede à sua equipe.
        </p>
        <h2>2. Assinatura</h2>
        <p>
          O período de teste e os limites de obras e usuários seguem o plano contratado. A falta de
          pagamento pode suspender a gravação de novos dados, mantendo o acesso de leitura.
        </p>
        <h2>3. Responsabilidades</h2>
        <p>
          A empresa contratante garante que possui autorização para tratar os dados pessoais que
          insere no sistema, inclusive de funcionários, clientes e fornecedores.
        </p>
        <h2>4. Encerramento</h2>
        <p>
          A conta pode ser encerrada a pedido do administrador da empresa, com exportação prévia dos
          dados.
        </p>
      </div>
    </div>
  );
}
