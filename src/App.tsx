import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

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

// Fonction utilitaire pour détecter l'application courante
const getCurrentApp = () => {
  const hostname = window.location.hostname;
  const searchParams = new URLSearchParams(window.location.search);
  const simulatedApp = searchParams.get('app');

  if (Capacitor.isNativePlatform()) {
    if (simulatedApp === 'docs') return 'docs';
    if (simulatedApp === 'account') return 'account';
    if (simulatedApp === 'mail') return 'mail';
    if (simulatedApp === 'www') return 'www';
    return 'mobile-launcher';
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (simulatedApp === 'docs') return 'docs';
    if (simulatedApp === 'account') return 'account';
    if (simulatedApp === 'mail') return 'mail';
    if (simulatedApp === 'www') return 'www';
    if (simulatedApp === 'mobile') return 'mobile-launcher';
    return 'dev-portal';
  }

  if (hostname.startsWith('docs.')) return 'docs';
  if (hostname.startsWith('account.')) return 'account';
  if (hostname.startsWith('mail.')) return 'mail';
  return 'www';
};

const App = () => {
  const currentApp = getCurrentApp();

  useEffect(() => {
    // Écoute des Deep Links pour l'authentification mobile
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', async (data) => {
        console.log('App opened with URL:', data.url);
        
        if (data.url.includes('login-callback')) {
          // Extraction des tokens du hash URL (ex: ...#access_token=xyz&refresh_token=abc)
          const urlObj = new URL(data.url.replace('#', '?')); // Hack pour parser le hash comme query params
          const accessToken = urlObj.searchParams.get('access_token');
          const refreshToken = urlObj.searchParams.get('refresh_token');

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            // Recharger pour mettre à jour l'état AuthProvider
            window.location.reload();
          }
        }
      });
    }
  }, []);

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