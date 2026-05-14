import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const motivo = searchParams.get("motivo");
  const tabParam = searchParams.get("tab") === "signup" ? "signup" : "login";
  const { user, loading } = useAuth();
  const { isSuperAdmin, isLoading: roleLoading } = useUserRole();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // signup
  const [nome, setNome] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  useEffect(() => {
    if (!loading && !roleLoading && user) {
      navigate(isSuperAdmin ? "/admin" : "/dashboard", { replace: true });
    }
  }, [user, loading, roleLoading, isSuperAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Bem-vindo de volta");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: { nome },
        },
      });
      if (error) throw error;

      // Se a sessão veio de imediato (auto-confirm ativo), cria empresa + trial agora
      if (data.session) {
        const { error: rpcError } = await supabase.rpc("signup_create_company", {
          _nome_empresa: empresaNome || `${nome || signupEmail}`,
        });
        if (rpcError) throw rpcError;
        toast.success("Conta criada! Você tem 14 dias grátis para testar.");
        navigate("/onboarding", { replace: true });
      } else {
        // Verificação por email pendente — guarda o nome da empresa para criar no primeiro login
        sessionStorage.setItem("pending_empresa_nome", empresaNome || nome || signupEmail);
        toast.success("Confirme seu e-mail para continuar.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao criar conta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="Gestão de Obra" className="mb-3 h-16 w-auto" />
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
          <Tabs defaultValue={tabParam}>
            <CardHeader className="space-y-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="login" className="m-0">
                <CardTitle className="mb-1">Entrar</CardTitle>
                <CardDescription className="mb-4">Acesse sua conta da Gestão de Obra</CardDescription>
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
                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    Membro de uma equipe? Peça um convite ao administrador.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="m-0">
                <CardTitle className="mb-1">Comece grátis por 14 dias</CardTitle>
                <CardDescription className="mb-4">
                  Acesso completo a todos os recursos. Sem cartão de crédito.
                </CardDescription>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Seu nome</Label>
                    <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="empresa">Nome da empresa</Label>
                    <Input id="empresa" required value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      minLength={6}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Criando conta..." : "Criar conta e iniciar trial"}
                  </Button>
                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    Ao se cadastrar, você concorda com nossos termos de uso.
                  </p>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
