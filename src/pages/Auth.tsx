import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const motivo = searchParams.get("motivo");
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Bem-vindo de volta");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Gestão de Obra"
            className="mb-3 h-16 w-auto"
          />
          <p className="text-sm text-muted-foreground">Gestão inteligente para construtoras</p>
        </div>

        {motivo === "conta-suspensa" && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Sua empresa está suspensa. Entre em contato com o suporte para reativar o acesso.
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-elev-md">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Acesse sua conta da Gestão de Obra</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Entrando..." : "Entrar"}
              </Button>
              <div className="space-y-2 pt-2 text-center text-xs text-muted-foreground">
                <p>
                  Não tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/pricing")}
                    className="font-medium text-primary hover:underline"
                  >
                    Cadastre sua empresa
                  </button>
                </p>
                <p>Membro de uma equipe? Peça um convite ao administrador.</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
