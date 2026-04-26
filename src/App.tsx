import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/auth/Login.tsx";
import Signup from "./pages/auth/Signup.tsx";
import Recover from "./pages/auth/Recover.tsx";
import ResetPassword from "./pages/auth/ResetPassword.tsx";
import AppLayout from "./layouts/AppLayout.tsx";
import Dashboard from "./pages/app/Dashboard.tsx";
import Contas from "./pages/app/Contas.tsx";
import Extrato from "./pages/app/Extrato.tsx";
import Conexoes from "./pages/app/Conexoes.tsx";
import Configuracoes from "./pages/app/Configuracoes.tsx";
import Planos from "./pages/app/Planos.tsx";
import Categorizacao from "./pages/app/Categorizacao.tsx";
import Faturas from "./pages/app/Faturas.tsx";
import Disponivel from "./pages/app/Disponivel.tsx";
import { FinanceProvider } from "./contexts/FinanceContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./components/ThemeProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/recuperar" element={<Recover />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <FinanceProvider>
                    <AppLayout />
                  </FinanceProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="contas" element={<Contas />} />
              <Route path="extrato" element={<Extrato />} />
              <Route path="disponivel" element={<Disponivel />} />
              <Route path="categorizacao" element={<Categorizacao />} />
              <Route path="faturas" element={<Faturas />} />
              <Route path="conexoes" element={<Conexoes />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="planos" element={<Planos />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
