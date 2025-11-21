import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Monitor from "./pages/Monitor";
import Profile from "./pages/Profile";
import Docs from "./pages/Docs";
import DocEditor from "./pages/DocEditor";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Détection du sous-domaine pour rediriger vers l'app Docs
  const isDocsSubdomain = window.location.hostname.startsWith('docs.');

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Si on est sur docs.sivara.ca, la racine EST l'application Docs */}
              {isDocsSubdomain ? (
                <>
                  <Route path="/" element={<Docs />} />
                  <Route path="/docs" element={<Navigate to="/" replace />} />
                </>
              ) : (
                <>
                  {/* Sinon, la racine est le moteur de recherche */}
                  <Route path="/" element={<Index />} />
                  {/* Et /docs mène à l'application Docs */}
                  <Route path="/docs" element={<Docs />} />
                </>
              )}

              <Route path="/login" element={<Login />} />
              <Route path="/onboarding" element={<Onboarding />} />
              
              {/* Routes Protégées */}
              <Route path="/monitor" element={
                <ProtectedRoute>
                  <Monitor />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              
              {/* L'éditeur reste protégé, mais on peut y accéder via ID */}
              <Route path="/docs/:id" element={
                <ProtectedRoute>
                  <DocEditor />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;