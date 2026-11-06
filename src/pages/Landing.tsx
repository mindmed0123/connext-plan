import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  FileSignature,
  FileText,
  Landmark,
  Lock,
  Menu,
  MessageCircle,
  Receipt,
  Ruler,
  Settings2,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  HardHat,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import logoIcon from "@/assets/logo-icon.png";

/* ============================================================
   Paleta original da landing (azul-marinho + laranja).
   Mantida local para a página pública ser independente do tema do app.
   ============================================================ */
const NAVY_900 = "#0B1F42";
const NAVY_700 = "#152C58";
const NAVY_TEXT = "#0F2448";
const ORANGE = "#EE6616";
const ORANGE_LT = "#FF8C3A";
const SOFT_BG = "#F8F9FC";
const FOOTER_BG = "#070F1E";
const FONT = "'Space Grotesk','Inter',ui-sans-serif,system-ui,sans-serif";

/** Número de WhatsApp do produto (cadastro da empresa dona). Troque aqui. */
const WHATSAPP_NUMERO = "551147703727";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
  "Olá! Quero saber mais sobre o Gestão de Obra.",
)}`;

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

const foco =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6616] focus-visible:ring-offset-2";

/* ============================================================
   Animação de entrada (respeita "reduzir movimento")
   ============================================================ */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Peças básicas
   ============================================================ */
function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`flex items-center gap-2 rounded-lg ${foco}`} aria-label="Gestão de Obra — início">
      <img src={logoIcon} alt="" className="h-10 w-10 rounded-lg object-contain" />
      <span className={`text-[18px] font-bold tracking-tight ${light ? "text-white" : "text-[#0F2448]"}`}>Gestão de Obra</span>
    </Link>
  );
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span
    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
    style={{ backgroundColor: `${ORANGE}1F`, color: ORANGE }}
  >
    {children}
  </span>
);

function BotaoPrimario({
  children,
  to,
  href,
  onClick,
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = { md: "px-5 py-2.5 text-sm", lg: "px-8 py-4 text-base", xl: "px-10 py-5 text-lg" };
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${sizes[size]} ${foco} ${className}`;
  const style = { backgroundColor: ORANGE };
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.backgroundColor = ORANGE_LT);
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.backgroundColor = ORANGE);
  if (href) {
    const externo = href.startsWith("http");
    return (
      <a
        href={href}
        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={cls}
        style={style}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={to ?? "/auth?tab=signup"} className={cls} style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={onClick}>
      {children}
    </Link>
  );
}

