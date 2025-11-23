import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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

const queryClient = new QueryClient();

// Fonction utilitaire pour détecter l'application courante
const getCurrentApp = () => {
  const hostname = window.location.hostname;
  const searchParams = new URLSearchParams(window.location.search);
  const simulatedApp = searchParams.get('app');

  // Mode Localhost avec simulation via paramètre ?app=...
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (simulatedApp === 'docs') return 'docs';
    if (simulatedApp === 'account') return 'account';
    if (simulatedApp === 'www') return 'www';
    return 'dev-portal'; // Par défaut en localhost
  }

  // Mode Production (Sous-domaines réels)
  if (hostname.startsWith('docs.')) return 'docs';
  if (hostname.startsWith('account.')) return 'account';
  return 'www'; // sivara.ca par défaut
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
                  {/* Redirection si page inconnue sur account */}
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </>
              )}

              {/* --- APPLICATION: DOCS (docs.sivara.ca) --- */}
              {currentApp === 'docs' && (
                <>
                  <Route path="/" element={<Docs />} />
                  {/* La route /:id n'est plus protégée globalement, DocEditor gère la sécu */}
                  <Route path="/:id" element={<DocEditor />} />
                  <Route path="*" element={<NotFound />} />
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
                  {/* Si on essaie d'aller sur /docs ou /login depuis le search, on redirige vers l'index */}
                  <Route path="*" element={<NotFound />} />
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