import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const initializeRecoverySession = async () => {
      // 1. Vérifier si une session est déjà active
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setSessionChecked(true);
        return;
      }

      // 2. Si pas de session, on regarde si les tokens sont dans l'URL (Hash)
      // C'est souvent le cas si l'auto-détection a échoué ou a été trop lente
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        try {
          const params = new URLSearchParams(hash.substring(1)); // Enlève le '#'
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error) {
              setSessionChecked(true);
              return;
            }
          }
        } catch (e) {
          console.error("Erreur parsing hash:", e);
        }
      }

      // 3. Écouter l'événement de récupération (Fallback final)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setSessionChecked(true);
        }
      });

      // Si après tout ça on a rien au bout de 2 secondes, on redirige
      setTimeout(async () => {
        const { data: { session: finalCheck } } = await supabase.auth.getSession();
        if (!finalCheck) {
           showError("Lien invalide ou expiré.");
           navigate('/login');
        }
      }, 4000); // Délai généreux pour laisser le temps au process PKCE

      return () => subscription.unsubscribe();
    };

    initializeRecoverySession();
  }, [navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      showError("Le mot de passe doit faire au moins 6 caractères");
      return;
    }

    setLoading(true);
    try {
      // Double vérification de la session avant l'envoi
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
         throw new Error("Session perdue. Veuillez recliquer sur le lien dans votre email.");
      }

      const { error } = await supabase.auth.updateUser({ password: password });

      if (error) throw error;

      // KEK/DEK: Re-initialize encryption after password change.
      // Since KEK is derived from user.id (immutable), the DEK stays valid.
      // We just invalidate the cache and re-init for a clean state.
      try {
        encryptionService.invalidateCache();
        await encryptionService.initialize(session.user.id);
      } catch (encError) {
        console.warn('Encryption re-init after password change:', encError);
        // Non-blocking: encryption will re-init on next page load
      }

      showSuccess("Mot de passe mis à jour avec succès !");
      
      setTimeout(() => {
        navigate('/profile');
      }, 1500);
    } catch (error: any) {
      console.error(error);
      showError(error.message || "Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="text-sm text-gray-500">Vérification du lien sécurisé...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
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
            Votre identité est vérifiée.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-4">
          <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-50 border border-emerald-100 rounded-lg">
            <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <p className="text-xs text-emerald-700">Vos documents chiffrés restent intacts. La clé de chiffrement est liée à votre identité, pas à votre mot de passe.</p>
          </div>
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
                autoFocus
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