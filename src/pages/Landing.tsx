import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Columns,
  DollarSign,
  FileText,
  Hammer,
  HardHat,
  Receipt,
  Shield,
  Star,
  Users,
  Wallet,
  Zap,
  MessageCircle,
  AlertTriangle,
  Banknote,
  FolderOpen,
  Building2,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---------- Local design tokens (kept inline so the landing is independent) ----------
const NAVY_900 = "#0B1F42";
const NAVY_800 = "#0F2448";
const NAVY_700 = "#152C58";
const ORANGE = "#EE6616";
const ORANGE_LT = "#FF8C3A";

// ---------- Reveal on scroll helper ----------
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"} ${className}`}
    >
      {children}
    </div>
  );
}

// ---------- Animated counter ----------
function Counter({ to, prefix = "", suffix = "", decimals = 0, duration = 1500 }: { to: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          setVal(to * (0.2 + 0.8 * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
          else setVal(to);
        };
        requestAnimationFrame(tick);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  const formatted = val.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// ---------- Logo ----------
function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: ORANGE }}
      >
        <Building2 className="h-5 w-5 text-white" />
      </div>
      <span className={`text-[18px] font-bold tracking-tight ${light ? "text-white" : "text-[#0F2448]"}`}>
        Gestão de Obra
      </span>
    </div>
  );
}

// ---------- Section helpers ----------
const Pill = ({ children }: { children: React.ReactNode }) => (
  <span
    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
    style={{ backgroundColor: `${ORANGE}1F`, color: ORANGE }}
  >
    {children}
  </span>
);

const PrimaryCTA = ({
  children,
  to,
  href,
  size = "md",
}: {
  children: React.ReactNode;
  to?: string;
  href?: string;
  size?: "md" | "lg" | "xl";
}) => {
  const sizes: Record<string, string> = {
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base",
    xl: "px-10 py-5 text-lg",
  };
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${sizes[size]}`;
  const style = { backgroundColor: ORANGE };
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => ((e.currentTarget as HTMLElement).style.backgroundColor = ORANGE_LT);
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => ((e.currentTarget as HTMLElement).style.backgroundColor = ORANGE);
  if (href) {
    const isAnchor = href.startsWith("#");
    return (
      <a
        href={href}
        target={isAnchor ? undefined : "_blank"}
        rel={isAnchor ? undefined : "noopener noreferrer"}
        className={cls}
        style={style}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={to ?? "/auth"} className={cls} style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
      {children}
    </Link>
  );
};

// ---------- Mockup of the dashboard for the hero ----------
function HeroMockup() {
  const obras = [
    { nome: "Residencial Aurora", status: "Em execução", color: "#3B82F6", valor: "R$ 84.200" },
    { nome: "Galpão Industrial Sul", status: "Aprovado", color: "#16A34A", valor: "R$ 142.800" },
    { nome: "Reforma Faria Lima", status: "Vistoria", color: "#06B6D4", valor: "R$ 38.500" },
  ];
  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl rotate-1"
      style={{ backgroundColor: NAVY_700 }}
    >
      {/* topbar */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2 text-white/90">
          <div className="h-2 w-2 rounded-full bg-red-400/80" />
          <div className="h-2 w-2 rounded-full bg-yellow-400/80" />
          <div className="h-2 w-2 rounded-full bg-green-400/80" />
          <span className="ml-3 text-xs text-white/60">Dashboard · Obras</span>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
          MR
        </div>
      </div>
      {/* kpis */}
      <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
        {[
          { l: "Obras ativas", v: "24" },
          { l: "Faturamento mês", v: "R$ 186.400" },
          { l: "Finalizadas", v: "12" },
          { l: "Pendências", v: "3" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/50">{k.l}</div>
            <div className="mt-1 text-sm font-semibold text-white">{k.v}</div>
          </div>
        ))}
      </div>
      {/* table */}
      <div className="px-5 pb-5">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-12 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-wider text-white/50">
            <div className="col-span-6">Obra</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-3 text-right">Valor</div>
          </div>
          {obras.map((o) => (
            <div key={o.nome} className="grid grid-cols-12 items-center border-t border-white/5 px-3 py-2.5 text-xs text-white/90">
              <div className="col-span-6 truncate">{o.nome}</div>
              <div className="col-span-3">
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${o.color}33`, color: o.color }}
                >
                  {o.status}
                </span>
              </div>
              <div className="col-span-3 text-right font-medium">{o.valor}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Financial spotlight mockup ----------
