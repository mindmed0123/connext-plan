import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";

const ACOES: Record<string, string> = {
  INSERT: "Criou",
  UPDATE: "Alterou",
  DELETE: "Excluiu",
};

const TABELAS: Record<string, string> = {
  obras: "Obras",
  orcamentos: "Orçamentos",
  lancamentos_financeiros: "Lançamentos financeiros",
  recebimentos: "Recebimentos",
  recebimento_pagamentos: "Pagamentos de recebimento",
  notas_fiscais: "Notas fiscais",
  contratacoes_terceirizado: "Contratações",
  parcelas_pagamento: "Parcelas",
  cartao_despesas: "Despesas de cartão",
  pessoas: "Equipe",
  pessoa_permissoes: "Permissões",
  user_roles: "Funções de usuário",
  empresas: "Dados da empresa",
  assinaturas: "Assinatura",
};

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

export default function AcessosSuporte() {
  const { empresaId, isSuperAdmin } = useAuth() as { empresaId: string | null; isSuperAdmin?: boolean };
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [horas, setHoras] = useState("4");
  const [salvando, setSalvando] = useState(false);

  const { data: sessoes, isLoading: loadingSessoes } = useQuery({
    queryKey: ["suporte-sessoes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suporte_sessoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: registros, isLoading: loadingLog } = useQuery({
    queryKey: ["audit-log-suporte", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, created_at, ator_email, papel, suporte, acao, tabela, registro_id, justificativa")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const abrirSessao = async () => {
    if (!empresaId) return;
    if (motivo.trim().length < 10) {
      toast.error("Descreva o motivo com pelo menos 10 caracteres.");
      return;
    }
    const h = Math.min(Math.max(Number(horas) || 1, 1), 168);
    setSalvando(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("suporte_sessoes").insert({
      empresa_id: empresaId,
      motivo: motivo.trim(),
      expira_em: new Date(Date.now() + h * 3600_000).toISOString(),
      criada_por: user.user?.id as string,
      criada_por_email: user.user?.email ?? null,
    });
    setSalvando(false);
    if (error) return toast.error(error.message);
    setMotivo("");
    qc.invalidateQueries({ queryKey: ["suporte-sessoes"] });
    toast.success("Sessão de suporte aberta");
  };

  const encerrarSessao = async (id: string) => {
    const { error } = await supabase
      .from("suporte_sessoes")
      .update({ encerrada_em: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["suporte-sessoes"] });
    toast.success("Sessão encerrada");
  };

  const registrosSuporte = (registros ?? []).filter((r) => r.suporte);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Acessos do suporte</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        O suporte só consegue alterar dados desta empresa com uma sessão aberta, com motivo e prazo. Tudo o que for feito
        fica registrado abaixo.
      </p>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Abrir sessão de suporte</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_140px_auto] md:items-end">
            <div className="space-y-1">
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: corrigir recebimento duplicado a pedido do cliente"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="horas">Validade (horas)</Label>
              <Input id="horas" type="number" min={1} max={168} value={horas} onChange={(e) => setHoras(e.target.value)} />
            </div>
            <Button onClick={abrirSessao} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Abrir sessão
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="sessoes">
        <TabsList>
          <TabsTrigger value="sessoes">Sessões</TabsTrigger>
          <TabsTrigger value="suporte">Ações do suporte</TabsTrigger>
          <TabsTrigger value="tudo">Histórico completo</TabsTrigger>
        </TabsList>

        <TabsContent value="sessoes">
          <Card>
            <CardContent className="p-0">
              {loadingSessoes ? (
                <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
              ) : (sessoes ?? []).length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Nenhum acesso do suporte registrado.</div>
              ) : (
                <div className="divide-y">
                  {(sessoes ?? []).map((s) => {
                    const ativa = !s.encerrada_em && new Date(s.expira_em) > new Date();
                    return (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.criada_por_email ?? "Suporte"}</span>
                            <Badge variant={ativa ? "default" : "secondary"}>{ativa ? "Ativa" : "Encerrada"}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{s.motivo}</div>
                          <div className="text-xs text-muted-foreground">
                            Aberta em {formatDateTime(s.created_at)} · válida até {formatDateTime(s.expira_em)}
                          </div>
                        </div>
                        {ativa && isSuperAdmin && (
                          <Button variant="outline" size="sm" onClick={() => encerrarSessao(s.id)}>
                            Encerrar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suporte">
          <LogList registros={registrosSuporte} loading={loadingLog} vazio="O suporte não alterou nada nesta empresa." />
        </TabsContent>

        <TabsContent value="tudo">
          <LogList registros={registros ?? []} loading={loadingLog} vazio="Nenhuma alteração registrada ainda." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LogList({
  registros,
  loading,
  vazio,
}: {
  registros: Array<Record<string, any>>;
  loading: boolean;
  vazio: string;
}) {
  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando…</CardContent></Card>;
  if (registros.length === 0)
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">{vazio}</CardContent></Card>;

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {registros.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div className="space-y-1">
              <div className="text-sm">
                <span className="font-medium">{r.ator_email ?? "Sistema"}</span>{" "}
                {ACOES[r.acao] ?? r.acao} em {TABELAS[r.tabela] ?? r.tabela}
              </div>
              {r.justificativa && (
                <div className="text-xs text-muted-foreground">Motivo do suporte: {r.justificativa}</div>
              )}
              <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</div>
            </div>
            {r.suporte && <Badge variant="outline">Suporte</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
