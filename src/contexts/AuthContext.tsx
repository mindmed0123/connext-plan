import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  empresaId: string | null;
  empresaNome: string | null;
  refreshEmpresa: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  authReady: false,
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
  const [authReady, setAuthReady] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);

  const loadEmpresa = async (uid: string | undefined) => {
    if (!uid) {
      setEmpresaId(null);
      setEmpresaNome(null);
      return;
    }
    const superAdmin = await isSuperAdmin(uid);
    let { empresaId, empresaNome, empresaAtivo } = await fetchEmpresa(uid);

    if (superAdmin) {
      setEmpresaId(null);
      setEmpresaNome(null);
      return;
    }

    // Fallback: se o usuário não tem empresa (signup com confirmação por email pendente
    // ou cadastro antigo), cria empresa + trial automaticamente.
    if (!empresaId) {
      const pendingNome =
        (typeof window !== "undefined" && sessionStorage.getItem("pending_empresa_nome")) || "Minha Empresa";
      const { data: novoId, error } = await supabase.rpc("signup_create_company", {
        _nome_empresa: pendingNome,
      });
      if (!error && novoId) {
        if (typeof window !== "undefined") sessionStorage.removeItem("pending_empresa_nome");
        const refetched = await fetchEmpresa(uid);
        empresaId = refetched.empresaId;
        empresaNome = refetched.empresaNome;
        empresaAtivo = refetched.empresaAtivo;
      }
    }

    // Bloqueia login se empresa estiver inativa (super_admin é exceção)
    if (empresaId && empresaAtivo === false) {
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
    setEmpresaId(empresaId);
    setEmpresaNome(empresaNome);
  };

  const authReadyRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      const nextId = sess?.user?.id ?? null;

      // Eventos de manutenção de sessão (troca de aba, refresh de token, foco na
      // janela) NÃO devem recarregar o app — isso apagava formulários abertos.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        return;
      }
      if (nextId === userIdRef.current) return;
      userIdRef.current = nextId;

      if (!authReadyRef.current) return;
      setLoading(true);
      if (sess?.user) {
        setTimeout(async () => {
          await loadEmpresa(sess.user.id);
          setLoading(false);
        }, 0);
      } else {
        setEmpresaId(null);
        setEmpresaNome(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      userIdRef.current = sess?.user?.id ?? null;
      if (sess?.user) await loadEmpresa(sess.user.id);
      authReadyRef.current = true;
      setAuthReady(true);
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
    <Ctx.Provider value={{ user, session, loading, authReady, empresaId, empresaNome, refreshEmpresa, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
