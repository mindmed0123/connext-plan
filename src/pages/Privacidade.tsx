import { PRAZO_EXCLUSAO_DIAS, VERSAO_PRIVACIDADE } from "@/lib/legal";

export default function Privacidade() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Política de privacidade</h1>
      <p className="mt-1 text-sm text-muted-foreground">Versão {VERSAO_PRIVACIDADE}</p>

      <div className="prose prose-sm mt-6 max-w-none text-foreground">
        <p>
          Este texto é um resumo provisório e será substituído pelo documento oficial fornecido pela
          empresa responsável pelo sistema.
        </p>
        <h2>Quais dados guardamos</h2>
        <ul>
          <li>Dados de acesso: nome, e-mail e histórico de entrada no sistema.</li>
          <li>Dados de funcionários e terceirizados cadastrados pela empresa, incluindo documentos enviados.</li>
          <li>Dados de clientes, compradores e fornecedores usados em contratos, notas fiscais e pagamentos.</li>
        </ul>
        <h2>Para que usamos</h2>
        <p>
          Exclusivamente para operar o sistema contratado: controle de obras, orçamentos,
          faturamento, recebimentos, avisos por e-mail e suporte.
        </p>
        <h2>Por quanto tempo</h2>
        <p>
          Enquanto a assinatura estiver ativa e, depois do encerramento, pelo prazo legal de guarda
          fiscal. Um pedido de exclusão é concluído em até {PRAZO_EXCLUSAO_DIAS} dias.
        </p>
        <h2>Seus direitos</h2>
        <p>
          A empresa pode exportar todos os seus dados a qualquer momento em Configurações e pedir a
          exclusão da conta pela mesma tela.
        </p>
        <h2>Registros técnicos</h2>
        <p>
          Registros de erro guardam apenas identificadores internos. CPF, dados bancários e senhas
          não são gravados nesses registros.
        </p>
      </div>
    </div>
  );
}
