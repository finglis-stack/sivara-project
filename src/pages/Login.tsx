import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginData.email || !loginData.password) {
      showError('Veuillez remplir tous les champs');
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) throw error;

      showSuccess('Connexion réussie !');
      navigate('/');
    } catch (error: any) {
      console.error('Login error:', error);
      showError(error.message || 'Erreur lors de la connexion');
    } finally {
      setIsLoading(false);
    }
  };

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

        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
            <CardDescription className="text-base">
              Entrez vos identifiants pour accéder à votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
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
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="h-12 pl-10 text-base"
                    required
                  />
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
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="h-12 pl-10 text-base"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                  Mot de passe oublié ?
                </a>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gray-700 hover:bg-gray-800 text-base font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Vous n'avez pas de compte ?{' '}
                <a href="/onboarding" className="text-gray-700 font-semibold hover:text-gray-900 underline">
                  Créer un compte
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <a href="/" className="text-sm text-white/90 hover:text-white font-medium drop-shadow">
            ← Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;