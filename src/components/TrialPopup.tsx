import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const POPUP_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000; // 4 dias
const STORAGE_KEY = "trial_popup_last_shown";

const formatPrice = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Plano = {
  id: string;
  slug: string;
  nome: string;
  preco_mensal: number;
  destaque: boolean;
  ordem: number;
};

export function TrialPopup() {
  const { empresaId, user } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: assinatura } = useQuery({
    queryKey: ["assinatura-popup", empresaId],
    enabled: !!empresaId && !isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("assinaturas")
        .select("status, trial_ends_at")
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: planos } = useQuery({
    queryKey: ["planos-popup"],
    enabled: !!empresaId && !isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("id, slug, nome, preco_mensal, destaque, ordem")
        .eq("ativo", true)
        .order("ordem");
      return (data ?? []) as Plano[];
    },
  });

  const trialEndsAt = assinatura?.trial_ends_at ? new Date(assinatura.trial_ends_at) : null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : null;

  useEffect(() => {
    if (!user || isSuperAdmin || !assinatura) return;
    if (assinatura.status !== "trialing") return;
    if (daysLeft === null) return;

    const lastShown = Number(localStorage.getItem(STORAGE_KEY) ?? "0");
    const elapsed = Date.now() - lastShown;

    // Mostra: na 1ª entrada, a cada 4 dias, e sempre nos últimos 3 dias
    const shouldShow =
      lastShown === 0 || elapsed >= POPUP_INTERVAL_MS || daysLeft <= 3;

    if (shouldShow) {
      const t = setTimeout(() => {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, isSuperAdmin, assinatura, daysLeft]);

  const handleAssinar = async (plano: Plano) => {
    if (!empresaId) return;
    setLoadingId(plano.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plano_slug: plano.slug, periodo: "mensal" },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao iniciar checkout");
      setLoadingId(null);
    }
  };

  if (!assinatura || assinatura.status !== "trialing" || daysLeft === null) return null;

  const isUrgent = daysLeft <= 3;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <Badge variant={isUrgent ? "destructive" : "secondary"} className="mb-2 w-fit">
            <Clock className="mr-1 h-3 w-3" />
            {daysLeft === 0
              ? "Seu trial termina hoje"
              : `Faltam ${daysLeft} dia${daysLeft === 1 ? "" : "s"} no seu trial`}
          </Badge>
          <DialogTitle className="text-2xl">
            {isUrgent
              ? "Garanta seu acesso antes que o trial acabe"
              : "Curtindo a Gestão de Obra?"}
          </DialogTitle>
          <DialogDescription>
            Escolha um plano e continue gerenciando suas obras sem interrupção. Cancele quando quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          {planos?.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border p-4 ${
                p.destaque ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              {p.destaque && (
                <Badge className="mb-2">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Mais popular
                </Badge>
              )}
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {p.nome}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold">{formatPrice(p.preco_mensal)}</span>
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              <Button
                className="mt-4 w-full"
                size="sm"
                variant={p.destaque ? "default" : "outline"}
                onClick={() => handleAssinar(p)}
                disabled={loadingId === p.id}
              >
                {loadingId === p.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Assinar
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Pagamentos processados com segurança. Sem fidelidade.
        </p>
      </DialogContent>
    </Dialog>
  );
}
