import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function SubscriptionRequired() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Assinatura necessária</h1>
        <p className="mt-3 text-muted-foreground">
          Seu período gratuito de 14 dias terminou ou sua assinatura está inativa.
          Escolha um plano para continuar usando a Gestão de Obra.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => navigate("/pricing")}>Ver planos</Button>
          <Button variant="outline" onClick={() => navigate("/billing")}>
            Minha assinatura
          </Button>
          <Button variant="ghost" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
