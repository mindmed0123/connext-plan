import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequirePermission } from "@/components/RequirePermission";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Obras from "./pages/Obras";
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
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { OnboardingGate } from "@/components/OnboardingGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
              <Route path="/obras" element={<RequirePermission modulo="obras"><Obras /></RequirePermission>} />
              <Route path="/etapas" element={<RequirePermission modulo="etapas"><Etapas /></RequirePermission>} />
              <Route path="/kanban" element={<RequirePermission modulo="etapas"><Etapas /></RequirePermission>} />
              <Route path="/vistorias" element={<RequirePermission modulo="vistorias"><Vistorias /></RequirePermission>} />
              <Route path="/orcamentos" element={<RequirePermission modulo="orcamentos"><Orcamentos /></RequirePermission>} />
              <Route path="/servicos" element={<RequirePermission modulo="servicos"><Servicos /></RequirePermission>} />
              <Route path="/execucoes" element={<RequirePermission modulo="execucoes"><Execucoes /></RequirePermission>} />
              <Route path="/financeiro" element={<RequirePermission modulo="financeiro"><Financeiro /></RequirePermission>} />
              <Route path="/faturamento" element={<RequirePermission modulo="faturamento"><Faturamento /></RequirePermission>} />
              <Route path="/recebimentos" element={<RequirePermission modulo="financeiro"><Recebimentos /></RequirePermission>} />
              <Route path="/equipes" element={<RequirePermission modulo="equipes"><Equipes /></RequirePermission>} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/billing" element={<Billing />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
