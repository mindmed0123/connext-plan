import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Obras from "./pages/Obras";
import Etapas from "./pages/Etapas";
import Vistorias from "./pages/Vistorias";
import Orcamentos from "./pages/Orcamentos";
import Execucoes from "./pages/Execucoes";
import Faturamento from "./pages/Faturamento";
import Recebimentos from "./pages/Recebimentos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/obras" element={<Obras />} />
              <Route path="/etapas" element={<Etapas />} />
              <Route path="/kanban" element={<Etapas />} />
              <Route path="/vistorias" element={<Vistorias />} />
              <Route path="/orcamentos" element={<Orcamentos />} />
              <Route path="/execucoes" element={<Execucoes />} />
              <Route path="/faturamento" element={<Faturamento />} />
              <Route path="/recebimentos" element={<Recebimentos />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