function BotaoContorno({
  children,
  to,
  href,
  onClick,
  escuro = false,
  className = "",
}: {
  children: React.ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  escuro?: boolean;
  className?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl border px-8 py-4 text-base font-semibold transition-colors ${foco} ${
    escuro ? "border-white/30 text-white hover:bg-white/10" : "border-[#0F2448] text-[#0F2448] hover:bg-[#0F2448] hover:text-white"
  } ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} onClick={onClick} {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

function Cabecalho({ pill, titulo, sub, escuro = false }: { pill: string; titulo: React.ReactNode; sub?: string; escuro?: boolean }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <Pill>{pill}</Pill>
      <h2 className={`mt-5 text-3xl font-semibold tracking-tight md:text-[42px] md:leading-[1.15] ${escuro ? "text-white" : "text-[#0F2448]"}`}>
        {titulo}
      </h2>
      {sub && <p className={`mt-5 ${escuro ? "text-gray-400" : "text-gray-500"}`}>{sub}</p>}
    </Reveal>
  );
}

/* ============================================================
   Painel de DRE de exemplo (hero) — no estilo do antigo mockup
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
    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl md:rotate-1" style={{ backgroundColor: NAVY_700 }}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-2 w-2 rounded-full bg-red-400/80" />
          <span aria-hidden className="h-2 w-2 rounded-full bg-yellow-400/80" />
          <span aria-hidden className="h-2 w-2 rounded-full bg-green-400/80" />
          <span className="ml-3 text-xs text-white/60">DRE da obra</span>
        </div>
        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: ORANGE }}>
          Exemplo
        </span>
      </div>
      <dl className="px-5 py-3">
        {LINHAS_DRE.map((l) => (
          <div
            key={l.label}
            className={`flex items-baseline justify-between gap-4 py-2.5 ${l.tipo === "total" ? "mt-1 rounded-xl bg-white/5 px-3" : "border-b border-white/5"}`}
          >
            <dt className={`text-[13.5px] ${l.tipo === "total" ? "font-semibold text-white" : "text-white/70"}`}>{l.label}</dt>
            <dd
              className={`text-[14.5px] tabular-nums ${l.tipo === "total" ? "font-bold" : l.tipo === "menos" ? "font-medium text-white/60" : "font-medium text-white/90"}`}
              style={l.tipo === "total" ? { color: ORANGE_LT } : undefined}
            >
              {l.valor}
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-white/10 px-5 py-4 text-[12.5px] leading-relaxed text-white/55">
        Cada linha vem de um lançamento com origem: medição, nota, parcela de terceirizado, compra no cartão. Nada é digitado duas vezes.
      </p>
    </div>
  );
}

/* ============================================================
   Conteúdo (somente o que o sistema faz de verdade)
   ============================================================ */
const DORES = [
  {
    Icon: AlertTriangle,
    t: "A retenção de INSS que derruba o caixa",
    d: "Você fatura 100 e recebe menos. Quando a retenção só aparece no extrato, o planejamento da obra já foi feito com um número que não existe.",
  },
  {
    Icon: CreditCard,
    t: "A compra no cartão que aparece 40 dias depois",
    d: "A fatura chega sem dizer de qual obra é nem de qual etapa. O custo entra no mês errado e a margem da obra vira estimativa.",
  },
  {
    Icon: MessageCircle,
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
  { Icon: BarChart3, t: "Orçado × realizado", d: "Comparativo por etapa e por item, com curva S de previsto contra realizado." },
  { Icon: TrendingUp, t: "Fluxo de caixa", d: "Previsto e realizado mês a mês, com saldo inicial e filtro por conta." },
  { Icon: Receipt, t: "Contas a pagar", d: "Títulos de fornecedores, parcelas e vencimentos, ligados ao razão." },
  { Icon: Landmark, t: "Conciliação bancária", d: "Importação de extrato em OFX e conferência dos lançamentos." },
  { Icon: Wallet, t: "Cartão de crédito", d: "Fatura com o fechamento correto, parcelamento e competência no mês certo." },
  { Icon: HardHat, t: "Terceirizados", d: "Contratações, parcelas e quanto já foi pago em cada obra." },
  { Icon: Building2, t: "Obras e etapas", d: "Obras, etapas, vistorias e relatório fotográfico em PDF com a sua logo." },
  { Icon: Users, t: "Equipe e permissões", d: "Perfis de acesso e permissão por módulo, aplicados em massa ou por pessoa." },
  { Icon: Settings2, t: "Configuração por empresa", d: "Status de obra, plano de contas, listas, regras fiscais e numeração de documentos." },
];

const ICONES_CADEIA = [FileText, FileSignature, Ruler, Receipt, Banknote, BarChart3];

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

const NAV = [
  { l: "Como funciona", h: "#cadeia" },
  { l: "Recursos", h: "#recursos" },
  { l: "Segurança", h: "#seguranca" },
  { l: "Preços", h: "#precos" },
];

/* ============================================================
   Página
   ============================================================ */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    document.title = "Gestão de Obra — sistema para construtoras e prestadoras de serviço";
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
  const claro = scrolled || mobileMenu ? false : true;

  return (
    <div className="min-h-screen bg-white text-[#0F2448]" style={{ fontFamily: FONT, fontFeatureSettings: '"ss01"' }}>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
        @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
      `}</style>

      {/* ===================== TOPO ===================== */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 shadow-sm backdrop-blur-md" : ""}`}
        style={!scrolled ? { backgroundColor: NAVY_900 } : undefined}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-6">
          <Logo light={!scrolled} />
          <nav className="hidden items-center gap-8 md:flex" aria-label="Seções">
            {NAV.map((n) => (
              <a
                key={n.h}
                href={n.h}
                className={`rounded text-sm font-medium transition-colors ${foco} ${scrolled ? "text-gray-600 hover:text-[#0F2448]" : "text-white/80 hover:text-white"}`}
              >
                {n.l}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            <Link to="/auth" className={`rounded text-sm font-medium hover:opacity-80 ${foco} ${scrolled ? "text-[#0F2448]" : "text-white"}`}>
              Entrar
            </Link>
            <BotaoPrimario to="/auth?tab=signup" onClick={cta("topo")}>
              Testar 14 dias
            </BotaoPrimario>
          </div>
          <button
            className={`rounded md:hidden ${foco}`}
            onClick={() => setMobileMenu((v) => !v)}
            aria-label={mobileMenu ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenu}
          >
            {mobileMenu ? (
              <X className={scrolled ? "text-[#0F2448]" : "text-white"} />
            ) : (
              <Menu className={scrolled ? "text-[#0F2448]" : "text-white"} />
            )}
          </button>
        </div>
        {mobileMenu && (
          <div className="border-t border-white/10 px-6 py-4 md:hidden" style={{ backgroundColor: NAVY_900 }}>
            <nav className="flex flex-col gap-3 text-white" aria-label="Seções">
              {NAV.map((n) => (
                <a key={n.h} href={n.h} onClick={() => setMobileMenu(false)}>
                  {n.l}
                </a>
              ))}
              <Link to="/auth" className="border-t border-white/10 pt-3">
                Entrar
              </Link>
              <BotaoPrimario to="/auth?tab=signup" onClick={cta("topo_mobile")}>
                Testar 14 dias
              </BotaoPrimario>
            </nav>
          </div>
        )}
      </header>

      {/* ===================== HERO ===================== */}
      <section style={{ backgroundColor: NAVY_900 }} className="relative overflow-hidden pt-[72px]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-12 md:items-center md:px-6 md:py-28">
          <div className="md:col-span-7">
            <Reveal>
              <Pill>✦ Para construtoras e prestadoras de serviço</Pill>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-[38px] font-bold leading-[1.1] text-white md:text-[60px]">
                Sua obra fecha <span style={{ color: ORANGE }}>no centavo</span>,<br className="hidden md:block" /> não no achismo.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-lg text-[#94A3B8] md:text-xl">
                Do orçamento à medição, da nota fiscal ao recebimento: um só lugar para saber quanto cada obra já custou, quanto ainda entra e o
                que está atrasado. Sem planilha paralela, sem esperar o fechamento do mês.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <BotaoPrimario size="lg" to="/auth?tab=signup" onClick={cta("hero")}>
                  Começar teste de 14 dias <ArrowRight className="h-5 w-5" />
                </BotaoPrimario>
                <BotaoContorno escuro href="#cadeia" onClick={cta("hero_como_funciona")}>
                  Ver como funciona
                </BotaoContorno>
              </div>
              <p className="mt-4 text-xs text-[#64748B]">14 dias grátis, sem cartão • Cancele quando quiser • Dados de cada empresa isolados</p>
            </Reveal>
          </div>
          <div className="md:col-span-5">
            <Reveal delay={120}>
              <PainelDre />
            </Reveal>
          </div>
        </div>
        <div className="mx-auto h-[3px] w-20" style={{ backgroundColor: ORANGE }} />
      </section>

      {/* ===================== DORES ===================== */}
      <section className="bg-white py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-6">
          <Cabecalho pill="O problema" titulo="Três coisas que a planilha não resolve" />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {DORES.map((d, i) => (
              <Reveal key={d.t} delay={i * 80}>
                <div className="h-full rounded-2xl border border-gray-200 bg-white p-8 transition-transform hover:scale-[1.01]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${ORANGE}1A`, color: ORANGE }}>
                    <d.Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#0F2448]">{d.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{d.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <ChevronDown className="h-8 w-8 animate-bounce" style={{ color: ORANGE }} aria-hidden />
          </div>
        </div>
      </section>

      {/* ===================== CADEIA ===================== */}
      <section id="cadeia" className="scroll-mt-20 py-20 md:py-24" style={{ backgroundColor: SOFT_BG }}>
        <div className="mx-auto max-w-7xl px-5 md:px-6">
          <Cabecalho
            pill="Como funciona"
            titulo="A cadeia inteira da obra, ligada de ponta a ponta"
            sub="Cada etapa alimenta a seguinte. O que você registra uma vez aparece no lugar certo até o resultado da obra."
          />
          <ol className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CADEIA.map((c, i) => {
              const Icon = ICONES_CADEIA[i];
              return (
                <Reveal key={c.n} delay={i * 60}>
                  <li className="relative h-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 transition-transform hover:scale-[1.02]">
                    <div className="absolute right-4 top-2 text-6xl font-bold" style={{ color: `${ORANGE}26` }} aria-hidden>
                      {c.n}
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ORANGE}1A`, color: ORANGE }}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-[#0F2448]">
                      <span className="sr-only">Etapa {c.n}: </span>
                      {c.t}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{c.d}</p>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ===================== RECURSOS ===================== */}
      <section id="recursos" className="scroll-mt-20 bg-white py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-6">
          <Cabecalho pill="Recursos" titulo="O que você passa a enxergar" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ENXERGAR.map((e, i) => (
              <Reveal key={e.t} delay={(i % 3) * 60}>
                <div className="h-full rounded-xl p-6 transition-transform hover:scale-[1.02]" style={{ backgroundColor: SOFT_BG }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ORANGE}1A`, color: ORANGE }}>
                    <e.Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#0F2448]">{e.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{e.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== SEGURANÇA ===================== */}
      <section id="seguranca" className="scroll-mt-20 py-20 text-white md:py-24" style={{ backgroundColor: NAVY_900 }}>
        <div className="mx-auto max-w-7xl px-5 md:px-6">
          <Cabecalho escuro pill="Segurança" titulo="Os dados da sua empresa são só seus" />
          <ul className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-2">
            {SEGURANCA.map((s, i) => (
              <Reveal key={s} delay={i * 60}>
                <li className="flex h-full gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-[15px] leading-relaxed text-white/85">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${ORANGE}26`, color: ORANGE }}>
                    {i === 0 ? <Lock className="h-4 w-4" aria-hidden /> : i === 1 ? <Shield className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                  </span>
                  {s}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ===================== QUEM CONSTRUIU ===================== */}
      <section className="py-20 md:py-24" style={{ backgroundColor: SOFT_BG }}>
        <div className="mx-auto max-w-3xl px-5 text-center md:px-6">
          <Reveal>
            <Pill>Quem construiu</Pill>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              O sistema roda todo dia na Potência Soluções, empresa de execução de obras e manutenção em São Paulo. Cada regra aqui dentro nasceu
              de um problema real de obra: uma retenção que não batia, uma fatura de cartão sem dono, uma medição que passou do contrato.
            </p>
            <p className="mt-6 text-sm font-semibold text-[#0F2448]">Pedro Suassuna · Potência Soluções Engenharia · São Paulo</p>
          </Reveal>
        </div>
      </section>

      {/* ===================== FAIXA DE OFERTA ===================== */}
      <section className="px-5 py-12" style={{ backgroundColor: ORANGE }}>
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 md:flex-row md:items-center md:px-1">
          <p className="text-2xl font-bold leading-tight text-white md:text-[30px]">14 dias grátis. Sem cartão de crédito.</p>
          <Link
            to="/auth?tab=signup"
            onClick={cta("faixa")}
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#EE6616]"
            style={{ backgroundColor: NAVY_900 }}
          >
            Criar minha conta <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ===================== PREÇOS ===================== */}
      <section id="precos" className="scroll-mt-20 bg-white py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-6">
          <Cabecalho
            pill="Planos e preços"
            titulo={
              <>
                Comece pequeno.
                <br />
                Cresça sem trocar de sistema.
              </>
            }
            sub="Todos os planos começam com 14 dias grátis, sem cartão. No plano anual você paga 10 meses e usa 12."
          />

          {isLoading && (
            <div className="mt-12 grid gap-6 md:grid-cols-3" aria-live="polite">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl border border-gray-200" style={{ backgroundColor: SOFT_BG }} />
              ))}
            </div>
          )}

          {isError && (
            <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Não foi possível carregar os planos agora.</p>
              <div className="mt-5">
                <BotaoContorno to="/pricing" onClick={cta("planos_erro")}>
                  Ver planos
                </BotaoContorno>
              </div>
            </div>
          )}

          {!isLoading && !isError && (
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {planos?.map((p) => {
                const enterprise = p.slug === "enterprise";
                return (
                  <div
                    key={p.id}
                    className={`relative flex flex-col rounded-2xl bg-white p-8 ${p.destaque ? "border-2 shadow-lg" : "border border-gray-200 shadow-sm"}`}
                    style={p.destaque ? { borderColor: ORANGE } : undefined}
                  >
                    {p.destaque && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: ORANGE }}
                      >
                        Mais escolhido
                      </span>
                    )}
                    <h3
                      className="text-sm font-semibold uppercase tracking-wider"
                      style={{ color: p.destaque ? ORANGE : "#6B7280" }}
                    >
                      {p.nome}
                    </h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-bold tabular-nums text-[#0F2448]">{brl(Number(p.preco_mensal))}</span>
                      <span className="text-sm text-gray-500">/mês</span>
                    </div>
                    <p className="mt-1 text-sm tabular-nums text-gray-500">ou R$ {brl2(Number(p.preco_anual))} por ano</p>
                    {p.descricao && <p className="mt-3 text-sm text-gray-500">{p.descricao}</p>}
                    <ul className="mt-6 space-y-3 text-sm text-[#0F2448]">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ORANGE }} aria-hidden />
                        {p.limite_obras ? `Até ${p.limite_obras} obras` : "Obras ilimitadas"}
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ORANGE }} aria-hidden />
                        {p.limite_usuarios ? `Até ${p.limite_usuarios} usuários` : "Usuários ilimitados"}
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ORANGE }} aria-hidden />
                        14 dias grátis, sem cartão
                      </li>
                    </ul>
                    <div className="mt-auto pt-8">
                      {enterprise ? (
                        <BotaoContorno href={WHATSAPP_URL} onClick={cta(`plano_${p.slug}`)} className="w-full !px-6 !py-3 !text-sm">
                          Falar no WhatsApp
                        </BotaoContorno>
                      ) : p.destaque ? (
                        <BotaoPrimario to={`/auth?tab=signup&plano=${p.slug}`} onClick={cta(`plano_${p.slug}`)} className="w-full !px-6 !py-3">
                          Começar teste de 14 dias
                        </BotaoPrimario>
                      ) : (
                        <BotaoContorno to={`/auth?tab=signup&plano=${p.slug}`} onClick={cta(`plano_${p.slug}`)} className="w-full !px-6 !py-3 !text-sm">
                          Começar teste de 14 dias
                        </BotaoContorno>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="suporte" className="scroll-mt-20 py-20 md:py-24" style={{ backgroundColor: SOFT_BG }}>
        <div className="mx-auto max-w-[720px] px-5 md:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[#0F2448] md:text-[42px]">Dúvidas frequentes</h2>
          <Accordion type="single" collapsible className="mt-12 rounded-2xl border border-gray-200 bg-white px-6">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`} className={i === FAQ.length - 1 ? "border-b-0" : ""}>
                <AccordionTrigger className="text-left text-[#0F2448]">{f.q}</AccordionTrigger>
                <AccordionContent className="text-gray-600">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ===================== CTA FINAL ===================== */}
      <section style={{ backgroundColor: NAVY_900 }} className="py-20 text-center text-white md:py-28">
        <div className="mx-auto max-w-3xl px-5 md:px-6">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Comece pela obra que mais te preocupa hoje.</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-400 md:text-xl">
            Cadastre uma obra, lance o orçamento e veja a DRE dela sair. Em uma hora você já sabe se o sistema serve para a sua operação.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <BotaoPrimario size="xl" to="/auth?tab=signup" onClick={cta("final")}>
              Criar minha conta <ArrowRight className="h-5 w-5" />
            </BotaoPrimario>
            <BotaoContorno escuro href={WHATSAPP_URL} onClick={cta("final_whatsapp")}>
              <MessageCircle className="h-5 w-5" aria-hidden /> Falar no WhatsApp
            </BotaoContorno>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-white/60 md:gap-12">
            <span className="flex items-center gap-2"><Shield className="h-4 w-4" aria-hidden /> Dados isolados por empresa</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden /> 14 dias grátis, sem cartão</span>
            <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4" aria-hidden /> Suporte em português</span>
          </div>
        </div>
      </section>

      {/* ===================== RODAPÉ ===================== */}
      <footer className="py-14 text-gray-400" style={{ backgroundColor: FOOTER_BG }}>
        <div className="mx-auto max-w-7xl px-5 md:px-6">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <Logo light />
              <p className="mt-4 max-w-xs text-sm text-gray-500">Sistema de gestão de obras para construtoras e prestadoras de serviço.</p>
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-wider text-white">Contato</div>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`rounded hover:text-white ${foco}`}>
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href="mailto:comercial@potenciasolucoes.com.br" className={`rounded hover:text-white ${foco}`}>
                    comercial@potenciasolucoes.com.br
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-wider text-white">Produto</div>
              <ul className="mt-4 space-y-2 text-sm">
                {NAV.map((n) => (
                  <li key={n.h}>
                    <a href={n.h} className={`rounded hover:text-white ${foco}`}>
                      {n.l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-sm text-gray-500 md:flex-row">
            <div>© {new Date().getFullYear()} Gestão de Obra · Potência Soluções Engenharia · São Paulo</div>
            <div className="flex gap-4">
              <Link to="/termos" className={`rounded hover:text-white ${foco}`}>
                Termos de uso
              </Link>
              <Link to="/privacidade" className={`rounded hover:text-white ${foco}`}>
                Política de privacidade
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