function FinanceMockup() {
  const items = [
    { label: "Materiais", spent: 78, total: 100, color: "#3B82F6" },
    { label: "Execução", spent: 62, total: 100, color: ORANGE },
    { label: "Terceirizados", spent: 41, total: 100, color: "#16A34A" },
    { label: "Recebido", spent: 88, total: 100, color: "#0F2448" },
  ];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Obra · Residencial Aurora</div>
          <div className="text-lg font-semibold text-[#0F2448]">Resumo financeiro</div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
          Margem +18%
        </span>
      </div>
      <div className="space-y-4">
        {items.map((i) => (
          <div key={i.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-gray-600">{i.label}</span>
              <span className="font-medium text-[#0F2448]">{i.spent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${i.spent}%`, backgroundColor: i.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Permissions spotlight mockup ----------
function PermissionsMockup() {
  const roles = [
    { r: "Admin", c: "#0F2448", a: "Acesso total" },
    { r: "Gestor", c: "#3B82F6", a: "Obras + Financeiro" },
    { r: "Engenheiro", c: ORANGE, a: "Suas obras" },
    { r: "Financeiro", c: "#16A34A", a: "Faturamento" },
    { r: "Operacional", c: "#64748B", a: "Etapas" },
  ];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 text-lg font-semibold text-[#0F2448]">Equipe e permissões</div>
      <div className="space-y-3">
        {roles.map((r) => (
          <div key={r.r} className="flex items-center justify-between rounded-xl border border-gray-100 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: r.c }}>
                {r.r[0]}
              </div>
              <div>
                <div className="text-sm font-medium text-[#0F2448]">{r.r}</div>
                <div className="text-xs text-gray-500">{r.a}</div>
              </div>
            </div>
            <Check className="h-4 w-4" style={{ color: ORANGE }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    document.title = "Gestão de Obra — Controle suas obras do chamado ao pagamento";
    const meta = document.querySelector('meta[name="description"]') ?? document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute(
      "content",
      "Sistema completo para construtoras: gerencie obras, equipes e financeiro em um só lugar. Planos a partir de R$ 149/mês."
    );
    if (!meta.parentElement) document.head.appendChild(meta);

    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    { icon: HardHat, title: "Gestão de Obras", desc: "Cadastre, acompanhe e controle cada obra do recebimento ao encerramento." },
    { icon: Columns, title: "Etapas e Kanban", desc: "Visualize o progresso de cada obra em um quadro de etapas em tempo real." },
    { icon: ClipboardCheck, title: "Vistorias", desc: "Registre vistorias com fotos, responsável e status diretamente no sistema." },
    { icon: FileText, title: "Orçamentos", desc: "Monte e envie orçamentos detalhados vinculados à obra com controle de versões." },
    { icon: Hammer, title: "Execuções", desc: "Gerencie quem executa cada serviço, próprio ou terceirizado, com custo real." },
    { icon: DollarSign, title: "Financeiro", desc: "Controle pagamentos, parcelas e inadimplência de cada contrato." },
    { icon: Receipt, title: "Faturamento e NF", desc: "Emita, registre e acompanhe notas fiscais e medições por obra." },
    { icon: Wallet, title: "Recebimentos", desc: "Agenda de recebimentos futuros e baixa de pagamentos confirmados." },
    { icon: Users, title: "Equipes e Permissões", desc: "Cada pessoa acessa somente o que precisa — por módulo e por obra." },
  ];

  // Preços e links de checkout reais (Cakto)
  const PLANS = {
    basico: {
      mensal: { preco: 149, url: "https://pay.cakto.com.br/szaqwp9" },
      anual: { preco: 124, url: "https://pay.cakto.com.br/538xp2i_878141" },
    },
    pro: {
      mensal: { preco: 349, url: "https://pay.cakto.com.br/dpjuzr2" },
      anual: { preco: 291, url: "https://pay.cakto.com.br/3fb9oe2_878148" },
    },
    enterprise: {
      mensal: { preco: 899, url: "https://pay.cakto.com.br/rpyd2ck" },
      anual: { preco: 749, url: "https://pay.cakto.com.br/ve4ick5_878151" },
    },
  } as const;
  const periodo = annual ? "anual" : "mensal";
  const planoBasico = PLANS.basico[periodo].preco;
  const planoPro = PLANS.pro[periodo].preco;
  const planoEnterprise = PLANS.enterprise[periodo].preco;
  const urlBasico = PLANS.basico[periodo].url;
  const urlPro = PLANS.pro[periodo].url;
  const urlEnterprise = PLANS.enterprise[periodo].url;

  return (
    <div className="min-h-screen bg-white text-[#0F2448]" style={{ fontFamily: "'Space Grotesk','Inter',ui-sans-serif,system-ui,sans-serif", fontFeatureSettings: '"ss01"' }}>
      {/* ===================== NAV ===================== */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/90 backdrop-blur-md shadow-sm" : ""
        }`}
        style={!scrolled ? { backgroundColor: NAVY_900 } : undefined}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
          <Logo light={!scrolled} />
          <nav className="hidden items-center gap-8 md:flex">
            {[
              { l: "Funcionalidades", h: "#funcionalidades" },
              { l: "Preços", h: "#precos" },
              { l: "Suporte", h: "#suporte" },
            ].map((n) => (
              <a
                key={n.h}
                href={n.h}
                className={`text-sm font-medium transition-colors ${scrolled ? "text-gray-600 hover:text-[#0F2448]" : "text-white/80 hover:text-white"}`}
              >
                {n.l}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            <Link
              to="/auth"
              className={`text-sm font-medium ${scrolled ? "text-[#0F2448]" : "text-white"} hover:opacity-80`}
            >
              Entrar
            </Link>
            <PrimaryCTA size="md" href="#precos">Assinar agora</PrimaryCTA>
          </div>
          <button className="md:hidden" onClick={() => setMobileMenu((v) => !v)} aria-label="Menu">
            {mobileMenu ? <X className={scrolled ? "text-[#0F2448]" : "text-white"} /> : <Menu className={scrolled ? "text-[#0F2448]" : "text-white"} />}
          </button>
        </div>
        {mobileMenu && (
          <div className="border-t border-white/10 bg-[#0B1F42] px-6 py-4 md:hidden">
            <nav className="flex flex-col gap-3 text-white">
              <a href="#funcionalidades" onClick={() => setMobileMenu(false)}>Funcionalidades</a>
              <a href="#precos" onClick={() => setMobileMenu(false)}>Preços</a>
              <a href="#suporte" onClick={() => setMobileMenu(false)}>Suporte</a>
              <Link to="/auth" className="border-t border-white/10 pt-3">Entrar</Link>
              <PrimaryCTA size="md" href="#precos">Assinar agora</PrimaryCTA>
            </nav>
          </div>
        )}
      </header>

      {/* ===================== HERO ===================== */}
      <section style={{ backgroundColor: NAVY_900 }} className="relative overflow-hidden pt-[72px]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-28 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <Reveal>
              <Pill>✦ Sistema completo para construtoras</Pill>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-5xl font-bold leading-[1.1] text-white md:text-[64px]">
                Do chamado à <span style={{ color: ORANGE }}>medição</span>,<br />
                tudo em um lugar só.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-lg text-lg text-[#94A3B8] md:text-xl">
                Gestão de Obra é o sistema que construtoras usam para controlar obras, equipes e financeiro — sem planilha, sem WhatsApp, sem perda de informação.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <PrimaryCTA size="lg" href="#precos">
                  Ver planos e assinar <ArrowRight className="h-5 w-5" />
                </PrimaryCTA>
                <a
                  href="#funcionalidades"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Ver demonstração
                </a>
              </div>
              <p className="mt-4 text-xs text-[#64748B]">
                A partir de R$ 149/mês • Cancele quando quiser • Dados seguros (LGPD)
              </p>
            </Reveal>
          </div>
          <div className="md:col-span-5">
            <Reveal delay={120}>
              <HeroMockup />
            </Reveal>
          </div>
        </div>
        <div className="mx-auto h-[3px] w-20" style={{ backgroundColor: ORANGE }} />
      </section>

      {/* ===================== PROVA SOCIAL ===================== */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 divide-x divide-gray-200 md:grid-cols-4">
            {[
              { v: <><span>+</span><Counter to={1200} /></>, l: "Obras gerenciadas" },
              { v: <><span>+</span><Counter to={85} /></>, l: "Empresas clientes" },
              { v: <>R$ <Counter to={47} />M+</>, l: "Em obras controladas" },
              { v: <><Counter to={4.9} decimals={1} />★</>, l: "Avaliação média" },
            ].map((m, i) => (
              <div key={i} className="px-4 text-center">
                <div className="text-3xl font-bold text-[#0F2448] md:text-4xl">{m.v}</div>
                <div className="mt-1 text-sm text-gray-500">{m.l}</div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-gray-400">
            Empresas de obras civis, saneamento e infraestrutura confiam no Gestão de Obra
          </p>
        </div>
      </section>

      {/* ===================== PROBLEMA ===================== */}
      <section id="funcionalidades" className="bg-[#F8F9FC] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal><Pill>O problema que todo gestor conhece</Pill></Reveal>
            <Reveal delay={80}>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-[#0F2448] md:text-[42px]">
                Quantas planilhas você tem<br />abertas agora mesmo?
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-5 text-gray-500">
                Obras que perdem prazo. Financeiro que não fecha. Equipe sem informação. Terceirizados sem controle. Se você gerencia obras com Excel e WhatsApp, você sabe exatamente o que isso custa.
              </p>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { Icon: AlertTriangle, color: "#F59E0B", title: "Status da obra? Depende de ligar", desc: "Sem visibilidade em tempo real, você só descobre o problema quando já é tarde demais para resolver." },
              { Icon: Banknote, color: "#DC2626", title: "Financeiro que não fecha", desc: "Materiais, terceirizados, medições — tudo espalhado. No fim do mês, os números nunca batem." },
              { Icon: FolderOpen, color: "#3B82F6", title: "Informação que se perde", desc: "Fotos no celular do engenheiro. Orçamento em e-mail. Contrato no WhatsApp. E quando alguém sai da empresa?" },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 80}>
                <div className="h-full rounded-2xl border border-gray-200 bg-white p-8 transition-transform hover:scale-[1.01]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color}1A`, color: c.color }}>
                    <c.Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#0F2448]">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <ChevronDown className="h-8 w-8 animate-bounce" style={{ color: ORANGE }} />
          </div>
        </div>
      </section>

      {/* ===================== SOLUÇÃO ===================== */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal><Pill>A solução</Pill></Reveal>
            <Reveal delay={80}>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-[#0F2448] md:text-[42px]">
                Tudo que sua construtora precisa,<br />em um único sistema.
              </h2>
            </Reveal>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 60}>
                <div className="h-full rounded-xl bg-[#F8F9FC] p-6 transition-transform hover:scale-[1.02]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ORANGE}1A`, color: ORANGE }}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#0F2448]">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== COMO FUNCIONA ===================== */}
      <section style={{ backgroundColor: NAVY_900 }} className="py-24 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Pill>Simples de começar</Pill>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight md:text-[42px]">
              Em 3 passos, sua empresa<br />já está funcionando
            </h2>
          </div>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              { n: "01", t: "Crie sua empresa", d: "Crie a conta da sua empresa em minutos. Sem configuração complexa." },
              { n: "02", t: "Cadastre sua equipe", d: "Convide engenheiros, gestores e financeiro. Cada um acessa o que precisa." },
              { n: "03", t: "Comece a gerenciar", d: "Cadastre a primeira obra e acompanhe tudo em tempo real." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div>
                  <div className="text-7xl font-bold" style={{ color: `${ORANGE}33` }}>{s.n}</div>
                  <div className="mt-3 h-px w-16 bg-white/20" />
                  <h3 className="mt-4 text-xl font-semibold text-white">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-14 flex justify-center">
            <PrimaryCTA size="lg" href="#precos">Ver planos e assinar <ArrowRight className="h-5 w-5" /></PrimaryCTA>
          </div>
        </div>
      </section>

      {/* ===================== SPOTLIGHTS ===================== */}
      <section className="bg-[#F8F9FC] py-24">
        <div className="mx-auto max-w-7xl space-y-24 px-6">
          {/* Bloco A */}
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <Reveal>
              <Pill>Controle financeiro</Pill>
              <h3 className="mt-4 text-2xl font-semibold text-[#0F2448] md:text-3xl">
                Saiba exatamente quanto cada obra está custando
              </h3>
              <p className="mt-4 text-gray-500">
                Materiais, execuções, terceirizados e recebimentos consolidados por obra. Chega de surpresa no fechamento do mês.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[#0F2448]">
                {["Custo real vs. orçado por obra", "Agenda de pagamentos e recebimentos", "Controle de parcelas de terceirizados", "Pedidos de compra vinculados"].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <Check className="h-4 w-4" style={{ color: ORANGE }} /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120}><FinanceMockup /></Reveal>
          </div>
          {/* Bloco B */}
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <Reveal delay={120} className="md:order-1"><PermissionsMockup /></Reveal>
            <Reveal className="md:order-2">
              <Pill>Equipes e acesso</Pill>
              <h3 className="mt-4 text-2xl font-semibold text-[#0F2448] md:text-3xl">
                Cada pessoa vê exatamente o que precisa ver
              </h3>
              <p className="mt-4 text-gray-500">
                Engenheiro só acessa as obras dele. Financeiro vê só os números. Operacional só as etapas. Controle total sem complicação.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[#0F2448]">
                {["Roles: Admin, Gestor, Engenheiro, Financeiro, Operacional", "Permissões por módulo (view, create, edit, delete)", "Convite por e-mail com link de acesso", "Terceirizados com acesso restrito às suas obras"].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <Check className="h-4 w-4" style={{ color: ORANGE }} /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===================== PREÇOS ===================== */}
      <section id="precos" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Pill>Planos e preços</Pill>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight text-[#0F2448] md:text-[42px]">
              Comece pequeno.<br />Cresça sem trocar de sistema.
            </h2>
          </div>

          {/* Toggle */}
          <div className="mt-10 flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!annual ? "text-[#0F2448]" : "text-gray-400"}`}>Mensal</span>
            <button
              onClick={() => setAnnual((v) => !v)}
              className="relative h-7 w-14 rounded-full transition-colors"
              style={{ backgroundColor: annual ? ORANGE : "#E2E8F0" }}
              aria-label="Alternar plano anual"
            >
              <span
                className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: annual ? "translateX(28px)" : "translateX(2px)" }}
              />
            </button>
            <span className={`flex items-center gap-2 text-sm font-medium ${annual ? "text-[#0F2448]" : "text-gray-400"}`}>
              Anual
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                2 meses grátis
              </span>
            </span>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Básico */}
            <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wider text-gray-500">Básico</div>
              <div className="mt-4 flex items-baseline gap-1 transition-all duration-300">
                <span className="text-4xl font-bold text-[#0F2448]">R$ {planoBasico}</span>
                <span className="text-sm text-gray-500">/mês</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Para empresas iniciando a gestão digital</p>
              <ul className="mt-6 space-y-3 text-sm text-[#0F2448]">
                {["3 usuários", "15 obras ativas", "5 GB de storage", "Dashboard, Obras, Etapas", "Vistorias, Fotos, Equipes", "Suporte por e-mail (48h)"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ORANGE }} />{t}</li>
                ))}
              </ul>
              <a
                href={urlBasico}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center justify-center rounded-xl border border-[#0F2448] px-6 py-3 text-sm font-semibold text-[#0F2448] transition-colors hover:bg-[#0F2448] hover:text-white"
              >
                Assinar Básico
              </a>
            </div>

            {/* Profissional */}
            <div className="relative flex flex-col rounded-2xl border-2 bg-white p-8 shadow-lg" style={{ borderColor: ORANGE }}>
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 animate-pulse rounded-full px-3 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: ORANGE }}>
                Mais popular
              </span>
              <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: ORANGE }}>Profissional</div>
              <div className="mt-4 flex items-baseline gap-1 transition-all duration-300">
                <span className="text-4xl font-bold text-[#0F2448]">R$ {planoPro}</span>
                <span className="text-sm text-gray-500">/mês</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Controle total para empresas em crescimento</p>
              <ul className="mt-6 space-y-3 text-sm text-[#0F2448]">
                {["15 usuários", "Obras ilimitadas", "50 GB de storage", "Tudo do Básico +", "Financeiro completo, Orçamentos", "Execuções, Faturamento, Recebimentos", "Materiais, Contratos, Permissões granulares", "Suporte prioritário (8h) + Onboarding"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ORANGE }} />{t}</li>
                ))}
              </ul>
              <Link
                to="/auth"
                className="mt-8 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: ORANGE }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ORANGE_LT)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ORANGE)}
              >
                Começar grátis
              </Link>
            </div>

            {/* Enterprise */}
            <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wider text-gray-500">Enterprise</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[#0F2448]">Sob consulta</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Para grupos e construtoras com múltiplas unidades</p>
              <ul className="mt-6 space-y-3 text-sm text-[#0F2448]">
                {["Usuários ilimitados", "Múltiplas filiais", "Storage customizado", "Tudo do Profissional +", "Painel multi-empresa, Branding próprio", "API, SSO, Relatórios consolidados", "SLA 99.9%", "Gerente dedicado + Treinamento"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ORANGE }} />{t}</li>
                ))}
              </ul>
              <a
                href="mailto:contato@gestaodeobra.online"
                className="mt-8 inline-flex items-center justify-center rounded-xl border border-[#0F2448] px-6 py-3 text-sm font-semibold text-[#0F2448] transition-colors hover:bg-[#0F2448] hover:text-white"
              >
                Falar com consultor
              </a>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-gray-400">
            Todos os planos incluem 14 dias grátis • Sem cartão de crédito • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ===================== DEPOIMENTOS ===================== */}
      <section className="bg-[#F8F9FC] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-4xl font-semibold tracking-tight text-[#0F2448] md:text-[42px]">
            Quem usa, não volta para planilha
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { i: "MR", c: "#0F2448", n: "Marcos Ribeiro", r: "Diretor · Construtora Ribeiro", t: "Antes eu tinha 6 planilhas abertas todo dia e mesmo assim perdia informação. Com o Gestão de Obra, qualquer um da equipe consegue ver o status de qualquer obra em tempo real." },
              { i: "CS", c: ORANGE, n: "Carla Souza", r: "Gestora de Projetos · VS Obras", t: "O controle financeiro por obra foi o que mais me surpreendeu. Agora sei exatamente o custo real de cada contrato, sem precisar montar relatório no final do mês." },
              { i: "FP", c: "#14532D", n: "Felipe Pereira", r: "Engenheiro Responsável · GeoConstru", t: "Em 2 dias já estávamos usando. A equipe de operações adotou muito rápido porque é simples. Hoje não consigo imaginar gerenciar obra sem ele." },
            ].map((d, i) => (
              <Reveal key={d.i} delay={i * 80}>
                <div className="h-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                  <div className="flex gap-1" style={{ color: ORANGE }}>
                    {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-gray-700">"{d.t}"</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: d.c }}>{d.i}</div>
                    <div>
                      <div className="text-sm font-semibold text-[#0F2448]">{d.n}</div>
                      <div className="text-xs text-gray-500">{d.r}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="suporte" className="bg-white py-24">
        <div className="mx-auto max-w-[720px] px-6">
          <h2 className="text-center text-4xl font-semibold tracking-tight text-[#0F2448] md:text-[42px]">
            Dúvidas frequentes
          </h2>
          <Accordion type="single" collapsible className="mt-12">
            {[
              { q: "Preciso instalar alguma coisa?", a: "Não. O Gestão de Obra é 100% online. Acesse pelo navegador de qualquer computador, sem instalação." },
              { q: "Como funciona o período grátis de 14 dias?", a: "Você cria a conta, convida sua equipe e usa o sistema completo por 14 dias sem precisar informar cartão de crédito. Ao final, escolhe o plano que faz sentido para sua empresa." },
              { q: "Posso migrar meus dados de planilha para o sistema?", a: "Sim. Oferecemos suporte para importação de obras e equipes via planilha Excel nos planos Profissional e Enterprise." },
              { q: "Quantos usuários posso ter?", a: "Depende do plano: Básico (3), Profissional (15), Enterprise (ilimitados). Cada usuário recebe permissões específicas por módulo." },
              { q: "O sistema é seguro? Meus dados ficam protegidos?", a: "Sim. Utilizamos infraestrutura com criptografia em repouso e em trânsito, backups automáticos diários e conformidade com a LGPD. Cada empresa tem seus dados completamente isolados." },
              { q: "Posso cancelar a qualquer momento?", a: "Sim, sem fidelidade e sem multa. Você pode cancelar pela própria plataforma. Seus dados ficam disponíveis por 30 dias após o cancelamento." },
              { q: "O que acontece se eu precisar de ajuda?", a: "Todos os planos têm acesso à central de ajuda e tutoriais em vídeo. Plano Profissional tem suporte prioritário por e-mail em até 8h. Enterprise tem gerente de conta dedicado." },
            ].map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-[#0F2448]">{f.q}</AccordionTrigger>
                <AccordionContent className="text-gray-600">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ===================== CTA FINAL ===================== */}
      <section style={{ backgroundColor: NAVY_900 }} className="py-28 text-center text-white">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Sua concorrência já está<br />gerenciando obras com sistema.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-400 md:text-xl">
            Cada semana que passa é mais uma semana de planilha, de informação perdida e de dinheiro que não fecha. Comece agora — em 5 minutos você já tem sua primeira obra cadastrada.
          </p>
          <div className="mt-10 flex justify-center">
            <PrimaryCTA size="xl">Criar minha conta grátis <ArrowRight className="h-5 w-5" /></PrimaryCTA>
          </div>
          <p className="mt-4 text-sm text-gray-500">14 dias grátis · Sem cartão · Cancele quando quiser</p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-12 opacity-60">
            <div className="flex items-center gap-2 text-sm text-white"><Shield className="h-4 w-4" /> Dados seguros (LGPD)</div>
            <div className="flex items-center gap-2 text-sm text-white"><Zap className="h-4 w-4" /> Setup em 5 minutos</div>
            <div className="flex items-center gap-2 text-sm text-white"><MessageCircle className="h-4 w-4" /> Suporte em português</div>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="py-16 text-gray-400" style={{ backgroundColor: "#070F1E" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <Logo light />
              <p className="mt-4 max-w-xs text-sm text-gray-500">
                Sistema de gestão de obras para construtoras brasileiras.
              </p>
              <div className="mt-5 flex gap-3">
                {["in", "ig"].map((s) => (
                  <a key={s} href="#" aria-label={s} className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80" style={{ backgroundColor: "#1B3A6B" }}>
                    <span className="text-xs font-semibold uppercase">{s}</span>
                  </a>
                ))}
              </div>
            </div>
            {[
              { t: "Produto", l: ["Funcionalidades", "Preços", "Integrações", "Segurança"] },
              { t: "Empresa", l: ["Sobre nós", "Blog", "Casos de uso", "Contato"] },
              { t: "Suporte", l: ["Central de Ajuda", "Tutoriais", "Status do sistema", "LGPD e Privacidade"] },
            ].map((col) => (
              <div key={col.t}>
                <div className="text-sm font-semibold uppercase tracking-wider text-white">{col.t}</div>
                <ul className="mt-4 space-y-2 text-sm">
                  {col.l.map((x) => (
                    <li key={x}><a href="#" className="hover:text-white">{x}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-sm text-gray-600 md:flex-row">
            <div>© 2025 Gestão de Obra. Todos os direitos reservados.</div>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white">Termos de Uso</a>
              <a href="#" className="hover:text-white">Política de Privacidade</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
