import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '@/components/LanguageSelector';
import { showSuccess, showError } from '@/utils/toast';
import { Building2, User, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Shield, Copy, Key } from 'lucide-react';
import Lottie from 'lottie-react';
import animationData from '../../public/animal.json';

// Liste réorganisée : CA (+1) en premier avec image
const countryCodes = [
  { code: '+1', country: 'CA', flagUrl: '/ca-flag.png' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+66', country: 'TH', flag: '🇹🇭' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
  { code: '+86', country: 'CN', flag: '🇨🇳' },
  { code: '+91', country: 'IN', flag: '🇮🇳' },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();
  const { t } = useTranslation();

  const returnTo = searchParams.get('returnTo') || '/';

  // Recovery key dialog
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [recoveryTypedConfirm, setRecoveryTypedConfirm] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneCountryCode: '+1', // Default CA
    phoneNumber: '',
    accountType: 'individual',
    termsAccepted: false,
    email: '',
    password: '',
  });

  const handleRedirect = (url: string) => {
    if (url.startsWith('http') || url.startsWith('//')) {
      window.location.href = url;
    } else {
      navigate(url);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!formData.firstName || !formData.lastName) {
        showError('Veuillez remplir tous les champs obligatoires');
        return;
      }
      if (!formData.termsAccepted) {
        showError('Vous devez accepter les conditions d\'utilisation');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      showError('Veuillez remplir tous les champs');
      return;
    }

    if (formData.password.length < 6) {
      showError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      setIsLoading(true);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 1. Insert basic profile first
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone_country_code: formData.phoneCountryCode,
            phone_number: formData.phoneNumber,
            account_type: formData.accountType,
            terms_accepted: formData.termsAccepted,
            terms_accepted_at: new Date().toISOString(),
            language: language,
          });

        if (profileError) throw profileError;

        // 2. KEK/DEK: Generate DEK, wrap with password + recovery key
        const { recoveryKey: rk, profileData } = await encryptionService.setupNewUser(formData.password);

        // 3. Save crypto columns to profile
        const { error: cryptoError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', authData.user.id);

        if (cryptoError) throw cryptoError;

        // 4. Show recovery key dialog — user MUST acknowledge before proceeding
        setRecoveryKey(rk);
        showSuccess('Compte créé avec succès !');
      }
    } catch (error: any) {
      console.error('Error creating account:', error);
      showError(error.message || 'Erreur lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryAcknowledge = () => {
    handleRedirect(returnTo);
  };

  const handleCopyRecoveryKey = () => {
    if (recoveryKey) {
      navigator.clipboard.writeText(recoveryKey);
      showSuccess('Clé copiée dans le presse-papiers');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f4] font-sans selection:bg-[#00236F]/20">

      {/* GAUCHE : FORMULAIRE */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-24 flex flex-col justify-center border-r border-[#c5c5d3]/30 relative z-10 bg-[#faf9f4]">
        <div className="max-w-md mx-auto w-full space-y-8">

          {/* Header */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
                <img src="/sivara-logo.png" alt="Sivara" className="h-10 w-10 object-contain" />
                <span className="text-xl font-bold tracking-tight text-[#111111]">Sivara</span>
              </div>
              <LanguageSelector />
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-light tracking-tight text-[#111111]">{t('onboarding.title')}</h1>
              <p className="text-[#5a5b67] text-sm font-light">{t('onboarding.subtitle')}</p>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2">
              <div className={`h-1 flex-1 rounded-none transition-all duration-500 ${step >= 1 ? 'bg-[#111111]' : 'bg-[#c5c5d3]/30'}`}></div>
              <div className={`h-1 flex-1 rounded-none transition-all duration-500 ${step >= 2 ? 'bg-[#111111]' : 'bg-[#c5c5d3]/30'}`}></div>
            </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {step === 1 ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('onboarding.firstNameLabel')}</Label>
                    <Input id="firstName" placeholder={t('onboarding.firstNamePlaceholder')} value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="h-12 bg-white border-[#c5c5d3]/30 focus:bg-white transition-all rounded-none shadow-sm focus:ring-[#111111] focus:border-[#111111] text-[#111111] font-light" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('onboarding.lastNameLabel')}</Label>
                    <Input id="lastName" placeholder={t('onboarding.lastNamePlaceholder')} value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="h-12 bg-white border-[#c5c5d3]/30 focus:bg-white transition-all rounded-none shadow-sm focus:ring-[#111111] focus:border-[#111111] text-[#111111] font-light" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('onboarding.phoneLabel')}</Label>
                  <div className="flex gap-2">
                    <Select value={formData.phoneCountryCode} onValueChange={(value) => setFormData({ ...formData, phoneCountryCode: value })}>
                      <SelectTrigger className="w-[110px] h-12 bg-white border-[#c5c5d3]/30 rounded-none shadow-sm text-[#111111]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {countryCodes.map((country) => (
                          <SelectItem key={country.country} value={country.code}>
                            <span className="flex items-center gap-2">
                              {country.flagUrl ? (
                                <img src={country.flagUrl} alt={country.country} className="w-5 h-auto object-contain" />
                              ) : (
                                <span>{country.flag}</span>
                              )}
                              <span className="font-mono text-xs">{country.country}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input id="phone" type="tel" placeholder={t('onboarding.phonePlaceholder')} value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} className="flex-1 h-12 bg-white border-[#c5c5d3]/30 focus:bg-white transition-all rounded-none shadow-sm focus:ring-[#111111] focus:border-[#111111] text-[#111111] font-light" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('onboarding.accountType')}</Label>
                  <RadioGroup value={formData.accountType} onValueChange={(value) => setFormData({ ...formData, accountType: value })} className="grid grid-cols-2 gap-4">
                    <Label htmlFor="individual" className={`flex flex-col items-center justify-center p-4 rounded-none border-2 cursor-pointer transition-all ${formData.accountType === 'individual' ? 'border-[#111111] bg-[#faf9f4] text-[#111111]' : 'border-[#c5c5d3]/30 bg-white text-[#5a5b67] hover:border-[#c5c5d3]'}`}>
                      <RadioGroupItem value="individual" id="individual" className="sr-only" />
                      <User className="h-6 w-6 mb-2" />
                      <span className="text-sm font-light">{t('onboarding.personal')}</span>
                    </Label>
                    <Label htmlFor="corporate" className={`flex flex-col items-center justify-center p-4 rounded-none border-2 cursor-pointer transition-all ${formData.accountType === 'corporate' ? 'border-[#111111] bg-[#faf9f4] text-[#111111]' : 'border-[#c5c5d3]/30 bg-white text-[#5a5b67] hover:border-[#c5c5d3]'}`}>
                      <RadioGroupItem value="corporate" id="corporate" className="sr-only" />
                      <Building2 className="h-6 w-6 mb-2" />
                      <span className="text-sm font-light">{t('onboarding.corporate')}</span>
                    </Label>
                  </RadioGroup>
                </div>

                <div className="flex items-start space-x-3 pt-2">
                  <Checkbox id="terms" checked={formData.termsAccepted} onCheckedChange={(checked) => setFormData({ ...formData, termsAccepted: checked as boolean })} className="mt-1 border-[#c5c5d3] data-[state=checked]:bg-[#111111] data-[state=checked]:border-[#111111]" />
                  <label htmlFor="terms" className="text-sm text-[#5a5b67] leading-relaxed cursor-pointer font-light">
                    {t('onboarding.acceptParts1')} <a href="https://help.sivara.ca/article/conditions-dutilisation" className="text-[#111111] font-medium hover:underline">{t('onboarding.acceptTerms')}</a>{t('onboarding.acceptAnd')}<a href="https://help.sivara.ca/article/politique-de-confidentialit" className="text-[#111111] font-medium hover:underline">{t('onboarding.acceptPrivacy')}</a>.
                  </label>
                </div>

                <Button type="button" onClick={handleNextStep} className="w-full h-12 bg-[#00236F] hover:bg-[#1e3a8a] text-white font-light rounded-none transition-all uppercase tracking-widest text-sm" disabled={!formData.termsAccepted}>
                  {t('onboarding.nextBtn')}
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('onboarding.emailLabel')}</Label>
                  <Input id="email" type="email" placeholder={t('onboarding.emailPlaceholder')} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-12 bg-white border-[#c5c5d3]/30 focus:bg-white transition-all rounded-none shadow-sm focus:ring-[#111111] focus:border-[#111111] text-[#111111] font-light" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('onboarding.passwordLabel')}</Label>
                  <Input id="password" type="password" placeholder={t('onboarding.passwordPlaceholder')} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="h-12 bg-white border-[#c5c5d3]/30 focus:bg-white transition-all rounded-none shadow-sm focus:ring-[#111111] focus:border-[#111111] text-[#111111] font-light" required />
                  <p className="text-xs text-[#5a5b67] font-light">{t('onboarding.passwordSub')}</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-12 px-6 border-[#c5c5d3]/30 text-[#5a5b67] hover:bg-[#efeee9] rounded-none uppercase tracking-wider text-sm font-light">{t('onboarding.backBtn')}</Button>
                  <Button type="submit" className="flex-1 h-12 bg-[#00236F] hover:bg-[#1e3a8a] text-white font-light rounded-none transition-all uppercase tracking-widest text-sm" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('onboarding.createBtn')}
                  </Button>
                </div>
              </div>
            )}
          </form>

          <div className="text-center">
            <p className="text-sm text-[#5a5b67] font-light">
              {t('onboarding.alreadyAccount')}{' '}
              <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-[#111111] font-light hover:font-medium hover:underline transition-all">
                {t('onboarding.loginBtn')}
              </a>
            </p>
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

      {/* RECOVERY KEY DIALOG */}
      <Dialog open={recoveryKey !== null} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-lg bg-[#faf9f4] border-[#c5c5d3]/30 rounded-none p-8 [&>button]:hidden shadow-2xl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-white border border-[#c5c5d3]/30 rounded-none flex items-center justify-center mb-4">
              <Key className="h-6 w-6 text-[#111111]" />
            </div>
            <DialogTitle className="text-center text-2xl font-light text-[#111111]">{t('onboarding.recoveryTitle')}</DialogTitle>
            <DialogDescription className="text-center font-light text-[#5a5b67] text-sm mt-2">
              {t('onboarding.recoveryDesc1')}
              <br />{t('onboarding.recoveryDesc2')}
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 p-4 bg-white border border-[#c5c5d3]/30 rounded-none text-center">
            <code className="text-lg font-mono text-[#111111] font-bold tracking-widest select-all">
              {recoveryKey}
            </code>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-none border-[#c5c5d3]/30 uppercase tracking-widest text-xs font-medium text-[#5a5b67] hover:bg-white hover:text-[#111111]" onClick={handleCopyRecoveryKey}>
              <Copy className="mr-2 h-4 w-4" /> {t('onboarding.copyBtn')}
            </Button>
            <Button variant="outline" className="flex-1 rounded-none border-[#c5c5d3]/30 uppercase tracking-widest text-xs font-medium text-[#5a5b67] hover:bg-white hover:text-[#111111]" onClick={() => {
              if (recoveryKey) {
                const blob = new Blob([`SIVARA RECOVERY KEY\n\n${recoveryKey}\n\nKeep this file safe.\nWithout this key, your documents will be lost if you forget your password.`], { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'sivara-recovery-key.txt';
                a.click();
              }
            }}>
              <ArrowRight className="mr-2 h-4 w-4" /> {t('onboarding.downloadBtn')}
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="p-4 bg-[#111111] rounded-none">
              <p className="text-[10px] text-white uppercase tracking-widest leading-relaxed opacity-90">{t('onboarding.recoveryWarning')}</p>
            </div>
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-bold text-[#2c2d38] uppercase tracking-widest">{t('onboarding.recoveryInput')}</Label>
              <Input
                placeholder={t('onboarding.recoveryPlaceholder')}
                value={recoveryTypedConfirm}
                onChange={(e) => setRecoveryTypedConfirm(e.target.value.toUpperCase())}
                className="h-12 bg-white border-[#c5c5d3]/30 focus:bg-white transition-all rounded-none shadow-sm focus:ring-[#111111] focus:border-[#111111] text-[#111111] text-center font-mono tracking-widest text-lg"
                maxLength={4}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              className="w-full h-12 bg-[#00236F] hover:bg-[#1e3a8a] text-white font-light rounded-none transition-all uppercase tracking-widest text-sm disabled:bg-[#c5c5d3]/50 disabled:text-[#5a5b67]/50"
              disabled={recoveryTypedConfirm !== recoveryKey?.substring(0, 4)}
              onClick={handleRecoveryAcknowledge}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t('onboarding.recoverySaveBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Onboarding;