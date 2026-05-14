import { ShieldAlert } from "lucide-react";
import { Navigate } from "react-router-dom";
import { AppModulo, usePermissions } from "@/hooks/usePermissions";
import { useObrasVinculadas } from "@/hooks/useObrasVinculadas";

export function RequirePermission({
  modulo,
  children,
}: {
  modulo: AppModulo;
  children: React.ReactNode;
}) {
  const { can, isLoading, isSuperAdmin } = usePermissions();
  const { temVinculo, isLoading: vincLoading } = useObrasVinculadas();

  if (isLoading || vincLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  // Operacional / terceirizado vinculado a alguma obra pode acessar /obras
  const liberadoPorVinculo = modulo === "obras" && temVinculo;

  if (isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (!can(modulo, "view") && !liberadoPorVinculo) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-muted-foreground">
        <ShieldAlert className="h-8 w-8" />
        <p className="text-sm font-medium">Sem permissão de acesso</p>
        <p className="text-xs">Solicite ao Super Admin a liberação deste módulo.</p>
      </div>
    );
  }
  return <>{children}</>;
}
