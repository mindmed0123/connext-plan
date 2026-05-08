import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  empresaId: string | null;
  empresaNome: string | null;
  refreshEmpresa: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  empresaId: null,
  empresaNome: null,
  refreshEmpresa: async () => {},
  signOut: async () => {},
});

async function fetchEmpresa(userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("empresa_id, empresas(nome, ativo)")
    .eq("user_id", userId)
    .not("empresa_id", "is", null)
    .maybeSingle();
  return {
    empresaId: (data?.empresa_id as string | null) ?? null,
    empresaNome: ((data?.empresas as any)?.nome as string | null) ?? null,
    empresaAtivo: ((data?.empresas as any)?.ativo as boolean | undefined) ?? null,
  };
}

async function isSuperAdmin(userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  return !!data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);

  const loadEmpresa = async (uid: string | undefined) => {
    if (!uid) {
      setEmpresaId(null);
      setEmpresaNome(null);
      return;
    }
    const { empresaId, empresaNome, empresaAtivo } = await fetchEmpresa(uid);
    // Bloqueia login se empresa estiver inativa (super_admin é exceção)
    if (empresaId && empresaAtivo === false) {
      const superAdmin = await isSuperAdmin(uid);
      if (!superAdmin) {
        await supabase.auth.signOut();
        setEmpresaId(null);
        setEmpresaNome(null);
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth?motivo=conta-suspensa";
        } else if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.get("motivo") !== "conta-suspensa") {
            url.searchParams.set("motivo", "conta-suspensa");
            window.history.replaceState({}, "", url.toString());
          }
        }
        return;
      }
    }
    setEmpresaId(empresaId);
    setEmpresaNome(empresaNome);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      // Defer to avoid deadlocks
      if (sess?.user) setTimeout(() => loadEmpresa(sess.user.id), 0);
      else {
        setEmpresaId(null);
        setEmpresaNome(null);
      }
    });
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) await loadEmpresa(sess.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshEmpresa = async () => {
    if (user?.id) await loadEmpresa(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, loading, empresaId, empresaNome, refreshEmpresa, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
