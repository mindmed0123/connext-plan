import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Plano = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number;
  cakto_product_id_mensal: string | null;
  cakto_product_id_anual: string | null;
  limite_obras: number | null;
  limite_usuarios: number | null;
  recursos: string[];
  destaque: boolean;
  ordem: number;
};

const formatPrice = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Pricing() {
  const { user, empresaId } = useAuth();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<"mensal" | "anual">("mensal");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Planos e preços | Gestão de Obra";
  }, []);

  const { data: planos, isLoading } = useQuery({
    queryKey: ["planos-publicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as Plano[];
    },
  });

  const handleAssinar = async (plano: Plano) => {
    if (!user) {
      navigate("/auth?redirect=/pricing");
      return;
    }
    if (!empresaId) {
      toast.error("Sua conta não está vinculada a uma empresa.");
      return;
    }
    setLoadingId(plano.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plano_slug: plano.slug, periodo },
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

  const economia = useMemo(() => {
    if (!planos?.[1]) return 0;
    const mensal12 = planos[1].preco_mensal * 12;
    return Math.round(((mensal12 - planos[1].preco_anual) / mensal12) * 100);
  }, [planos]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between py-4">
          <button onClick={() => navigate("/dashboard")} className="text-lg font-semibold">
            Gestão de Obra
          </button>
          <Button variant="ghost" onClick={() => navigate(user ? "/" : "/auth")}>
            {user ? "Voltar ao app" : "Entrar"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <section className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" /> 14 dias grátis em qualquer plano
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Planos para empresas de obras
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Comece grátis. Pague só quando quiser continuar.
          </p>

          <div className="mt-8 inline-flex rounded-lg border bg-card p-1">
            <button
              onClick={() => setPeriodo("mensal")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                periodo === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setPeriodo("anual")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                periodo === "anual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Anual {economia > 0 && <span className="ml-1 text-xs">−{economia}%</span>}
            </button>
          </div>
        </section>

        <section className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-3">
          {isLoading ? (
            <div className="col-span-3 flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            planos?.map((p) => {
              const preco = periodo === "mensal" ? p.preco_mensal : p.preco_anual / 12;
              return (
                <Card
                  key={p.id}
                  className={p.destaque ? "border-primary shadow-lg ring-1 ring-primary" : ""}
                >
                  <CardHeader>
                    {p.destaque && (
                      <Badge className="mb-2 w-fit">Mais popular</Badge>
                    )}
                    <h3 className="text-xl font-semibold">{p.nome}</h3>
                    <p className="text-sm text-muted-foreground">{p.descricao}</p>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">{formatPrice(preco)}</span>
                      <span className="text-muted-foreground">/mês</span>
                      {periodo === "anual" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Cobrado {formatPrice(p.preco_anual)} anualmente
                        </p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant={p.destaque ? "default" : "outline"}
                      onClick={() => handleAssinar(p)}
                      disabled={loadingId === p.id}
                    >
                      {loadingId === p.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {user ? "Assinar plano" : "Começar grátis"}
                    </Button>
                    <ul className="mt-6 space-y-3 text-sm">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>
                          {p.limite_obras ? `Até ${p.limite_obras} obras` : "Obras ilimitadas"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>
                          {p.limite_usuarios
                            ? `Até ${p.limite_usuarios} usuários`
                            : "Usuários ilimitados"}
                        </span>
                      </li>
                      {p.recursos?.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
          Cancele quando quiser. Pagamentos processados com segurança via Cakto.
        </p>
      </main>
    </div>
  );
}
