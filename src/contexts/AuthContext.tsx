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
    .select("empresa_id, empresas(nome)")
    .eq("user_id", userId)
    .not("empresa_id", "is", null)
    .maybeSingle();
  return {
    empresaId: (data?.empresa_id as string | null) ?? null,
    empresaNome: ((data?.empresas as any)?.nome as string | null) ?? null,
  };
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
    const { empresaId, empresaNome } = await fetchEmpresa(uid);
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
