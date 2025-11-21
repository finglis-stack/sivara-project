import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [isChecking, setIsChecking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  // Récupérer l'URL de retour (par défaut /)
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    if (user) {
      navigate(returnTo);
    }
  }, [user, navigate, returnTo]);

  useEffect(() => {
    if (blockedUntil) {
      const interval = setInterval(() => {
        if (Date.now() >= blockedUntil) {
          setBlockedUntil(null);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [blockedUntil]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      showError('Veuillez entrer votre adresse email');
      return;
    }

    if (blockedUntil && Date.now() < blockedUntil) {
      const remainingSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
      showError(`Veuillez attendre ${remainingSeconds} seconde${remainingSeconds > 1 ? 's' : ''}`);
      return;
    }

    setIsChecking(true);

    try {
      // Essayer de se connecter avec un mot de passe invalide pour vérifier si l'email existe
      const testResult = await supabase.auth.signInWithPassword({
        email: email,
        password: '___TEST_INVALID_PASSWORD___' + Date.now(),
      });

      if (testResult.error) {
        const errorMessage = testResult.error.message.toLowerCase();
        
        // Si l'erreur contient "invalid login credentials", l'email existe
        if (errorMessage.includes('invalid login credentials') || 
            errorMessage.includes('invalid') ||
            errorMessage.includes('credentials')) {
          setStep('password');
        } else {
          // Email n'existe pas
          showError('Aucun compte trouvé avec cet email');
          setBlockedUntil(Date.now() + 4000);
        }
      } else {
        setStep('password');
      }
    } catch (error: any) {
      console.error('Erreur lors de la vérification:', error);
      showError('Erreur lors de la vérification');
    } finally {
      setIsChecking(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      showError('Veuillez entrer votre mot de passe');
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      showSuccess('Connexion réussie !');
      navigate(returnTo);
    } catch (error: any) {
      console.error('Login error:', error);
      showError(error.message || 'Mot de passe incorrect');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setPassword('');
  };

  const getRemainingTime = () => {
    if (!blockedUntil) return 0;
    return Math.ceil((blockedUntil - Date.now()) / 1000);
  };

  const isBlocked = blockedUntil && Date.now() < blockedUntil;

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      {/* Image de fond */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/auth-background.jpg)' }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      </div>

      {/* Contenu */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">Sivara</h1>
          <p className="text-lg text-white/90 drop-shadow">Bienvenue ! Connectez-vous à votre compte</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur overflow-hidden">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
            <CardDescription className="text-base">
              {step === 'email' 
                ? 'Entrez votre adresse email pour commencer'
                : 'Entrez votre mot de passe pour continuer'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' ? (
              <form onSubmit={handleEmailSubmit} className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">
                    Adresse email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="jean.dupont@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 pl-10 text-base"
                      required
                      autoFocus
                      disabled={isChecking || isBlocked}
                    />
                  </div>
                  {isBlocked && (
                    <p className="text-xs text-red-600 animate-pulse">
                      Veuillez attendre {getRemainingTime()} seconde{getRemainingTime() > 1 ? 's' : ''} avant de réessayer
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gray-700 hover:bg-gray-800 text-base font-semibold"
                  disabled={isChecking || isBlocked}
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Vérification...
                    </>
                  ) : isBlocked ? (
                    <>
                      Bloqué ({getRemainingTime()}s)
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-500">
                    Adresse email
                  </Label>
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">{email}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleBack}
                      className="h-8 text-xs"
                    >
                      Modifier
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Votre mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pl-10 text-base"
                      required
                      autoFocus
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <a href="#" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                    Mot de passe oublié ?
                  </a>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="h-12 text-base font-semibold"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Retour
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 bg-gray-700 hover:bg-gray-800 text-base font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      'Se connecter'
                    )}
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Vous n'avez pas de compte ?{' '}
                <a href={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} className="text-gray-700 font-semibold hover:text-gray-900 underline">
                  Créer un compte
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;