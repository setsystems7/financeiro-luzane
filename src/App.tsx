import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Stock from "./pages/Stock";
import POS from "./pages/POS";
import Financial from "./pages/Financial";
import Exchanges from "./pages/Exchanges";
import Labels from "./pages/Labels";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Restock from "./pages/Restock";
import Fiado from "./pages/Fiado";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><POS /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/produtos" element={<ProtectedRoute><Products /></ProtectedRoute>} />
              <Route path="/estoque" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
              <Route path="/trocas" element={<ProtectedRoute><Exchanges /></ProtectedRoute>} />
              <Route path="/pdv" element={<ProtectedRoute><POS /></ProtectedRoute>} />
              <Route path="/fiado" element={<ProtectedRoute><Fiado /></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
              <Route path="/etiquetas" element={<ProtectedRoute><Labels /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/reposicao" element={<ProtectedRoute><Restock /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
