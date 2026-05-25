import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getTodayDateInputValue } from "@/lib/date";
import { erroEmPortugues } from "@/lib/erros";
import {
  Sparkles,
  Building2,
  HardHat,
  Wrench,
  Users,
  PartyPopper,
  Check,
  ArrowRight,
  ArrowLeft,
  SkipForward,
} from "lucide-react";
import logo from "@/assets/logo.png";

type StepKey = "welcome" | "profile" | "obra" | "servico" | "equipe" | "done";

const STEPS: { key: StepKey; title: string; icon: any }[] = [
  { key: "welcome", title: "Boas-vindas", icon: Sparkles },
  { key: "profile", title: "Seu perfil", icon: Building2 },
  { key: "obra", title: "Primeira obra", icon: HardHat },
  { key: "servico", title: "Serviço", icon: Wrench },
  { key: "equipe", title: "Equipe", icon: Users },
  { key: "done", title: "Pronto", icon: PartyPopper },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, empresaId, empresaNome, refreshEmpresa } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  // form state
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresaNomeEdit, setEmpresaNomeEdit] = useState(empresaNome ?? "");
  const [empresaEmail, setEmpresaEmail] = useState("");
  const [empresaTelefone, setEmpresaTelefone] = useState("");

  const [obraEndereco, setObraEndereco] = useState("");
  const [obraCodigo, setObraCodigo] = useState("");
  const [obraDescricao, setObraDescricao] = useState("");
  const [obraEngenheiro, setObraEngenheiro] = useState("");
  const [obraRegiao, setObraRegiao] = useState<string>("leste");

  const [servNome, setServNome] = useState("");
  const [servUnidade, setServUnidade] = useState("m²");
  const [servPreco, setServPreco] = useState<string>("0");

  const [convEmail, setConvEmail] = useState("");
  const [convNome, setConvNome] = useState("");

  // hidrata profile e empresa
  useQuery({
    queryKey: ["onboarding-init", user?.id, empresaId],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: prof }, { data: emp }] = await Promise.all([
        supabase
          .from("profiles")
          .select("nome, telefone")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("empresas")
          .select("nome, email, telefone")
          .eq("id", empresaId!)
          .maybeSingle(),
      ]);
      if (prof) {
        setNome(prof.nome ?? "");
        setTelefone(prof.telefone ?? "");
      } else {
        setNome((user?.user_metadata as any)?.nome ?? "");
      }
      if (emp) {
        setEmpresaNomeEdit(emp.nome ?? "");
        setEmpresaEmail(emp.email ?? "");
        setEmpresaTelefone(emp.telefone ?? "");
      } else {
        setEmpresaNomeEdit(empresaNome ?? "");
      }
      return true;
    },
  });

  const step = STEPS[stepIdx];
  const progress = useMemo(() => Math.round(((stepIdx + 1) / STEPS.length) * 100), [stepIdx]);

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));

  async function saveProfile() {
    if (!user?.id) return;
    if (!empresaNomeEdit.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    if (!empresaEmail.trim()) {
      toast.error("Informe o e-mail da empresa");
      return;
    }
    if (!empresaTelefone.trim()) {
      toast.error("Informe o telefone da empresa");
      return;
    }
    setBusy(true);
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("profiles")
          .update({ nome: nome || "Usuário", telefone: telefone || null })
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("profiles")
          .insert({ user_id: user.id, nome: nome || "Usuário", telefone: telefone || null });
      }
      if (empresaId) {
        await supabase
          .from("empresas")
          .update({
            nome: empresaNomeEdit.trim(),
            email: empresaEmail.trim(),
            telefone: empresaTelefone.trim(),
          })
          .eq("id", empresaId);
        await refreshEmpresa();
      }
      next();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar perfil");
    } finally {
      setBusy(false);
    }
  }

  async function saveObra() {
    if (!obraEndereco.trim()) {
      toast.error("Informe o endereço da obra");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("criar_obra_segura", {
        _codigo_chamado: obraCodigo || `OB-${Date.now().toString().slice(-5)}`,
        _origem: "Sabesp",
        _regiao_label: obraRegiao || "",
        _engenheiro_responsavel: obraEngenheiro || nome || "—",
        _descricao_servico: obraDescricao || "—",
        _endereco: obraEndereco,
        _data_recebimento: getTodayDateInputValue(),
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["obras"] });
      toast.success("Obra cadastrada!");
      next();
    } catch (e: any) {
      toast.error(erroEmPortugues(e, "Erro ao criar obra"));
    } finally {
      setBusy(false);
    }
  }

  async function saveServico() {
    if (!servNome.trim()) {
      toast.error("Informe o nome do serviço");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("servicos").insert({
        empresa_id: empresaId!,
        nome: servNome,
        unidade: servUnidade || "m²",
        preco_unitario: Number(servPreco) || 0,
        ativo: true,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["servicos"] });
      toast.success("Serviço criado!");
      next();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar serviço");
    } finally {
      setBusy(false);
    }
  }

  async function inviteUser() {
    if (!convEmail.trim()) {
      toast.error("Informe o e-mail do convidado");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: { email: convEmail, nome: convNome || convEmail.split("@")[0], role: "user" },
      });
      if (error) throw error;
      toast.success("Convite enviado!");
      next();
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível convidar agora — você pode fazer isso depois em Equipes");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!empresaId) return;
    setBusy(true);
    try {
      await supabase.from("empresas").update({ onboarding_completo: true }).eq("id", empresaId);
      await refreshEmpresa();
      qc.invalidateQueries({ queryKey: ["empresa-onboarding"] });
      toast.success("Tudo pronto! Bem-vindo à Gestão de Obra 🎉");
      navigate("/obras", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao finalizar");
    } finally {
      setBusy(false);
    }
  }

  async function skipAll() {
    if (!empresaId) return;
    await supabase.from("empresas").update({ onboarding_completo: true }).eq("id", empresaId);
    await refreshEmpresa();
    qc.invalidateQueries({ queryKey: ["empresa-onboarding"] });
    navigate("/obras", { replace: true });
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-background to-primary/5 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <img src={logo} alt="Gestão de Obra" className="h-10 w-auto" />
          <button
            onClick={skipAll}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Pular configuração inicial
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Passo {stepIdx + 1} de {STEPS.length} · {step.title}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="mt-4 hidden gap-2 md:flex">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div
                  key={s.key}
                  className={`flex flex-1 items-center gap-2 rounded-lg border p-2 text-xs transition ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : done
                        ? "border-primary/30 bg-primary/5 text-muted-foreground"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="truncate">{s.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card */}
        <div
          key={step.key}
          className="animate-fade-in rounded-2xl border bg-card p-8 shadow-elev-md md:p-10"
        >
          {step.key === "welcome" && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <h1 className="mb-3 text-3xl font-bold tracking-tight">
                Olá{nome ? `, ${nome.split(" ")[0]}` : ""}! Seja bem-vindo 👋
              </h1>
              <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
                Vamos preparar a sua conta em menos de 2 minutos. Você pode pular qualquer etapa e voltar depois — seus
                14 dias grátis já começaram.
              </p>
              <div className="mx-auto mb-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { i: Building2, t: "Confirme seus dados" },
                  { i: HardHat, t: "Cadastre sua 1ª obra" },
                  { i: Wrench, t: "Crie um serviço" },
                  { i: Users, t: "Convide sua equipe" },
                ].map((it, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg border bg-background/50 p-3 text-left">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <it.i className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{it.t}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={next} className="min-w-[200px]">
                Vamos começar <ArrowRight className="ml-1" />
              </Button>
            </div>
          )}

          {step.key === "profile" && (
            <div>
              <h2 className="mb-1 text-2xl font-bold">Seus dados</h2>
              <p className="mb-6 text-sm text-muted-foreground">Confirme as informações para personalizar o sistema.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="empresa-nome">Nome da empresa *</Label>
                  <Input
                    id="empresa-nome"
                    value={empresaNomeEdit}
                    onChange={(e) => setEmpresaNomeEdit(e.target.value)}
                    placeholder="Construtora Exemplo"
                  />
                </div>
                <div>
                  <Label htmlFor="empresa-email">E-mail da empresa *</Label>
                  <Input
                    id="empresa-email"
                    type="email"
                    value={empresaEmail}
                    onChange={(e) => setEmpresaEmail(e.target.value)}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div>
                  <Label htmlFor="empresa-tel">Telefone da empresa *</Label>
                  <Input
                    id="empresa-tel"
                    value={empresaTelefone}
                    onChange={(e) => setEmpresaTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-nome">Seu nome</Label>
                  <Input id="profile-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="profile-tel">Seu telefone</Label>
                  <Input
                    id="profile-tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <Footer onPrev={prev} onNext={saveProfile} busy={busy} nextLabel="Continuar" />
            </div>
          )}

          {step.key === "obra" && (
            <div>
              <h2 className="mb-1 text-2xl font-bold">Cadastre sua primeira obra</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Adicione uma obra de exemplo para começar — você pode editar ou excluir depois.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="ob-end">Endereço *</Label>
                  <Input
                    id="ob-end"
                    value={obraEndereco}
                    onChange={(e) => setObraEndereco(e.target.value)}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>
                <div>
                  <Label htmlFor="ob-cod">Código do chamado</Label>
                  <Input
                    id="ob-cod"
                    value={obraCodigo}
                    onChange={(e) => setObraCodigo(e.target.value)}
                    placeholder="ex: 12345"
                  />
                </div>
                <div>
                  <Label>Região</Label>
                  <Select value={obraRegiao} onValueChange={setObraRegiao}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leste">Leste</SelectItem>
                      <SelectItem value="oeste">Oeste</SelectItem>
                      <SelectItem value="norte">Norte</SelectItem>
                      <SelectItem value="sul">Sul</SelectItem>
                      <SelectItem value="interior">Interior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="ob-eng">Engenheiro responsável</Label>
                  <Input
                    id="ob-eng"
                    value={obraEngenheiro}
                    onChange={(e) => setObraEngenheiro(e.target.value)}
                    placeholder={nome || "Nome do engenheiro"}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="ob-desc">Descrição do serviço</Label>
                  <Textarea
                    id="ob-desc"
                    value={obraDescricao}
                    onChange={(e) => setObraDescricao(e.target.value)}
                    placeholder="Ex: Reparo de vazamento em rede de água"
                    rows={3}
                  />
                </div>
              </div>
              <Footer onPrev={prev} onNext={saveObra} onSkip={next} busy={busy} nextLabel="Salvar e continuar" />
            </div>
          )}

          {step.key === "servico" && (
            <div>
              <h2 className="mb-1 text-2xl font-bold">Crie seu primeiro serviço</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Serviços ficam disponíveis para usar em orçamentos. Pode ser algo simples como "Mão de obra" ou "Escavação".
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <Label htmlFor="sv-nome">Nome do serviço *</Label>
                  <Input
                    id="sv-nome"
                    value={servNome}
                    onChange={(e) => setServNome(e.target.value)}
                    placeholder="Ex: Escavação manual"
                  />
                </div>
                <div>
                  <Label htmlFor="sv-uni">Unidade</Label>
                  <Input
                    id="sv-uni"
                    value={servUnidade}
                    onChange={(e) => setServUnidade(e.target.value)}
                    placeholder="m², m³, h..."
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="sv-preco">Preço unitário (R$)</Label>
                  <Input
                    id="sv-preco"
                    type="number"
                    step="0.01"
                    value={servPreco}
                    onChange={(e) => setServPreco(e.target.value)}
                  />
                </div>
              </div>
              <Footer onPrev={prev} onNext={saveServico} onSkip={next} busy={busy} nextLabel="Salvar e continuar" />
            </div>
          )}

          {step.key === "equipe" && (
            <div>
              <h2 className="mb-1 text-2xl font-bold">Convide sua equipe</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Convide um colaborador agora — ele recebe um e-mail com acesso ao sistema. Você pode adicionar mais
                pessoas depois em <strong>Equipes</strong>.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="cv-nome">Nome</Label>
                  <Input id="cv-nome" value={convNome} onChange={(e) => setConvNome(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cv-email">E-mail</Label>
                  <Input
                    id="cv-email"
                    type="email"
                    value={convEmail}
                    onChange={(e) => setConvEmail(e.target.value)}
                    placeholder="colaborador@empresa.com"
                  />
                </div>
              </div>
              <Footer
                onPrev={prev}
                onNext={inviteUser}
                onSkip={next}
                busy={busy}
                nextLabel="Enviar convite"
                skipLabel="Pular por agora"
              />
            </div>
          )}

          {step.key === "done" && (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-scale-in">
                <PartyPopper className="h-8 w-8" />
              </div>
              <h1 className="mb-3 text-3xl font-bold tracking-tight">Tudo pronto!</h1>
              <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
                Sua conta está configurada. Explore o sistema livremente durante os <strong>14 dias grátis</strong> — sem
                cartão, sem compromisso.
              </p>
              <div className="mx-auto mb-8 grid max-w-md grid-cols-1 gap-2 text-left">
                {[
                  "Crie quantas obras, orçamentos e usuários quiser",
                  "Receba lembretes do trial por e-mail",
                  "Assine quando quiser, direto no menu Faturamento",
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={finish} disabled={busy} className="min-w-[220px]">
                Ir para o Dashboard <ArrowRight className="ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Footer({
  onPrev,
  onNext,
  onSkip,
  busy,
  nextLabel,
  skipLabel = "Pular",
}: {
  onPrev: () => void;
  onNext: () => void;
  onSkip?: () => void;
  busy?: boolean;
  nextLabel: string;
  skipLabel?: string;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      <Button variant="ghost" onClick={onPrev} disabled={busy}>
        <ArrowLeft className="mr-1" /> Voltar
      </Button>
      <div className="flex gap-2">
        {onSkip && (
          <Button variant="outline" onClick={onSkip} disabled={busy}>
            <SkipForward className="mr-1 h-4 w-4" /> {skipLabel}
          </Button>
        )}
        <Button onClick={onNext} disabled={busy}>
          {busy ? "Salvando..." : nextLabel}
          {!busy && <ArrowRight className="ml-1" />}
        </Button>
      </div>
    </div>
  );
}
