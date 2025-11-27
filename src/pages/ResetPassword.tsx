import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Vérifier si on a bien une session (le lien magique connecte l'utilisateur automatiquement)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError("Lien invalide ou expiré.");
        navigate('/login');
      } else {
        setSessionChecked(true);
      }
    };
    checkSession();
  }, [navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      showError("Le mot de passe doit faire au moins 6 caractères");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: password });

      if (error) throw error;

      showSuccess("Mot de passe mis à jour avec succès !");
      
      // Redirection vers le profil après une courte pause
      setTimeout(() => {
        navigate('/profile');
      }, 1500);
    } catch (error: any) {
      showError(error.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      {/* Fond identique au login */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/auth-bg-v2.jpg)' }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      </div>

      <Card className="relative z-10 w-full max-w-md border-0 shadow-2xl bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-xl font-bold">Nouveau mot de passe</CardTitle>
          <CardDescription>
            Votre identité est vérifiée. Choisissez un nouveau mot de passe sécurisé.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-4">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 bg-black hover:bg-gray-800" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Mettre à jour
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
</dyad-file>

### 2. Ajout de la route dans l'application

Il faut déclarer cette nouvelle page dans votre routeur principal.

<dyad-write path="src/App.tsx" description="Ajout de la route de reset password dans l'application Account">
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
import ResetPassword from "./pages/ResetPassword";

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
      return 'mobile-launcher';
    }

    // 2. Mode Localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (appParam === 'docs') return 'docs';
      if (appParam === 'account') return 'account';
      if (appParam === 'mail') return 'mail';
      if (appParam === 'www') return 'www';
      if (appParam === 'help') return 'help';
      if (appParam === 'mobile') return 'mobile-launcher';
      return 'dev-portal';
    }

    // 3. Mode Production (Sous-domaines)
    if (hostname.startsWith('docs.')) return 'docs';
    if (hostname.startsWith('account.')) return 'account';
    if (hostname.startsWith('mail.')) return 'mail';
    if (hostname.startsWith('help.')) return 'help';
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
          <Route path="/admin" element={<HelpAdmin />} />
          <Route path="/category/:slug" element={<HelpCategory />} />
          <Route path="/article/:slug" element={<HelpArticle />} />
          <Route path="*" element={Capacitor.isNativePlatform() ? <Navigate to="/?app=mobile" /> : <NotFound />} />
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
            // Si c'est un lien de recovery, on laisse Supabase le gérer ou on redirige
            if (hash.includes('type=recovery')) {
                // Supabase détectera l'événement onAuthStateChange
                return; 
            }

            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              
              if (!error) {
                // Nettoyage de l'URL
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
            }
          } catch (e) {
            console.error("Erreur restauration session", e);
          }
        }
      };
      handleHashSession();
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