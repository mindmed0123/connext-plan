import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading, refreshEmpresa } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { nome } },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Conta criada! Você já pode acessar.");
  };

  const handleEmpresaSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaNome.trim()) return toast.error("Informe o nome da empresa");
    setBusy(true);
    try {
      // 1. signUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { nome } },
      });
      if (signUpError) throw signUpError;
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error("Não foi possível criar a conta");

      // Garante sessão (caso confirm-email esteja desativado, signUp já loga)
      if (!signUpData.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw new Error("Confirme seu e-mail antes de continuar com o cadastro da empresa.");
      }

      // 2. Criar empresa (slug único)
      const baseSlug = slugify(empresaNome) || `empresa-${Date.now()}`;
      let slug = baseSlug;
      for (let i = 1; i < 5; i++) {
        const { data: exists } = await supabase.from("empresas").select("id").eq("slug", slug).maybeSingle();
        if (!exists) break;
        slug = `${baseSlug}-${i}`;
      }
      const { data: emp, error: empErr } = await supabase
        .from("empresas")
        .insert({ nome: empresaNome.trim(), slug, plano: "basico" })
        .select()
        .single();
      if (empErr) throw empErr;

      // 3. user_roles admin com empresa_id
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: newUserId, role: "admin", empresa_id: emp.id });
      if (roleErr) throw roleErr;

      // 4. pessoa vinculada
      await supabase.from("pessoas").insert({
        nome: nome || email,
        email,
        tipo: "administrativo",
        cargo: "Administrador",
        user_id: newUserId,
        empresa_id: emp.id,
        status: "ativo",
      });

      await refreshEmpresa();
      toast.success(`Empresa ${empresaNome} criada!`);
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar empresa");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-elev-md">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">ObraFlow</h1>
          <p className="text-sm text-muted-foreground">Gestão de Obras</p>
        </div>

        <Card className="shadow-elev-md">
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
            <CardDescription>Entre, crie sua conta ou cadastre uma empresa</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Conta</TabsTrigger>
                <TabsTrigger value="empresa">Empresa</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">E-mail</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">Senha</Label>
                    <Input id="password2" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? "Criando..." : "Criar conta"}</Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Use esta opção apenas se você foi convidado por uma empresa.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="empresa">
                <form onSubmit={handleEmpresaSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="empresa">Nome da empresa</Label>
                    <Input id="empresa" required value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nome3">Seu nome completo</Label>
                    <Input id="nome3" required value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email3">E-mail</Label>
                    <Input id="email3" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password3">Senha</Label>
                    <Input id="password3" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Cadastrando..." : "Cadastrar empresa"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Você será o administrador da empresa.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
