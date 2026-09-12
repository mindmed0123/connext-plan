import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";
import PortalObra from "./pages/PortalObra";
import Notificacoes from "./pages/Notificacoes";
import { ErroApp } from "@/components/ErroApp";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequirePermission } from "@/components/RequirePermission";
import { RequireModulo } from "@/components/RequireModulo";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Obras from "./pages/Obras";
import ObraDetalhe from "./pages/ObraDetalhe";
import Etapas from "./pages/Etapas";
import Vistorias from "./pages/Vistorias";
import Orcamentos from "./pages/Orcamentos";
import Servicos from "./pages/Servicos";
import Execucoes from "./pages/Execucoes";
import Faturamento from "./pages/Faturamento";
import Recebimentos from "./pages/Recebimentos";
import Equipes from "./pages/Equipes";
import Financeiro from "./pages/Financeiro";
import Admin from "./pages/Admin";
import Pricing from "./pages/Pricing";
import Billing from "./pages/Billing";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Configuracoes from "./pages/Configuracoes";
import Cartoes from "./pages/Cartoes";
import ContasPagar from "./pages/ContasPagar";
import Bancos from "./pages/Bancos";
import Compradores from "./pages/Compradores";
import Compras from "./pages/Compras";
import CompradorDetalhe from "./pages/CompradorDetalhe";
import Contratos from "./pages/Contratos";
import Medicoes from "./pages/Medicoes";
import PessoaDetalhe from "./pages/PessoaDetalhe";
import AcessosSuporte from "./pages/AcessosSuporte";
import Campo from "./pages/Campo";
import CampoRdo from "./pages/CampoRdo";
import CampoFoto from "./pages/CampoFoto";

import { SubscriptionGate } from "@/components/SubscriptionGate";
import { OnboardingGate } from "@/components/OnboardingGate";
import { instalarErrosEmPortugues } from "@/lib/erros";
import { hashComEmpresa } from "@/lib/tenant-cache";
import { detectarLimitePlano } from "@/lib/plano-limite";
import { toast } from "sonner";

const queryClient = new QueryClient({
  // Qualquer mutação bem-sucedida em qualquer aba atualiza todas as telas,
  // mantendo dashboard, obras, financeiro e recebimentos sempre em sincronia.
  mutationCache: new MutationCache({
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
    onError: (erro) => {
      const limite = detectarLimitePlano(erro);
      if (!limite) return;
      toast.error(limite.mensagem, {
        duration: 12000,
        action: { label: "Ver planos", onClick: () => (window.location.href = "/pricing") },
      });
    },
  }),

  defaultOptions: {
    queries: {
      // Todo cache é isolado por empresa (ver src/lib/tenant-cache.ts)
      queryKeyHashFn: hashComEmpresa,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

instalarErrosEmPortugues();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErroApp>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/termos" element={<Termos />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/portal/:token" element={<PortalObra />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <SubscriptionGate>
                    <Onboarding />
                  </SubscriptionGate>
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <SubscriptionGate>
                    <OnboardingGate>
                      <AppLayout />
                    </OnboardingGate>
                  </SubscriptionGate>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<RequirePermission modulo="dashboard"><Dashboard /></RequirePermission>} />
              <Route path="/obras" element={<RequireModulo modulo="obras"><RequirePermission modulo="obras"><Obras /></RequirePermission></RequireModulo>} />
              <Route path="/obras/:id" element={<RequireModulo modulo="obras"><RequirePermission modulo="obras"><ObraDetalhe /></RequirePermission></RequireModulo>} />
              <Route path="/etapas" element={<RequireModulo modulo="etapas"><RequirePermission modulo="etapas"><Etapas /></RequirePermission></RequireModulo>} />
              <Route path="/kanban" element={<RequireModulo modulo="etapas"><RequirePermission modulo="etapas"><Etapas /></RequirePermission></RequireModulo>} />
              <Route path="/vistorias" element={<RequireModulo modulo="vistorias"><RequirePermission modulo="vistorias"><Vistorias /></RequirePermission></RequireModulo>} />
              <Route path="/orcamentos" element={<RequireModulo modulo="orcamentos"><RequirePermission modulo="orcamentos"><Orcamentos /></RequirePermission></RequireModulo>} />
              <Route path="/servicos" element={<RequireModulo modulo="servicos"><RequirePermission modulo="servicos"><Servicos /></RequirePermission></RequireModulo>} />
              <Route path="/execucoes" element={<RequireModulo modulo="execucoes"><RequirePermission modulo="execucoes"><Execucoes /></RequirePermission></RequireModulo>} />
              <Route path="/financeiro" element={<RequirePermission modulo="financeiro"><Financeiro /></RequirePermission>} />
              <Route path="/faturamento" element={<RequireModulo modulo="faturamento"><RequirePermission modulo="faturamento"><Faturamento /></RequirePermission></RequireModulo>} />
              <Route path="/recebimentos" element={<RequireModulo modulo="recebimentos"><RequirePermission modulo="financeiro"><Recebimentos /></RequirePermission></RequireModulo>} />
              <Route path="/contratos" element={<RequireModulo modulo="contratos"><RequirePermission modulo="contratos"><Contratos /></RequirePermission></RequireModulo>} />
              <Route path="/medicoes" element={<RequireModulo modulo="medicoes"><RequirePermission modulo="medicoes"><Medicoes /></RequirePermission></RequireModulo>} />
              <Route path="/equipes" element={<RequireModulo modulo="equipes"><RequirePermission modulo="equipes"><Equipes /></RequirePermission></RequireModulo>} />
              <Route path="/equipes/pessoa/:id" element={<RequireModulo modulo="equipes"><RequirePermission modulo="equipes"><PessoaDetalhe /></RequirePermission></RequireModulo>} />
              <Route path="/contas-pagar" element={<RequireModulo modulo="contas_pagar"><RequirePermission modulo="financeiro"><ContasPagar /></RequirePermission></RequireModulo>} />
              <Route path="/bancos" element={<RequireModulo modulo="bancos"><RequirePermission modulo="financeiro"><Bancos /></RequirePermission></RequireModulo>} />
              <Route path="/cartoes" element={<RequireModulo modulo="cartoes"><RequirePermission modulo="financeiro"><Cartoes /></RequirePermission></RequireModulo>} />
              <Route path="/compradores" element={<RequireModulo modulo="compras"><RequirePermission modulo="financeiro"><Compradores /></RequirePermission></RequireModulo>} />
              <Route path="/compradores/:id" element={<RequireModulo modulo="compras"><RequirePermission modulo="financeiro"><CompradorDetalhe /></RequirePermission></RequireModulo>} />
              <Route path="/compras" element={<RequireModulo modulo="compras"><RequirePermission modulo="financeiro"><Compras /></RequirePermission></RequireModulo>} />

              <Route path="/campo" element={<Campo />} />
              <Route path="/campo/rdo" element={<RequireModulo modulo="diario"><RequirePermission modulo="diario"><CampoRdo /></RequirePermission></RequireModulo>} />
              <Route path="/campo/foto" element={<RequireModulo modulo="obras"><RequirePermission modulo="obras"><CampoFoto /></RequirePermission></RequireModulo>} />

              <Route path="/admin" element={<Admin />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/acessos-suporte" element={<AcessosSuporte />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ErroApp>
  </QueryClientProvider>
);

export default App;
