import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function TrialBanner() {
  const { empresaId } = useAuth();
  const { isSuperAdmin } = useUserRole();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["assinatura-banner", empresaId],
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

  if (isSuperAdmin || !data) return null;
  if (data.status !== "trialing" && data.status !== "past_due") return null;

  const daysLeft =
    data.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(data.trial_ends_at).getTime() - Date.now()) / 86400000))
      : 0;

  if (data.status === "trialing" && daysLeft > 7) return null;

  return (
    <div className="flex items-center gap-3 border-b bg-warning/10 px-4 py-2 text-sm text-warning-foreground">
      <AlertCircle className="h-4 w-4 text-warning" />
      <span className="flex-1">
        {data.status === "past_due"
          ? "Sua última cobrança falhou. Atualize o pagamento para evitar suspensão."
          : daysLeft > 0
          ? `Restam ${daysLeft} dia${daysLeft === 1 ? "" : "s"} no seu trial gratuito.`
          : "Seu trial gratuito terminou."}
      </span>
      <Button size="sm" variant="outline" onClick={() => navigate("/pricing")}>
        Escolher plano
      </Button>
    </div>
  );
}
