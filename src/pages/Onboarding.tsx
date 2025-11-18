import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Building2, User, Loader2 } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneCountryCode: '+33',
    phoneNumber: '',
    accountType: 'individual',
    termsAccepted: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.termsAccepted) {
      showError('Vous devez accepter les conditions d\'utilisation');
      return;
    }

    if (!formData.firstName || !formData.lastName) {
      showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        showError('Utilisateur non connecté');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone_country_code: formData.phoneCountryCode,
          phone_number: formData.phoneNumber,
          account_type: formData.accountType,
          terms_accepted: formData.termsAccepted,
          terms_accepted_at: new Date().toISOString(),
        });

      if (error) throw error;

      showSuccess('Profil créé avec succès !');
      navigate('/');
    } catch (error) {
      console.error('Error creating profile:', error);
      showError('Erreur lors de la création du profil');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-700 mb-2">Bienvenue sur Sivara</h1>
          <p className="text-gray-500">Complétez votre profil pour continuer</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Ces informations nous aident à personnaliser votre expérience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Prénom et Nom */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    Prénom <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="Jean"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Nom <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Dupont"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Numéro de téléphone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.phoneCountryCode}
                    onValueChange={(value) => setFormData({ ...formData, phoneCountryCode: value })}
                  >
                    <SelectTrigger className="w-[140px]">
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
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Type de compte */}
              <div className="space-y-3">
                <Label>
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
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-6 hover:bg-gray-50 peer-data-[state=checked]:border-gray-700 peer-data-[state=checked]:bg-gray-50 cursor-pointer transition-all"
                    >
                      <User className="mb-3 h-8 w-8 text-gray-600" />
                      <div className="text-center">
                        <div className="font-semibold">Individuel</div>
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
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-6 hover:bg-gray-50 peer-data-[state=checked]:border-gray-700 peer-data-[state=checked]:bg-gray-50 cursor-pointer transition-all"
                    >
                      <Building2 className="mb-3 h-8 w-8 text-gray-600" />
                      <div className="text-center">
                        <div className="font-semibold">Entreprise</div>
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
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="terms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      J'accepte les conditions d'utilisation{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm text-gray-500">
                      En cochant cette case, vous acceptez nos{' '}
                      <a href="#" className="text-gray-700 underline hover:text-gray-900">
                        conditions d'utilisation
                      </a>{' '}
                      et notre{' '}
                      <a href="#" className="text-gray-700 underline hover:text-gray-900">
                        politique de confidentialité
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>

              {/* Bouton de soumission */}
              <Button
                type="submit"
                className="w-full bg-gray-700 hover:bg-gray-800"
                disabled={isLoading || !formData.termsAccepted}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création du profil...
                  </>
                ) : (
                  'Continuer'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;