import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, ArrowRight, Check, ShieldCheck, Zap, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Lottie from 'lottie-react';
import animationData from '../../public/animal.json';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [step, setStep] = useState<'email' | 'password' | 'recovery'>('email');
  const [isChecking, setIsChecking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  const returnTo = searchParams.get('returnTo') || '/';

  const handleRedirect = async (url: string) => {
    if (url.includes('://') || url.startsWith('com.example.sivara')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const hashParams = new URLSearchParams();
            hashParams.append('access_token', session.access_token);
            hashParams.append('refresh_token', session.refresh_token);
            hashParams.append('expires_in', String(session.expires_in));
            hashParams.append('token_type', session.token_type);
            hashParams.append('type', 'recovery'); 
            const separator = url.includes('#') ? '&' : '#';
            window.location.href = `${url}${separator}${hashParams.toString()}`;
            return;
        }
        window.location.href = url;
    } else {
      navigate(url);
    }
  };

  useEffect(() => {
    if (user) handleRedirect(returnTo);
  }, [user, returnTo]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { showError('Veuillez entrer votre adresse email'); return; }
    setIsChecking(true);
    // Simulation UX fluide
    setTimeout(() => {
        setStep('password');
        setIsChecking(false);
    }, 500);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { showError('Veuillez entrer votre mot de passe'); return; }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // KEK/DEK: Derive KEK from the REAL password, unwrap the DEK
      if (data.user) {
        try {
          await encryptionService.initializeWithPassword(password, data.user.id);
        } catch (encError: any) {
          console.warn('Encryption init (may be first-time user):', encError.message);
          // Non-blocking: user may not have DEK yet (legacy account)
        }
      }

      showSuccess('Connexion réussie');
    } catch (error: any) {
      console.error('Login error:', error);
      showError(error.message || 'Identifiants incorrects');
      setIsLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { showError('Veuillez entrer votre email'); return; }
    
    setIsLoading(true);
    try {
        const redirectUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8080/reset-password?app=account'
            : 'https://account.sivara.ca/reset-password';

        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
        if (error) throw error;

        showSuccess(`Email de récupération envoyé à ${email}`);
        setTimeout(() => setStep('email'), 3000);
    } catch (error: any) {
        showError(error.message || "Erreur d'envoi");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-gray-100">
      {/* GAUCHE : FORMULAIRE */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-24 flex flex-col justify-center border-r border-gray-100">
        <div className="max-w-sm mx-auto w-full space-y-10">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
             <img src="/sivara-logo.png" alt="Sivara" className="h-10 w-10 object-contain" />
             <span className="text-xl font-bold tracking-tight text-gray-900">Sivara</span>
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              {step === 'recovery' ? 'Récupération' : 'Connexion'}
            </h1>
            <p className="text-gray-500 text-sm font-light">
              {step === 'email' ? 'Accédez à votre espace sécurisé.' : 
               step === 'password' ? `Bienvenue de nouveau, ${email}` : 
               'Nous vous enverrons un lien sécurisé.'}
            </p>
          </div>

          {/* Formulaire */}
          <div className="space-y-6">
            
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-gray-700 uppercase tracking-wide">Adresse email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="nom@entreprise.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="h-12 bg-gray-50 border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-900 transition-all" 
                    required 
                    autoFocus 
                    disabled={isChecking} 
                  />
                </div>
                <Button type="submit" className="w-full h-12 bg-gray-900 hover:bg-black text-white font-medium rounded-lg transition-all" disabled={isChecking}>
                  {isChecking ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex items-center">Continuer <ArrowRight className="ml-2 h-4 w-4" /></span>}
                </Button>
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-xs font-medium text-gray-700 uppercase tracking-wide">Mot de passe</Label>
                    <button type="button" onClick={() => setStep('recovery')} className="text-xs text-gray-500 hover:text-gray-900 hover:underline">Oublié ?</button>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="h-12 bg-gray-50 border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-900 transition-all" 
                    required 
                    autoFocus 
                    disabled={isLoading} 
                  />
                </div>
                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep('email')} className="h-12 px-6 border-gray-200 text-gray-600 hover:bg-gray-50">Retour</Button>
                    <Button type="submit" className="flex-1 h-12 bg-gray-900 hover:bg-black text-white font-medium rounded-lg transition-all" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Se connecter'}
                    </Button>
                </div>
              </form>
            )}

            {step === 'recovery' && (
                <form onSubmit={handleRecoverySubmit} className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="p-4 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-100">
                        Un lien de connexion temporaire sera envoyé à <strong>{email}</strong>.
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => setStep('password')} className="h-12 px-6 border-gray-200 text-gray-600 hover:bg-gray-50">Annuler</Button>
                        <Button type="submit" className="flex-1 h-12 bg-gray-900 hover:bg-black text-white font-medium rounded-lg transition-all" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Envoyer le lien'}
                        </Button>
                    </div>
                </form>
            )}

            <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">ou</span></div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Pas encore de compte ?{' '}
                <a href={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-gray-900 hover:underline">
                  S'inscrire gratuitement
                </a>
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="pt-8 flex gap-6 text-xs text-gray-400">
            <a href="https://help.sivara.ca/article/conditions-dutilisation" className="hover:text-gray-600">Conditions</a>
            <a href="https://help.sivara.ca/article/politique-de-confidentialit" className="hover:text-gray-600">Confidentialité</a>
            <a href="https://help.sivara.ca" className="hover:text-gray-600">Aide</a>
          </div>
        </div>
      </div>

      {/* DROITE : LOTTIE ANIMATION */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-50 items-center justify-center p-12 relative overflow-hidden flex-col text-center">
         <div className="w-64 h-64 mb-8">
            <Lottie animationData={animationData} loop={true} />
         </div>
         <div className="max-w-md space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <h3 className="text-xl font-bold text-gray-900">Encore vous ?</h3>
            <p className="text-gray-500 text-sm">On a gardé vos données au chaud (et chiffrées, évidemment). Les hamsters du serveur vous passent le bonjour.</p>
         </div>
      </div>
    </div>
  );
};

export default Login;