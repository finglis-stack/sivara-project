import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="text-sm text-gray-500 font-medium animate-pulse">Chargement de votre session...</p>
      </div>
    );
  }

  if (!user) {
    // Si pas connecté, on redirige vers le login
    return <Navigate to="/login" replace />;
  }

  // Si connecté, on affiche la page demandée
  return <>{children}</>;
};