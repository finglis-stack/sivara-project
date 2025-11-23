import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Capacitor } from "@capacitor/core";

// Apps
import Index from "./pages/Index";
import Docs from "./pages/Docs";
import DocEditor from "./pages/DocEditor";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Monitor from "./pages/Monitor";
import NotFound from "./pages/NotFound";
import DevPortal from "./pages/DevPortal";
import Pricing from "./pages/Pricing";
import Checkout from "./pages/Checkout";
import ProOnboarding from "./pages/ProOnboarding";
import Mail from "./pages/Mail";
import MobileLanding from "./pages/MobileLanding";

const queryClient = new QueryClient();

// Fonction utilitaire pour détecter l'application courante avec persistance
const getCurrentApp = () => {
  const hostname = window.location.hostname;
  const searchParams = new URLSearchParams(window.location.search);
  let app = searchParams.get('app');

  // 1. Gestion Mobile (Capacitor)
  if (Capacitor.isNativePlatform()) {
    // Si un paramètre 'app' est présent, on met à jour le contexte persistant
    if (app) {
      sessionStorage.setItem('sivara_mobile_context', app);
    } else {
      // Sinon, on récupère le dernier contexte connu
      app = sessionStorage.getItem('sivara_mobile_context');
    }

    // Si on demande explicitement le mobile launcher, on nettoie le contexte
    if (app === 'mobile' || app === 'mobile-launcher') {
        sessionStorage.removeItem('sivara_mobile_context');
        return 'mobile-launcher';
    }

    if (app === 'docs') return 'docs';
    if (app === 'account') return 'account';
    if (app === 'mail') return 'mail';
    if (app === 'www') return 'www';
    
    // Par défaut : Launcher
    return 'mobile-launcher';
  }

  // 2. Mode Localhost avec simulation
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (app) sessionStorage.setItem('sivara_dev_context', app);
    else app = sessionStorage.getItem('sivara_dev_context') || null;

    if (app === 'mobile') {
        sessionStorage.removeItem('sivara_dev_context');
        return 'mobile-launcher';
    }

    if (app === 'docs') return 'docs';
    if (app === 'account') return 'account';
    if (app === 'mail') return 'mail';
    if (app === 'www') return 'www';
    
    return 'dev-portal';
  }

  // 3. Mode Production (Sous-domaines réels)
  if (hostname.startsWith('docs.')) return 'docs';
  if (hostname.startsWith('account.')) return 'account';
  if (hostname.startsWith('mail.')) return 'mail';
  return 'www';
};

const App = () => {
  const currentApp = getCurrentApp();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* --- MOBILE LAUNCHER (Capacitor Only) --- */}
              {currentApp === 'mobile-launcher' && (
                <Route path="*" element={<MobileLanding />} />
              )}

              {/* --- APPLICATION: ACCOUNT (account.sivara.ca) --- */}
              {currentApp === 'account' && (
                <>
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/pro-onboarding" element={
                    <ProtectedRoute>
                      <ProOnboarding />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </>
              )}

              {/* --- APPLICATION: DOCS (docs.sivara.ca) --- */}
              {currentApp === 'docs' && (
                <>
                  <Route path="/" element={<Docs />} />
                  <Route path="/:id" element={<DocEditor />} />
                  <Route path="*" element={Capacitor.isNativePlatform() ? <Navigate to="/?app=mobile" /> : <NotFound />} />
                </>
              )}

              {/* --- APPLICATION: MAIL (mail.sivara.ca) --- */}
              {currentApp === 'mail' && (
                <>
                  <Route path="/" element={<Mail />} />
                  <Route path="*" element={Capacitor.isNativePlatform() ? <Navigate to="/?app=mobile" /> : <NotFound />} />
                </>
              )}

              {/* --- APPLICATION: SEARCH ENGINE (sivara.ca) --- */}
              {currentApp === 'www' && (
                <>
                  <Route path="/" element={<Index />} />
                  <Route path="/monitor" element={
                    <ProtectedRoute>
                      <Monitor />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={Capacitor.isNativePlatform() ? <Navigate to="/?app=mobile" /> : <NotFound />} />
                </>
              )}

              {/* --- DEV PORTAL (Localhost Only) --- */}
              {currentApp === 'dev-portal' && (
                <Route path="*" element={<DevPortal />} />
              )}

            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;