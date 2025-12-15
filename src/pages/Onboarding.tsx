import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Building2, User, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Shield } from 'lucide-react';

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
  
  const returnTo = searchParams.get('returnTo') || '/';

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
          });

        if (profileError) throw profileError;

        showSuccess('Compte créé avec succès !');
        setTimeout(() => {
          handleRedirect(returnTo);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error creating account:', error);
      showError(error.message || 'Erreur lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-gray-100">
      
      {/* GAUCHE : FORMULAIRE */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-24 flex flex-col justify-center border-r border-gray-100">
        <div className="max-w-md mx-auto w-full space-y-8">
          
          {/* Header */}
          <div className="space-y-6">
             <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
                <img src="/sivara-logo.png" alt="Sivara" className="h-10 w-10 object-contain" />
                <span className="text-xl font-bold tracking-tight text-gray-900">Sivara</span>
             </div>
             
             <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Créer un compte</h1>
                <p className="text-gray-500 text-sm font-light">Rejoignez l'écosystème numérique souverain.</p>
             </div>

             {/* Stepper */}
             <div className="flex items-center gap-2">
                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-gray-900' : 'bg-gray-100'}`}></div>
                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-gray-900' : 'bg-gray-100'}`}></div>
             </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {step === 1 ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-xs font-medium text-gray-700 uppercase tracking-wide">Prénom</Label>
                    <Input id="firstName" placeholder="Jean" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-xs font-medium text-gray-700 uppercase tracking-wide">Nom</Label>
                    <Input id="lastName" placeholder="Dupont" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-medium text-gray-700 uppercase tracking-wide">Téléphone</Label>
                  <div className="flex gap-2">
                    <Select value={formData.phoneCountryCode} onValueChange={(value) => setFormData({ ...formData, phoneCountryCode: value })}>
                      <SelectTrigger className="w-[110px] h-12 bg-gray-50 border-gray-200"><SelectValue /></SelectTrigger>
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
                    <Input id="phone" type="tel" placeholder="514 123 4567" value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} className="flex-1 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all" />
                  </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Type de compte</Label>
                    <RadioGroup value={formData.accountType} onValueChange={(value) => setFormData({ ...formData, accountType: value })} className="grid grid-cols-2 gap-4">
                      <Label htmlFor="individual" className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.accountType === 'individual' ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                          <RadioGroupItem value="individual" id="individual" className="sr-only" />
                          <User className={`h-6 w-6 mb-2 ${formData.accountType === 'individual' ? 'text-gray-900' : 'text-gray-400'}`} />
                          <span className="text-sm font-medium">Personnel</span>
                      </Label>
                      <Label htmlFor="corporate" className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.accountType === 'corporate' ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                          <RadioGroupItem value="corporate" id="corporate" className="sr-only" />
                          <Building2 className={`h-6 w-6 mb-2 ${formData.accountType === 'corporate' ? 'text-gray-900' : 'text-gray-400'}`} />
                          <span className="text-sm font-medium">Entreprise</span>
                      </Label>
                    </RadioGroup>
                </div>

                <div className="flex items-start space-x-3 pt-2">
                    <Checkbox id="terms" checked={formData.termsAccepted} onCheckedChange={(checked) => setFormData({ ...formData, termsAccepted: checked as boolean })} className="mt-1" />
                    <label htmlFor="terms" className="text-sm text-gray-500 leading-relaxed cursor-pointer">
                        J'accepte les <a href="https://help.sivara.ca/article/conditions-dutilisation" className="text-gray-900 underline">Conditions d'utilisation</a> et la <a href="https://help.sivara.ca/article/politique-de-confidentialit" className="text-gray-900 underline">Politique de confidentialité</a>.
                    </label>
                </div>

                <Button type="button" onClick={handleNextStep} className="w-full h-12 bg-gray-900 hover:bg-black text-white font-medium rounded-lg transition-all" disabled={!formData.termsAccepted}>
                    Suivant <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-gray-700 uppercase tracking-wide">Email de connexion</Label>
                  <Input id="email" type="email" placeholder="jean@exemple.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium text-gray-700 uppercase tracking-wide">Mot de passe</Label>
                  <Input id="password" type="password" placeholder="Minimum 6 caractères" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all" required />
                  <p className="text-xs text-gray-400">Utilisez un mot de passe fort et unique.</p>
                </div>

                <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-12 px-6 border-gray-200 text-gray-600 hover:bg-gray-50">Retour</Button>
                    <Button type="submit" className="flex-1 h-12 bg-gray-900 hover:bg-black text-white font-medium rounded-lg transition-all" disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Créer mon compte'}
                    </Button>
                </div>
              </div>
            )}
          </form>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Déjà inscrit ?{' '}
              <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-gray-900 hover:underline">
                Se connecter
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* DROITE : VISUEL (FOND CLAIR) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-50 items-center justify-center p-12 relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
         
         <div className="relative z-10 max-w-md w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            <div className="bg-white p-2 rounded-2xl shadow-2xl mb-10 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <img src="/device-hero-new.jpg" alt="Sivara Ecosystem" className="rounded-xl w-full h-auto object-cover" />
            </div>

            <div className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-blue-50 text-blue-600 rounded-lg"><Shield className="h-5 w-5" /></div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Souveraineté Numérique</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mt-1">Reprenez le contrôle total de vos données. Pas de tracking, pas de revente.</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle2 className="h-5 w-5" /></div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Tout inclus</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mt-1">Email, Cloud, Docs et Identité dans un seul abonnement transparent.</p>
                    </div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Onboarding;