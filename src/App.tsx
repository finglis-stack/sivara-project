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
import HelpLanding from "./pages/HelpLanding";
import HelpAdmin from "./pages/HelpAdmin";
import HelpCategory from "./pages/HelpCategory";
import HelpArticle from "./pages/HelpArticle";
import HelpMyTickets from "./pages/HelpMyTickets";
import HelpAdminProfile from "./pages/HelpAdminProfile";
import ResetPassword from "./pages/ResetPassword";
import DeviceLanding from "./pages/DeviceLanding";
import DeviceAdmin from "./pages/DeviceAdmin";
import DeviceCheckout from "./pages/DeviceCheckout";
import IdentityVerification from "./pages/IdentityVerification";
import DeviceCustomerDetails from "./pages/DeviceCustomerDetails";

// Docs: Point
import PointCreate from "./pages/PointCreate";
import PointEditor from "./pages/PointEditor";

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
      if (appParam === 'help') return 'help';
      if (appParam === 'device') return 'device';
      if (appParam === 'device-admin') return 'device-admin';
      if (appParam === 'id') return 'id';
      return 'mobile-launcher';
    }

    // 2. Mode Localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (appParam === 'docs') return 'docs';
      if (appParam === 'account') return 'account';
      if (appParam === 'mail') return 'mail';
      if (appParam === 'www') return 'www';
      if (appParam === 'help') return 'help';
      if (appParam === 'device') return 'device';
      if (appParam === 'device-admin') return 'device-admin';
      if (appParam === 'mobile') return 'mobile-launcher';
      if (appParam === 'id') return 'id';
      return 'dev-portal';
    }

    // 3. Mode Production (Sous-domaines)
    if (hostname.startsWith('docs.')) return 'docs';
    if (hostname.startsWith('account.')) return 'account';
    if (hostname.startsWith('mail.')) return 'mail';
    if (hostname.startsWith('help.')) return 'help';
    if (hostname.startsWith('device.')) return 'device';
    if (hostname.startsWith('id.')) return 'id';
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
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </>
      )}

      {/* --- APPLICATION: HELP --- */}
      {currentApp === 'help' && (
        <>
          <Route path="/" element={<HelpLanding />} />
          <Route path="/my-tickets" element={<HelpMyTickets />} />
          <Route path="/admin" element={<HelpAdmin />} />
          <Route path="/admin/profile/:userId" element={
            <ProtectedRoute>
              <HelpAdminProfile />
            </ProtectedRoute>
          } />
          <Route path="/category/:slug" element={<HelpCategory />} />
          <Route path="/article/:slug" element={<HelpArticle />} />
          <Route path="*" element={Capacitor.isNativePlatform() ? <Navigate to="/?app=mobile" /> : <NotFound />} />
        </>
      )}

      {/* --- APPLICATION: DEVICE --- */}
      {currentApp === 'device' && (
        <>
            <Route path="/" element={<DeviceLanding />} />
            <Route path="/checkout" element={<DeviceCheckout />} />
            <Route path="/admin" element={
                <ProtectedRoute>
                    <DeviceAdmin />
                </ProtectedRoute>
            } />
            <Route path="/admin/customer/:id" element={
                <ProtectedRoute>
                    <DeviceCustomerDetails />
                </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
      
      {/* --- APPLICATION: DEVICE ADMIN (Direct Access) --- */}
      {currentApp === 'device-admin' && (
         <Route path="*" element={
            <ProtectedRoute>
                <DeviceAdmin />
            </ProtectedRoute>
         } />
      )}

      {/* --- APPLICATION: ID SECURE (Identity Verification) --- */}
      {currentApp === 'id' && (
         <Route path="*" element={
            <ProtectedRoute>
                <IdentityVerification />
            </ProtectedRoute>
         } />
      )}

      {/* --- APPLICATION: DOCS --- */}
      {currentApp === 'docs' && (
        <>
          <Route path="/" element={<Docs />} />
          <Route path="/point/new" element={<PointCreate />} />
          <Route path="/point/:id" element={<PointEditor />} />
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
    // 1. Gestion Deep Link Mobile
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
    } else {
      // 2. Gestion Cross-Domain Web (Fallback Hash)
      const handleHashSession = async () => {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          try {
            // NOTE: Si c'est un lien de recovery, on laisse Supabase le gérer
            // La page ResetPassword fera le check de session elle-même.
            if (hash.includes('type=recovery')) {
                return; 
            }

            // Extraction manuelle robuste des tokens
            const params = new URLSearchParams(hash.substring(1)); // Enlève le '#'
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              console.log("[Auth] Token détecté dans URL, tentative de restauration...");
              
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              
              if (error) {
                console.error("[Auth] Erreur restauration session:", error);
              } else {
                console.log("[Auth] Session restaurée avec succès.");
                // Nettoyage de l'URL pour la propreté
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                
                // Forcer un rafraîchissement de l'utilisateur pour être sûr
                await supabase.auth.getUser();
              }
            }
          } catch (e) {
            console.error("[Auth] Erreur critique parsing hash", e);
          }
        }
      };
      
      // Petit délai pour laisser le temps au contexte de s'initialiser si besoin
      setTimeout(handleHashSession, 100);
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