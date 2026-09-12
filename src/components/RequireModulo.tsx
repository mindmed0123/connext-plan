import { PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useModulos } from "@/hooks/useModulos";
import { MODULOS, ModuloChave } from "@/lib/modulos";

export function RequireModulo({
  modulo,
  children,
}: {
  modulo: ModuloChave;
  children: React.ReactNode;
}) {
  const { moduloAtivo, isLoading } = useModulos();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!moduloAtivo(modulo)) {
    const info = MODULOS.find((m) => m.chave === modulo);
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <PackageOpen className="h-8 w-8" />
        <div>
          <p className="text-sm font-medium text-foreground">{info?.nome ?? "Módulo"} está desligado</p>
          <p className="text-xs">{info?.descricao}</p>
          <p className="mt-1 text-xs">Nada foi apagado: ao religar, tudo volta como estava.</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/configuracoes">Ativar módulos</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
