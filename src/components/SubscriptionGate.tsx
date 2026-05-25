import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import SubscriptionRequired from "@/pages/SubscriptionRequired";

const ALLOWED_PATHS = ["/billing", "/pricing"];

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { empresaId, user, authReady } = useAuth();
  const { isSuperAdmin, isLoading: roleLoading } = useUserRole();

  const { data, isLoading } = useQuery({
    queryKey: ["assinatura-status", empresaId],
    enabled: authReady && !!empresaId && !isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("assinaturas")
        .select("status, trial_ends_at")
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      return data;
    },
  });

  if (!authReady || !user || roleLoading) return <>{children}</>;
  if (isSuperAdmin) return <>{children}</>;
  if (!empresaId) return <>{children}</>;
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Permite sempre acessar /billing e /pricing
  const path = window.location.pathname;
  if (ALLOWED_PATHS.some((p) => path.startsWith(p))) return <>{children}</>;

  const status = data?.status;
  const trialEnded =
    status === "trialing" &&
    data?.trial_ends_at &&
    new Date(data.trial_ends_at).getTime() < Date.now();

  const blocked =
    !status ||
    status === "canceled" ||
    status === "expired" ||
    status === "paused" ||
    trialEnded;

  if (blocked) return <SubscriptionRequired />;
  return <>{children}</>;
}
