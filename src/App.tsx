import { useEffect, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
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

const AppRoutes = () => {
  const [searchParams] = useSearchParams();
  const hostname = window.location.hostname;
  
  // Calcul de l'application courante réactif
  const currentApp = useMemo(() => {
    const appParam = searchParams.get('app');

    // 1. Gestion Mobile (Capacitor)
    if (Capacitor.isNativePlatform()) {
      if (appParam === 'docs') return 'docs';
      if (appParam === 'account') return 'account';
      if (appParam === 'mail') return 'mail';
      if (appParam === 'www') return 'www';
      return 'mobile-launcher';
    }

    // 2. Mode Localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (appParam === 'docs') return 'docs';
      if (appParam === 'account') return 'account';
      if (appParam === 'mail') return 'mail';
      if (appParam === 'www') return 'www';
      if (appParam === 'mobile') return 'mobile-launcher';
      return 'dev-portal';
    }

    // 3. Mode Production (Sous-domaines)
    if (hostname.startsWith('docs.')) return 'docs';
    if (hostname.startsWith('account.')) return 'account';
    if (hostname.startsWith('mail.')) return 'mail';
    return 'www';
  }, [searchParams, hostname]);

  return (
    <Routes>
      {/* --- MOBILE LAUNCHER --- */}
      {currentApp === 'mobile-launcher' && (
        <Route path="*" element={<MobileLanding />} />
      )}

      {/* --- APPLICATION: ACCOUNT --- */}
      {currentApp === 'account' && (
        <>
          {/* CORRECTION ICI : On pointe vers le profil par défaut, la ProtectedRoute gérera la sécu */}
          <Route path="/" element={<Navigate to="/profile" replace />} />
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
          {/* Fallback pour éviter le flash si route inconnue */}
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </>
      )}

      {/* --- APPLICATION: DOCS --- */}
      {currentApp === 'docs' && (
        <>
          <Route path="/" element={<Docs />} />
          <Route path="/:id" element={<DocEditor />} />
          <Route path="*" element={Capacitor.isNativePlatform() ? <Navigate to="/?app=mobile" /> : <NotFound />} />
        </>
      )}

      {/* --- APPLICATION: MAIL --- */}
      {currentApp === 'mail' && (
        <>
          <Route path="/" element={<Mail />} />
          <Route path="*" element={Capacitor.isNativePlatform() ? <Navigate to="/?app=mobile" /> : <NotFound />} />
        </>
      )}

      {/* --- APPLICATION: SEARCH ENGINE --- */}
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

      {/* --- DEV PORTAL --- */}
      {currentApp === 'dev-portal' && (
        <Route path="*" element={<DevPortal />} />
      )}
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const setupListener = async () => {
        await CapacitorApp.addListener('appUrlOpen', async (data) => {
          if (data.url.includes('login-callback')) {
            try {
              const urlObj = new URL(data.url.replace('#', '?'));
              const accessToken = urlObj.searchParams.get('access_token');
              const refreshToken = urlObj.searchParams.get('refresh_token');

              if (accessToken && refreshToken) {
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                window.location.reload();
              }
            } catch (e) {
              console.error("Deep link error", e);
            }
          }
        });
      };
      setupListener();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;