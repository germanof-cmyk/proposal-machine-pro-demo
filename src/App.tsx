import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import { ClientePortalGuard } from "@/components/ClientePortalGuard";
import Home from "./pages/Home.tsx";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Orcamento from "./pages/Orcamento.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import ClienteView from "./pages/ClienteView.tsx";
import Configuracoes from "./pages/Configuracoes.tsx";
import PortalLogin from "./pages/portal/PortalLogin.tsx";
import PortalDashboard from "./pages/portal/PortalDashboard.tsx";
import PortalOrcamento from "./pages/portal/PortalOrcamento.tsx";
import PedidosEmpresa from "./pages/PedidosEmpresa.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pedidos/:token" element={<PedidosEmpresa />} />
          <Route path="/cliente/:token" element={<ClienteView />} />
          <Route path="/portal/login" element={<PortalLogin />} />

          {/* Portal de Fabricação (autenticado como client_user) */}
          <Route element={<ClientePortalGuard />}>
            <Route path="/portal" element={<PortalDashboard />} />
            <Route path="/portal/orcamento/:id" element={<PortalOrcamento />} />
          </Route>

          {/* Sistema do representante (autenticado, não client_user) */}
          <Route element={<AuthGuard />}>
            <Route path="/app" element={<Index />} />
            <Route path="/app/orcamento/:id" element={<Orcamento />} />
            <Route path="/app/dashboard" element={<Dashboard />} />
            <Route path="/app/configuracoes" element={<Configuracoes />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
