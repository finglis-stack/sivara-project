import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Mail, Lock, ArrowRight, ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // État étendu : 'email' -> 'password' OU 'email' -> 'recovery'
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
            const redirectUrl = `${url}${separator}${hashParams.toString()}`;
            window.location.href = redirectUrl;
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

  useEffect(() => {
    if (blockedUntil) {
      const interval = setInterval(() => {
        if (Date.now() >= blockedUntil) setBlockedUntil(null);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [blockedUntil]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { showError('Veuillez entrer votre adresse email'); return; }
    if (blockedUntil && Date.now() < blockedUntil) { return; }

    setIsChecking(true);
    try {
      // Simulation UX : on passe au mot de passe par défaut
      // Supabase renverra une erreur spécifique si le compte n'existe pas lors du SignIn
      setStep('password');
    } finally {
      setIsChecking(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { showError('Veuillez entrer votre mot de passe'); return; }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showSuccess('Connexion réussie !');
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
        // Redirection explicite vers account.sivara.ca/reset-password
        // Cela permet de gérer correctement le token même si l'utilisateur est en local
        const redirectUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8080/reset-password?app=account'
            : 'https://account.sivara.ca/reset-password';

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        });

        if (error) throw error;

        showSuccess(`Email de récupération envoyé à ${email}`);
        // On reste sur la page ou on revient à l'accueil
        setTimeout(() => setStep('email'), 3000);
    } catch (error: any) {
        showError(error.message || "Erreur d'envoi");
    } finally {
        setIsLoading(false);
    }
  };

  const getRemainingTime = () => {
    if (!blockedUntil) return 0;
    return Math.ceil((blockedUntil - Date.now()) / 1000);
  };

  const isBlocked = blockedUntil && Date.now() < blockedUntil;

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-8 sm:py-0">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/auth-bg-v2.jpg)' }}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2 sm:mb-3 drop-shadow-lg">Sivara</h1>
          <p className="text-base sm:text-lg text-white/90 drop-shadow px-4">Bienvenue ! Connectez-vous à votre compte</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur overflow-hidden mx-auto w-full">
          <CardHeader className="space-y-1 pb-4 sm:pb-6 px-5 sm:px-6 pt-5 sm:pt-6">
            <CardTitle className="text-xl sm:text-2xl font-bold">
                {step === 'recovery' ? 'Récupération' : 'Connexion'}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {step === 'email' ? 'Entrez votre adresse email pour commencer' : 
               step === 'password' ? 'Entrez votre mot de passe pour continuer' : 
               'Nous allons vous envoyer un lien de connexion'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
            
            {/* ETAPE 1: EMAIL */}
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">Adresse email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input id="email" type="email" placeholder="jean.dupont@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 sm:h-12 pl-10 text-base" required autoFocus disabled={isChecking || isBlocked} />
                  </div>
                  {isBlocked && <p className="text-xs text-red-600 animate-pulse">Veuillez attendre {getRemainingTime()}s</p>}
                </div>
                <Button type="submit" className="w-full h-11 sm:h-12 bg-gray-700 hover:bg-gray-800 text-base font-semibold" disabled={isChecking || isBlocked}>
                  {isChecking ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Vérification...</> : <><span className="mr-2">Continuer</span> <ArrowRight className="h-5 w-5" /></>}
                </Button>
              </form>
            )}

            {/* ETAPE 2: MOT DE PASSE */}
            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-500">Adresse email</Label>
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
                    <span className="text-sm font-medium text-gray-700 truncate mr-2">{email}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setStep('email'); setPassword(''); }} className="h-8 text-xs shrink-0">Modifier</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input id="password" type="password" placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 sm:h-12 pl-10 text-base" required autoFocus disabled={isLoading} />
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <button type="button" onClick={() => setStep('recovery')} className="text-sm text-gray-600 hover:text-gray-900 font-medium underline-offset-4 hover:underline">
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep('email')} className="h-11 sm:h-12 text-base font-semibold" disabled={isLoading}><ArrowLeft className="mr-2 h-5 w-5" /> Retour</Button>
                  <Button type="submit" className="flex-1 h-11 sm:h-12 bg-gray-700 hover:bg-gray-800 text-base font-semibold" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connexion...</> : 'Se connecter'}
                  </Button>
                </div>
              </form>
            )}

            {/* ETAPE 3: RECOVERY */}
            {step === 'recovery' && (
                <form onSubmit={handleRecoverySubmit} className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-500">Compte à récupérer</Label>
                        <div className="bg-gray-50 rounded-lg px-3 py-3 text-sm font-medium text-gray-700 border border-gray-100">{email}</div>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        Nous allons envoyer un lien sécurisé à cette adresse pour définir un nouveau mot de passe.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => setStep('password')} className="h-11 text-base font-semibold" disabled={isLoading}>Annuler</Button>
                        <Button type="submit" className="flex-1 h-11 bg-black hover:bg-gray-800 text-base font-semibold text-white" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Envoyer le lien
                        </Button>
                    </div>
                </form>
            )}

            <div className="mt-5 sm:mt-6 text-center">
              {step !== 'recovery' && (
                  <p className="text-sm text-gray-600">
                    Vous n'avez pas de compte ?{' '}
                    <a href={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} className="text-gray-700 font-semibold hover:text-gray-900 underline block sm:inline mt-1 sm:mt-0">
                      Créer un compte
                    </a>
                  </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;