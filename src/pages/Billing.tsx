import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Assinatura = {
  id: string;
  status: string;
  periodo: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  paddle_subscription_id: string | null;
  planos: { nome: string; slug: string; preco_mensal: number; preco_anual: number } | null;
};

const STATUS_LABEL: Record<string, { label: string; tone: "success" | "warn" | "danger" | "muted" }> = {
  trialing: { label: "Trial gratuito", tone: "warn" },
  active: { label: "Ativo", tone: "success" },
  past_due: { label: "Pagamento em atraso", tone: "danger" },
  paused: { label: "Pausado", tone: "muted" },
  canceled: { label: "Cancelado", tone: "danger" },
  expired: { label: "Expirado", tone: "danger" },
};

export default function Billing() {
  const navigate = useNavigate();
  const { empresaId } = useAuth();

  useEffect(() => {
    document.title = "Assinatura | ObraFlow";
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["assinatura", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas")
        .select("*, planos(nome, slug, preco_mensal, preco_anual)")
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Assinatura | null;
    },
  });

  const handlePortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("billing-portal");
      if (error) throw error;
      if (data?.portal_url) window.location.href = data.portal_url;
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao abrir portal de cobrança");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const status = data?.status ?? "expired";
  const meta = STATUS_LABEL[status] ?? STATUS_LABEL.expired;
  const trialEndsAt = data?.trial_ends_at ? new Date(data.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assinatura</h1>
        <p className="text-muted-foreground">Gerencie seu plano e método de pagamento.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {data?.planos?.nome ?? "Sem plano"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Cobrança {data?.periodo === "anual" ? "anual" : "mensal"}
              </p>
            </div>
            <Badge
              variant={
                meta.tone === "success"
                  ? "default"
                  : meta.tone === "danger"
                  ? "destructive"
                  : "secondary"
              }
            >
              {meta.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "trialing" && (
            <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
              <div className="text-sm">
                <p className="font-medium">
                  Você está no período gratuito.{" "}
                  {trialDaysLeft > 0
                    ? `${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} restantes.`
                    : "O trial expirou."}
                </p>
                <p className="text-muted-foreground">
                  Assine um plano para continuar com acesso completo após o trial.
                </p>
              </div>
            </div>
          )}

          {status === "active" && (
            <div className="flex items-start gap-3 rounded-md border border-success/30 bg-success/5 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
              <div className="text-sm">
                <p className="font-medium">Assinatura ativa</p>
                {data?.current_period_end && (
                  <p className="text-muted-foreground">
                    Próxima cobrança em{" "}
                    {new Date(data.current_period_end).toLocaleDateString("pt-BR")}
                  </p>
                )}
                {data?.cancel_at_period_end && (
                  <p className="mt-1 text-warning">
                    Cancelamento agendado ao fim do período atual.
                  </p>
                )}
              </div>
            </div>
          )}

          {(status === "past_due" || status === "canceled" || status === "expired") && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="text-sm">
                <p className="font-medium">Acesso comprometido</p>
                <p className="text-muted-foreground">
                  Reative sua assinatura para continuar usando todos os recursos.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => navigate("/pricing")}>
              {status === "active" ? "Mudar de plano" : "Escolher plano"}
            </Button>
            {data?.paddle_subscription_id && (
              <Button variant="outline" onClick={handlePortal}>
                <CreditCard className="mr-2 h-4 w-4" />
                Gerenciar pagamento
              </Button>
            )}
            <Button variant="ghost" onClick={() => refetch()}>
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
