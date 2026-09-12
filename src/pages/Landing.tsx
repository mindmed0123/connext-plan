import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import logoIcon from "@/assets/logo-icon.png";

/* ============================================================
   Paleta e constantes locais (página pública, independente)
   ============================================================ */
const BG = "#F1F2EF";
const CARD = "#FBFBF9";
const INK = "#14181A";
const INK_2 = "#56605E";
const DARK = "#15191A";
const YELLOW = "#F0C419";
const LINE = "#DCDED8";

/** Número de WhatsApp do produto (cadastro da empresa dona). Troque aqui. */
const WHATSAPP_NUMERO = "551147703727";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
  "Olá! Quero saber mais sobre o Gestão de Obra.",
)}`;

const FONT_TITULO = "'Archivo', ui-sans-serif, system-ui, 'Segoe UI', sans-serif";
const FONT_CORPO = "'Public Sans', ui-sans-serif, system-ui, 'Segoe UI', sans-serif";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const brl2 = (v: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

type Plano = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number;
  limite_obras: number | null;
  limite_usuarios: number | null;
  destaque: boolean;
  ordem: number;
};

/* ============================================================
   Peças básicas
   ============================================================ */
const foco =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#14181A] focus-visible:ring-offset-[#F1F2EF]";

function BotaoPrimario({
  children,
  to,
  href,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-2 border border-[#14181A] px-6 py-3 text-[15px] font-bold transition-colors hover:bg-[#e0b40f] ${foco} ${className}`;
  const style = { backgroundColor: YELLOW, color: INK, fontFamily: FONT_TITULO, borderRadius: 4 };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to ?? "/auth?tab=signup"} className={cls} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}

