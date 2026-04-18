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
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';
import Lottie from 'lottie-react';
import animationData from '../../public/animal.json';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { setLanguage } = useLanguage();
  const { t } = useTranslation();
  
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

        // Update cookie based on the profile language
        const { data: profile } = await supabase
           .from('profiles')
           .select('language')
           .eq('id', data.user.id)
           .single();
           
        if (profile?.language) {
            setLanguage(profile.language as any);
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
    <div className="min-h-screen flex bg-[#faf9f4] font-sans selection:bg-[#00236F]/20">
      {/* GAUCHE : FORMULAIRE */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-24 flex flex-col justify-center border-r border-[#c5c5d3]/30">
        <div className="max-w-sm mx-auto w-full space-y-10">
          
          {/* Logo & Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
               <img src="/sivara-logo.png" alt="Sivara" className="h-10 w-10 object-contain" />
               <span className="text-xl font-bold tracking-tight text-[#111111]">Sivara</span>
            </div>
            <LanguageSelector />
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-light tracking-[-0.02em] text-[#111111]">
              {step === 'recovery' ? t('login.recoveryTitle') : t('login.title')}
            </h1>
            <p className="text-[#5a5b67] text-sm font-light">
              {t('login.subtitle')}
            </p>
          </div>

          {/* Formulaire */}
          <div className="space-y-6">
            
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('login.emailLabel')}</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder={t('login.emailPlaceholder')} 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="h-12 bg-white border-[#c5c5d3]/30 focus:bg-white focus:ring-1 focus:ring-[#111111] focus:border-[#111111] transition-all rounded-none shadow-sm text-[#111111] font-light" 
                    required 
                    autoFocus 
                    disabled={isChecking} 
                  />
                </div>
                <Button type="submit" className="w-full h-12 bg-[#00236F] hover:bg-[#1e3a8a] text-white font-light rounded-none transition-all uppercase tracking-wider text-sm" disabled={isChecking}>
                  {isChecking ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>{t('login.continueBtn')}</span>}
                </Button>
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('login.passwordLabel')}</Label>
                    <button type="button" onClick={() => setStep('recovery')} className="text-xs text-[#5a5b67] hover:text-[#111111] font-light">{t('login.forgotPassword')}</button>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="h-12 bg-white border-[#c5c5d3]/30 focus:bg-white focus:ring-1 focus:ring-[#111111] focus:border-[#111111] transition-all rounded-none shadow-sm text-[#111111] font-light" 
                    required 
                    autoFocus 
                    disabled={isLoading} 
                  />
                </div>
                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep('email')} className="h-12 px-6 border-[#c5c5d3]/30 text-[#5a5b67] hover:bg-[#efeee9] rounded-none uppercase tracking-wider text-sm font-light">Retour</Button>
                    <Button type="submit" className="flex-1 h-12 bg-[#00236F] hover:bg-[#1e3a8a] text-white font-light rounded-none transition-all uppercase tracking-wider text-sm" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('login.continueBtn')}
                    </Button>
                </div>
              </form>
            )}

            {step === 'recovery' && (
                <form onSubmit={handleRecoverySubmit} className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="p-4 bg-[#efeee9] text-[#2c2d38] text-sm rounded-none border border-[#c5c5d3]/30">
                        {t('login.tempLink')} <strong className="text-[#111111] font-bold">{email}</strong>.
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => setStep('password')} className="h-12 px-6 border-[#c5c5d3]/30 text-[#5a5b67] hover:bg-[#efeee9] rounded-none uppercase tracking-wider text-sm font-light">{t('login.recoveryBack')}</Button>
                        <Button type="submit" className="flex-1 h-12 bg-[#00236F] hover:bg-[#1e3a8a] text-white font-light rounded-none transition-all uppercase tracking-wider text-sm" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('login.sendLink')}
                        </Button>
                    </div>
                </form>
            )}

            <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-[#c5c5d3]/30" /></div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-[#faf9f4] px-2 text-[#5a5b67]">ou</span></div>
            </div>

            <div className="text-center">
              <p className="text-sm text-[#5a5b67] font-light">
                {t('login.noAccount')}{' '}
                <a href={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} className="text-[#111111] font-light hover:underline hover:font-medium transition-all">
                  {t('login.createAccount')}
                </a>
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="pt-8 flex gap-6 text-xs text-[#5a5b67] uppercase tracking-widest font-bold">
            <a href="https://help.sivara.ca/article/conditions-dutilisation" className="hover:text-[#111111] transition-colors">{t('footer.terms')}</a>
            <a href="https://help.sivara.ca/article/politique-de-confidentialit" className="hover:text-[#111111] transition-colors">{t('footer.privacy')}</a>
            <a href="https://help.sivara.ca" className="hover:text-[#111111] transition-colors">{t('footer.helpInfo')}</a>
          </div>
        </div>
      </div>

      {/* DROITE : LOTTIE ANIMATION */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#faf9f4] items-center justify-center p-12 relative overflow-hidden flex-col text-center">
         <div className="w-64 h-64 mb-8">
            <Lottie animationData={animationData} loop={true} />
         </div>
         <div className="max-w-md space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <h3 className="text-xl font-light tracking-tight text-[#111111]">{t('login.lottieTitle')}</h3>
            <p className="text-[#5a5b67] text-sm font-light">{t('login.lottieSub')}</p>
         </div>
      </div>
    </div>
  );
};

export default Login;