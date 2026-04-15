import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SplashScreen } from "@/components/SplashScreen";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DashboardMensual from "./pages/DashboardMensual";

import DashboardEspecialista from "./pages/DashboardEspecialista";
import Solicitudes from "./pages/Solicitudes";
import SolicitudDetalle from "./pages/SolicitudDetalle";
import Facturas from "./pages/Facturas";
import Presupuestos from "./pages/Presupuestos";
import PresupuestoDetalle from "./pages/PresupuestoDetalle";
import Servicios from "./pages/Servicios";
import Especialistas from "./pages/Especialistas";
import Contratos from "./pages/Contratos";
import Clientes from "./pages/Clientes";
import ClienteDetalle from "./pages/ClienteDetalle";
import Liquidaciones from "./pages/Liquidaciones";
import LiquidacionDetalle from "./pages/LiquidacionDetalle";

import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";
import Perfil from "./pages/Perfil";
import Comisiones from "./pages/Comisiones";
import NotFound from "./pages/NotFound";
import OperationalProjects from "./pages/operations/OperationalProjects";
import OperationalProjectDetail from "./pages/operations/OperationalProjectDetail";
import MyTasks from "./pages/operations/MyTasks";
import FirmaLiquidacion from "./pages/FirmaLiquidacion";
import AccionRequest from "./pages/AccionRequest";
import TestEmail from "./pages/TestEmail";
import Notificaciones from "./pages/Notificaciones";
import GuiaRapida from "./pages/GuiaRapida";
import ResetPassword from "./pages/ResetPassword";
import PublicQuote from "./pages/PublicQuote";
import Gastos from "./pages/Gastos";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar si la app está en modo PWA (instalada)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    
    // Si no es PWA, no mostrar splash
    if (!standalone) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {showSplash && isStandalone && (
          <SplashScreen onComplete={handleSplashComplete} />
        )}
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Public pages - no auth required */}
              <Route path="/liquidacion/firmar/:token" element={<FirmaLiquidacion />} />
              <Route path="/quote/:token" element={<PublicQuote />} />
              <Route path="/solicitud/accion/:token" element={<AccionRequest />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard-mensual" element={<ProtectedRoute><DashboardMensual /></ProtectedRoute>} />
              
              <Route path="/dashboard-especialista" element={<ProtectedRoute><DashboardEspecialista /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
              <Route path="/clientes/:id" element={<ProtectedRoute><ClienteDetalle /></ProtectedRoute>} />
              <Route path="/servicios" element={<ProtectedRoute><Servicios /></ProtectedRoute>} />
              <Route path="/especialistas" element={<ProtectedRoute><Especialistas /></ProtectedRoute>} />
              <Route path="/contratos" element={<ProtectedRoute><Contratos /></ProtectedRoute>} />
              <Route path="/presupuestos" element={<ProtectedRoute><Presupuestos /></ProtectedRoute>} />
              <Route path="/presupuestos/:id" element={<ProtectedRoute><PresupuestoDetalle /></ProtectedRoute>} />
              <Route path="/solicitudes" element={<ProtectedRoute><Solicitudes /></ProtectedRoute>} />
              <Route path="/solicitudes/:id" element={<ProtectedRoute><SolicitudDetalle /></ProtectedRoute>} />
              <Route path="/facturas" element={<ProtectedRoute><Facturas /></ProtectedRoute>} />
              <Route path="/liquidaciones" element={<ProtectedRoute><Liquidaciones /></ProtectedRoute>} />
              <Route path="/liquidaciones/:id" element={<ProtectedRoute><LiquidacionDetalle /></ProtectedRoute>} />
              
              <Route path="/reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
              <Route path="/gastos" element={<ProtectedRoute><Gastos /></ProtectedRoute>} />
              <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
              <Route path="/comisiones" element={<ProtectedRoute><Comisiones /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
              <Route path="/proyectos-operativos" element={<ProtectedRoute><OperationalProjects /></ProtectedRoute>} />
              <Route path="/operaciones/proyectos/:id" element={<ProtectedRoute><OperationalProjectDetail /></ProtectedRoute>} />
              <Route path="/mis-tareas" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
              <Route path="/notificaciones" element={<ProtectedRoute><Notificaciones /></ProtectedRoute>} />
              <Route path="/guia-rapida" element={<ProtectedRoute><GuiaRapida /></ProtectedRoute>} />
              <Route path="/test-email" element={<ProtectedRoute><TestEmail /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
