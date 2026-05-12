import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { empresaId, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["empresa-onboarding", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("onboarding_completo")
        .eq("id", empresaId!)
        .maybeSingle();
      return data;
    },
  });

  if (loading || (empresaId && isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (empresaId && data && data.onboarding_completo === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