function BotaoSecundario({
  children,
  href,
  to,
  onClick,
  escuro = false,
}: {
  children: React.ReactNode;
  href?: string;
  to?: string;
  onClick?: () => void;
  escuro?: boolean;
}) {
  const cls = `inline-flex items-center justify-center gap-2 border px-6 py-3 text-[15px] font-bold transition-colors ${foco} ${
    escuro ? "border-white/40 text-white hover:bg-white/10" : "border-[#14181A] text-[#14181A] hover:bg-[#14181A] hover:text-[#F1F2EF]"
  }`;
  const style = { fontFamily: FONT_TITULO, borderRadius: 4 };
  if (to) {
    return (
      <Link to={to} className={cls} style={style} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} style={style} onClick={onClick} {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

function Titulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-[28px] font-extrabold leading-[1.15] md:text-[38px] ${className}`} style={{ fontFamily: FONT_TITULO }}>
      {children}
    </h2>
  );
}

function Secao({
  id,
  children,
  escuro = false,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  escuro?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 border-t px-5 py-14 md:py-20 ${className}`}
      style={{ backgroundColor: escuro ? DARK : "transparent", borderColor: escuro ? DARK : LINE, color: escuro ? "#F1F2EF" : INK }}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

/* ============================================================
   Painel de DRE de exemplo (hero)
   ============================================================ */
const LINHAS_DRE: { label: string; valor: string; tipo?: "menos" | "total" }[] = [
  { label: "Contratado + aditivos", valor: "184.500,00" },
  { label: "Medido e aprovado", valor: "142.300,00" },
  { label: "Faturado (NF)", valor: "128.000,00" },
  { label: "(−) Retenções na fonte", valor: "18.560,00", tipo: "menos" },
  { label: "Recebido em caixa", valor: "96.240,00" },
  { label: "(−) Terceirizados pagos", valor: "41.800,00", tipo: "menos" },
  { label: "(−) Materiais e cartão", valor: "22.950,00", tipo: "menos" },
  { label: "Margem realizada", valor: "31.490,00", tipo: "total" },
];

function PainelDre() {
  return (
    <div className="border p-5 md:p-6" style={{ backgroundColor: DARK, borderColor: DARK, borderRadius: 4 }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold uppercase tracking-wider text-white/60" style={{ fontFamily: FONT_TITULO }}>
          DRE da obra
        </div>
        <span
          className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: YELLOW, color: INK, fontFamily: FONT_TITULO, borderRadius: 3 }}
        >
          Exemplo
        </span>
      </div>
      <dl className="divide-y divide-white/10">
        {LINHAS_DRE.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className={`text-[14px] ${l.tipo === "total" ? "font-bold text-white" : "text-white/75"}`}>{l.label}</dt>
            <dd
              className={`text-[15px] tabular-nums ${l.tipo === "total" ? "font-extrabold text-white" : "font-semibold text-white/90"}`}
              style={{ fontFamily: FONT_TITULO, fontVariantNumeric: "tabular-nums" }}
            >
              {l.valor}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-white/10 pt-4 text-[12.5px] leading-relaxed text-white/60">
        Cada linha vem de um lançamento com origem: medição, nota, parcela de terceirizado, compra no cartão. Nada é digitado duas vezes.
      </p>
    </div>
  );
}

/* ============================================================
   Conteúdo
   ============================================================ */
const DORES = [
  {
    t: "A retenção de INSS que derruba o caixa",
    d: "Você fatura 100 e recebe menos. Quando a retenção só aparece no extrato, o planejamento da obra já foi feito com um número que não existe.",
  },
  {
    t: "A compra no cartão que aparece 40 dias depois",
    d: "A fatura chega sem dizer de qual obra é nem de qual etapa. O custo entra no mês errado e a margem da obra vira estimativa.",
  },
  {
    t: "O cliente perguntando quanto sobrou",
    d: "A resposta depende de abrir quatro arquivos, conferir o que foi medido, o que foi pago e torcer para as versões baterem.",
  },
];

const CADEIA = [
  { n: "01", t: "Orçamento", d: "Itens, composição com BDI (AC, S, R, DF, L, I) e PDF com a logo e as cores da sua empresa." },
  { n: "02", t: "Contrato", d: "Valor global, prazo e retenção contratual. Aditivos entram no contrato e recalculam o valor da obra." },
  { n: "03", t: "Medição", d: "Medição acumulada por item, sem deixar passar do contrato mais os aditivos já assinados." },
  { n: "04", t: "Nota fiscal", d: "INSS, ISS, IRRF e PIS/COFINS/CSLL calculados pelas regras da sua empresa. Você vê o líquido antes de emitir." },
  { n: "05", t: "Recebimento", d: "Inclusive parcial: cada pagamento entra na data em que caiu, e o saldo continua em aberto." },
  { n: "06", t: "DRE da obra", d: "Receita, custo, margem e saldo da obra, montados a partir dos lançamentos, não de uma planilha à parte." },
];

const ENXERGAR = [
  { t: "Orçado × realizado", d: "Comparativo por etapa e por item, com curva S de previsto contra realizado." },
  { t: "Fluxo de caixa", d: "Previsto e realizado mês a mês, com saldo inicial e filtro por conta." },
  { t: "Contas a pagar", d: "Títulos de fornecedores, parcelas e vencimentos, ligados ao razão." },
  { t: "Conciliação bancária", d: "Importação de extrato em OFX e conferência dos lançamentos." },
  { t: "Cartão de crédito", d: "Fatura com o fechamento correto, parcelamento e competência no mês certo." },
  { t: "Terceirizados", d: "Contratações, parcelas e quanto já foi pago em cada obra." },
  { t: "Obras e etapas", d: "Obras, etapas, vistorias e relatório fotográfico em PDF com a sua logo." },
  { t: "Equipe e permissões", d: "Perfis de acesso e permissão por módulo, aplicados em massa ou por pessoa." },
  { t: "Configuração por empresa", d: "Status de obra, plano de contas, listas, regras fiscais e numeração de documentos." },
];

const SEGURANCA = [
  "Isolamento por empresa aplicado linha a linha, dentro do banco de dados.",
  "Teste automático que cria duas empresas e tenta ler e gravar de uma na outra, rodado a cada alteração.",
  "Registro de auditoria das ações críticas.",
  "Acesso do suporte registrado.",
  "Exportação e exclusão dos dados conforme a LGPD.",
];

const FAQ = [
  {
    q: "Preciso de cartão de crédito para testar?",
    a: "Não. São 14 dias com acesso completo, sem cadastrar cartão. Se você não assinar, a conta simplesmente para de gravar.",
  },
  {
    q: "O sistema emite nota fiscal?",
    a: "Ainda não. Ele registra a nota emitida no seu emissor, calcula as retenções (INSS, ISS, IRRF, PIS/COFINS/CSLL) e mostra o valor líquido, já ligado ao recebimento.",
  },
  {
    q: "Meus dados podem se misturar com os de outra empresa?",
    a: "Cada registro pertence a uma empresa e o banco de dados bloqueia leitura e gravação fora dela. Existe um teste automático que tenta esse acesso a cada alteração do sistema.",
  },
  {
    q: "Dá para usar do jeito da minha empresa?",
    a: "Sim. Status de obra, vocabulário, plano de contas, centros de custo, perfis de permissão, alíquotas, BDI padrão e numeração de documentos são configurados por empresa.",
  },
  {
    q: "Consigo trazer o que já tenho em planilha?",
    a: "Os cadastros iniciais são feitos na mão ou com a nossa ajuda no começo do uso. O extrato bancário pode ser importado em OFX.",
  },
  {
    q: "E se eu quiser cancelar?",
    a: "Cancela quando quiser, sem multa e sem fidelidade. Você continua podendo exportar os seus dados.",
  },
];

/* ============================================================
   Página
   ============================================================ */
export default function Landing() {
  useEffect(() => {
    document.title = "Gestão de Obra — sistema para construtoras e prestadoras de serviço";
  }, []);

  const { data: planos, isLoading, isError } = useQuery({
    queryKey: ["landing-planos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("id,slug,nome,descricao,preco_mensal,preco_anual,limite_obras,limite_usuarios,destaque,ordem")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as Plano[];
    },
    retry: 1,
  });

  const cta = (origem: string) => () => trackEvent("cta_click", { origem });

  return (
    <div style={{ backgroundColor: BG, color: INK, fontFamily: FONT_CORPO }} className="min-h-screen">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
        @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
      `}</style>

      {/* ---------- Topo fixo ---------- */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: BG, borderColor: LINE }}>
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" className={`flex items-center gap-2 ${foco}`} aria-label="Gestão de Obra — início">
            <img src={logoIcon} alt="" className="h-8 w-8 object-contain" />
            <span className="text-[16px] font-extrabold tracking-tight" style={{ fontFamily: FONT_TITULO }}>
              Gestão de Obra
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Seções">
            {[
              { l: "Como funciona", h: "#cadeia" },
              { l: "Recursos", h: "#recursos" },
              { l: "Segurança", h: "#seguranca" },
              { l: "Preços", h: "#precos" },
            ].map((n) => (
              <a key={n.h} href={n.h} className={`text-[14px] font-medium hover:underline ${foco}`} style={{ color: INK_2 }}>
                {n.l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" className={`hidden text-[14px] font-semibold sm:inline ${foco}`}>
              Entrar
            </Link>
            <BotaoPrimario to="/auth?tab=signup" onClick={cta("topo")} className="!px-4 !py-2 !text-[14px]">
              Testar 14 dias
            </BotaoPrimario>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="px-5 py-12 md:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-[34px] font-extrabold leading-[1.08] md:text-[52px]" style={{ fontFamily: FONT_TITULO }}>
              Sua obra fecha{" "}
              <span className="box-decoration-clone px-2" style={{ backgroundColor: YELLOW, color: INK }}>
                no centavo
              </span>
              , não no achismo.
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed md:text-[17px]" style={{ color: INK_2 }}>
              Do orçamento à medição, da nota fiscal ao recebimento: um só lugar para saber quanto cada obra já custou, quanto ainda entra e o
              que está atrasado. Sem planilha paralela, sem esperar o fechamento do mês.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <BotaoPrimario to="/auth?tab=signup" onClick={cta("hero")}>
                Começar teste de 14 dias
              </BotaoPrimario>
              <BotaoSecundario href="#cadeia" onClick={cta("hero_como_funciona")}>
                Ver como funciona
              </BotaoSecundario>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] font-medium" style={{ color: INK_2 }}>
              {["14 dias grátis, sem cartão", "Cancele quando quiser", "Dados de cada empresa isolados"].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span aria-hidden className="inline-block h-1.5 w-1.5" style={{ backgroundColor: INK }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <PainelDre />
        </div>
      </section>

      {/* ---------- Dores ---------- */}
      <Secao>
        <Titulo>Três coisas que a planilha não resolve</Titulo>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {DORES.map((d) => (
            <div key={d.t} className="border p-5" style={{ backgroundColor: CARD, borderColor: LINE, borderRadius: 4 }}>
              <h3 className="text-[17px] font-bold leading-snug" style={{ fontFamily: FONT_TITULO }}>
                {d.t}
              </h3>
              <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: INK_2 }}>
                {d.d}
              </p>
            </div>
          ))}
        </div>
      </Secao>

      {/* ---------- Cadeia ---------- */}
      <Secao id="cadeia">
        <Titulo>A cadeia inteira da obra, ligada de ponta a ponta</Titulo>
        <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed" style={{ color: INK_2 }}>
          Cada etapa alimenta a seguinte. O que você registra uma vez aparece no lugar certo até o resultado da obra.
        </p>
        <ol className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {CADEIA.map((c) => (
            <li key={c.n} className="border p-4 md:p-5" style={{ backgroundColor: CARD, borderColor: LINE, borderRadius: 4, borderTop: `3px solid ${INK}` }}>
              <div className="text-[13px] font-extrabold tabular-nums" style={{ fontFamily: FONT_TITULO, color: INK_2, fontVariantNumeric: "tabular-nums" }}>
                {c.n}
              </div>
              <h3 className="mt-1 text-[17px] font-bold" style={{ fontFamily: FONT_TITULO }}>
                {c.t}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
                {c.d}
              </p>
            </li>
          ))}
        </ol>
      </Secao>

      {/* ---------- Recursos ---------- */}
      <Secao id="recursos">
        <Titulo>O que você passa a enxergar</Titulo>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENXERGAR.map((e) => (
            <div key={e.t} className="border p-5" style={{ backgroundColor: CARD, borderColor: LINE, borderRadius: 4 }}>
              <h3 className="text-[16px] font-bold" style={{ fontFamily: FONT_TITULO }}>
                {e.t}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
                {e.d}
              </p>
            </div>
          ))}
        </div>
      </Secao>

      {/* ---------- Segurança ---------- */}
      <Secao id="seguranca" escuro>
        <Titulo>Os dados da sua empresa são só seus</Titulo>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {SEGURANCA.map((s) => (
            <li key={s} className="flex gap-3 border border-white/15 p-4 text-[15px] leading-relaxed text-white/85" style={{ borderRadius: 4 }}>
              <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0" style={{ backgroundColor: YELLOW }} />
              {s}
            </li>
          ))}
        </ul>
      </Secao>

      {/* ---------- Quem construiu ---------- */}
      <Secao>
        <div className="max-w-3xl">
          <Titulo>Quem construiu</Titulo>
          <p className="mt-5 text-[16px] leading-relaxed" style={{ color: INK_2 }}>
            O sistema roda todo dia na Potência Soluções, empresa de execução de obras e manutenção em São Paulo. Cada regra aqui dentro nasceu
            de um problema real de obra: uma retenção que não batia, uma fatura de cartão sem dono, uma medição que passou do contrato.
          </p>
          <p className="mt-5 text-[15px] font-bold" style={{ fontFamily: FONT_TITULO }}>
            Pedro Suassuna · Potência Soluções Engenharia · São Paulo
          </p>
        </div>
      </Secao>

      {/* ---------- Faixa de oferta ---------- */}
      <section className="border-y px-5 py-10" style={{ backgroundColor: YELLOW, borderColor: INK }}>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <p className="text-[22px] font-extrabold leading-tight md:text-[28px]" style={{ fontFamily: FONT_TITULO, color: INK }}>
            14 dias grátis. Sem cartão de crédito.
          </p>
          <Link
            to="/auth?tab=signup"
            onClick={cta("faixa")}
            className={`inline-flex items-center border border-[#14181A] bg-[#14181A] px-6 py-3 text-[15px] font-bold text-[#F1F2EF] transition-colors hover:bg-[#000] ${foco}`}
            style={{ fontFamily: FONT_TITULO, borderRadius: 4 }}
          >
            Criar minha conta
          </Link>
        </div>
      </section>

      {/* ---------- Preços ---------- */}
      <Secao id="precos">
        <Titulo>Preços</Titulo>
        <p className="mt-4 text-[15.5px]" style={{ color: INK_2 }}>
          Todos os planos começam com 14 dias grátis, sem cartão. No plano anual você paga 10 meses e usa 12.
        </p>

        {isLoading && (
          <div className="mt-8 grid gap-4 md:grid-cols-3" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse border" style={{ backgroundColor: CARD, borderColor: LINE, borderRadius: 4 }} />
            ))}
          </div>
        )}

        {isError && (
          <div className="mt-8 border p-6" style={{ backgroundColor: CARD, borderColor: LINE, borderRadius: 4 }}>
            <p className="text-[15px]" style={{ color: INK_2 }}>
              Não foi possível carregar os planos agora.
            </p>
            <div className="mt-4">
              <BotaoSecundario to="/pricing" onClick={cta("planos_erro")}>
                Ver planos
              </BotaoSecundario>
            </div>
          </div>
        )}

        {!isLoading && !isError && (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {planos?.map((p) => {
              const enterprise = p.slug === "enterprise";
              return (
                <div
                  key={p.id}
                  className="flex flex-col border p-6"
                  style={{
                    backgroundColor: CARD,
                    borderColor: p.destaque ? INK : LINE,
                    borderWidth: p.destaque ? 2 : 1,
                    borderRadius: 4,
                  }}
                >
                  {p.destaque && (
                    <span
                      className="mb-3 w-fit px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: YELLOW, color: INK, fontFamily: FONT_TITULO, borderRadius: 3 }}
                    >
                      Mais escolhido
                    </span>
                  )}
                  <h3 className="text-[20px] font-extrabold" style={{ fontFamily: FONT_TITULO }}>
                    {p.nome}
                  </h3>
                  {p.descricao && (
                    <p className="mt-1 text-[14px]" style={{ color: INK_2 }}>
                      {p.descricao}
                    </p>
                  )}
                  <div className="mt-5">
                    <div className="text-[34px] font-extrabold tabular-nums" style={{ fontFamily: FONT_TITULO, fontVariantNumeric: "tabular-nums" }}>
                      {brl(Number(p.preco_mensal))}
                      <span className="text-[15px] font-semibold" style={{ color: INK_2 }}>
                        /mês
                      </span>
                    </div>
                    <p className="mt-1 text-[13.5px] tabular-nums" style={{ color: INK_2, fontVariantNumeric: "tabular-nums" }}>
                      ou R$ {brl2(Number(p.preco_anual))} por ano
                    </p>
                  </div>
                  <ul className="mt-5 space-y-2 text-[14.5px]" style={{ color: INK_2 }}>
                    <li className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {p.limite_obras ? `Até ${p.limite_obras} obras` : "Obras ilimitadas"}
                    </li>
                    <li className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {p.limite_usuarios ? `Até ${p.limite_usuarios} usuários` : "Usuários ilimitados"}
                    </li>
                  </ul>
                  <div className="mt-6 pt-1">
                    {enterprise ? (
                      <BotaoSecundario href={WHATSAPP_URL} onClick={cta(`plano_${p.slug}`)}>
                        Falar no WhatsApp
                      </BotaoSecundario>
                    ) : (
                      <BotaoPrimario to={`/auth?tab=signup&plano=${p.slug}`} onClick={cta(`plano_${p.slug}`)}>
                        Começar teste de 14 dias
                      </BotaoPrimario>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Secao>

      {/* ---------- FAQ ---------- */}
      <Secao>
        <Titulo>Perguntas frequentes</Titulo>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group border p-5" style={{ backgroundColor: CARD, borderColor: LINE, borderRadius: 4 }}>
              <summary className={`cursor-pointer list-none text-[16px] font-bold ${foco}`} style={{ fontFamily: FONT_TITULO }}>
                {f.q}
              </summary>
              <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: INK_2 }}>
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </Secao>

      {/* ---------- CTA final ---------- */}
      <Secao escuro>
        <div className="max-w-2xl">
          <Titulo>Comece pela obra que mais te preocupa hoje.</Titulo>
          <p className="mt-5 text-[16px] leading-relaxed text-white/75">
            Cadastre uma obra, lance o orçamento e veja a DRE dela sair. Em uma hora você já sabe se o sistema serve para a sua operação.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <BotaoPrimario to="/auth?tab=signup" onClick={cta("final")}>
              Criar minha conta
            </BotaoPrimario>
            <BotaoSecundario href={WHATSAPP_URL} escuro onClick={cta("final_whatsapp")}>
              Falar no WhatsApp
            </BotaoSecundario>
          </div>
        </div>
      </Secao>

      {/* ---------- Rodapé ---------- */}
      <footer className="border-t px-5 py-10" style={{ borderColor: LINE }}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <img src={logoIcon} alt="" className="h-7 w-7 object-contain" loading="lazy" />
            <span className="text-[15px] font-extrabold" style={{ fontFamily: FONT_TITULO }}>
              Gestão de Obra
            </span>
          </div>
          <div className="text-[14px]" style={{ color: INK_2 }}>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`hover:underline ${foco}`}>
              WhatsApp
            </a>
            <span className="px-2">·</span>
            <a href="mailto:comercial@potenciasolucoes.com.br" className={`hover:underline ${foco}`}>
              comercial@potenciasolucoes.com.br
            </a>
          </div>
          <div className="text-[14px]" style={{ color: INK_2 }}>
            <Link to="/privacidade" className={`hover:underline ${foco}`}>
              Política de privacidade
            </Link>
            <span className="px-2">·</span>
            <Link to="/termos" className={`hover:underline ${foco}`}>
              Termos de uso
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-6 w-full max-w-6xl text-[13px]" style={{ color: INK_2 }}>
          © {new Date().getFullYear()} Gestão de Obra · Potência Soluções Engenharia · São Paulo
        </p>
      </footer>
    </div>
  );
}
