import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Building2, User, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

const countryCodes = [
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
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
    phoneCountryCode: '+33',
    phoneNumber: '',
    accountType: 'individual',
    termsAccepted: false,
    email: '',
    password: '',
  });

  // Fonction sécurisée pour rediriger (interne ou externe)
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

      // Créer le compte
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Créer le profil
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
        // On attend un peu pour que l'utilisateur voie le message
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
    <div className="min-h-screen relative flex items-center justify-center px-4 py-8">
      {/* Image de fond */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/auth-bg-v2.jpg)' }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      </div>

      {/* Contenu */}
      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">Sivara</h1>
          <p className="text-lg text-white/90 drop-shadow">Créez votre compte en quelques étapes</p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2">
            <div className={`h-2 w-24 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-white' : 'bg-white/30'}`}></div>
            <div className={`h-2 w-24 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-white' : 'bg-white/30'}`}></div>
          </div>
          <div className="text-center mt-3 text-sm text-white/90 drop-shadow">
            Étape {step} sur 2
          </div>
        </div>

        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold">
              {step === 1 ? 'Informations personnelles' : 'Créez vos identifiants'}
            </CardTitle>
            <CardDescription className="text-base">
              {step === 1 
                ? 'Commençons par quelques informations de base' 
                : 'Choisissez votre email et mot de passe'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 ? (
                <>
                  {/* Prénom et Nom */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-semibold">
                        Prénom <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="firstName"
                        placeholder="Jean"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="h-12 text-base"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-semibold">
                        Nom <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="lastName"
                        placeholder="Dupont"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="h-12 text-base"
                        required
                      />
                    </div>
                  </div>

                  {/* Numéro de téléphone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold">
                      Numéro de téléphone
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.phoneCountryCode}
                        onValueChange={(value) => setFormData({ ...formData, phoneCountryCode: value })}
                      >
                        <SelectTrigger className="w-[140px] h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countryCodes.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              <span className="flex items-center gap-2">
                                <span>{country.flag}</span>
                                <span>{country.code}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="6 12 34 56 78"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        className="flex-1 h-12 text-base"
                      />
                    </div>
                  </div>

                  {/* Type de compte */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      Type de compte <span className="text-red-500">*</span>
                    </Label>
                    <RadioGroup
                      value={formData.accountType}
                      onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <div>
                        <RadioGroupItem
                          value="individual"
                          id="individual"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="individual"
                          className="flex flex-col items-center justify-between rounded-xl border-2 border-gray-200 bg-white p-6 hover:bg-gray-50 peer-data-[state=checked]:border-gray-700 peer-data-[state=checked]:bg-gray-50 peer-data-[state=checked]:shadow-lg cursor-pointer transition-all"
                        >
                          <User className="mb-3 h-10 w-10 text-gray-700" />
                          <div className="text-center">
                            <div className="font-bold text-lg">Individuel</div>
                            <div className="text-sm text-gray-500 mt-1">
                              Pour un usage personnel
                            </div>
                          </div>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem
                          value="corporate"
                          id="corporate"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="corporate"
                          className="flex flex-col items-center justify-between rounded-xl border-2 border-gray-200 bg-white p-6 hover:bg-gray-50 peer-data-[state=checked]:border-gray-700 peer-data-[state=checked]:bg-gray-50 peer-data-[state=checked]:shadow-lg cursor-pointer transition-all"
                        >
                          <Building2 className="mb-3 h-10 w-10 text-gray-700" />
                          <div className="text-center">
                            <div className="font-bold text-lg">Entreprise</div>
                            <div className="text-sm text-gray-500 mt-1">
                              Pour un usage professionnel
                            </div>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Conditions d'utilisation */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="terms"
                        checked={formData.termsAccepted}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, termsAccepted: checked as boolean })
                        }
                        className="mt-1"
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="terms"
                          className="text-sm font-medium leading-relaxed cursor-pointer"
                        >
                          J'accepte les conditions d'utilisation{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          En cochant cette case, vous acceptez nos{' '}
                          <a href="#" className="text-gray-700 underline hover:text-gray-900 font-medium">
                            conditions d'utilisation
                          </a>{' '}
                          et notre{' '}
                          <a href="#" className="text-gray-700 underline hover:text-gray-900 font-medium">
                            politique de confidentialité
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bouton suivant */}
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full h-12 bg-gray-700 hover:bg-gray-800 text-base font-semibold"
                    disabled={!formData.termsAccepted}
                  >
                    Continuer
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </>
              ) : (
                <>
                  {/* Email et mot de passe */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold">
                        Adresse email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="jean.dupont@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="h-12 text-base"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-semibold">
                        Mot de passe <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Minimum 6 caractères"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="h-12 text-base"
                        required
                      />
                      <p className="text-xs text-gray-500">
                        Utilisez au moins 6 caractères avec un mélange de lettres et de chiffres
                      </p>
                    </div>
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      onClick={() => setStep(1)}
                      variant="outline"
                      className="flex-1 h-12 text-base font-semibold"
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
                          Création...
                        </>
                      ) : (
                        'Créer mon compte'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>

            {/* Lien de connexion */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Vous avez déjà un compte ?{' '}
                <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-gray-700 font-semibold hover:text-gray-900 underline">
                  Se connecter
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;