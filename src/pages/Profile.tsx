import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { ArrowLeft, Loader2, User, Mail, Phone, Building2, Calendar } from 'lucide-react';

interface Profile {
  first_name: string;
  last_name: string;
  phone_country_code: string;
  phone_number: string;
  account_type: string;
  created_at: string;
}

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

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    first_name: '',
    last_name: '',
    phone_country_code: '+33',
    phone_number: '',
    account_type: 'individual',
    created_at: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setProfile(data);
        }
      } catch (error: any) {
        console.error('Error fetching profile:', error);
        showError('Erreur lors du chargement du profil');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, navigate]);

  const handleSave = async () => {
    if (!user) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone_country_code: profile.phone_country_code,
          phone_number: profile.phone_number,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      showSuccess('Profil mis à jour avec succès');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showError('Erreur lors de la mise à jour du profil');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = () => {
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à l'accueil
          </Button>
          <h1 className="text-3xl font-light text-gray-900">Mon Profil</h1>
          <p className="text-gray-500 mt-2">Gérez vos informations personnelles</p>
        </div>

        <div className="space-y-6">
          {/* Avatar & Email Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="bg-gray-700 text-white text-2xl">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-light text-gray-900">
                    {profile.first_name} {profile.last_name}
                  </h2>
                  <div className="flex items-center gap-2 text-gray-500 mt-2">
                    <Mail className="h-4 w-4" />
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 mt-1">
                    <Calendar className="h-4 w-4" />
                    <span>Membre depuis le {formatDate(profile.created_at)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle className="font-light">Informations personnelles</CardTitle>
              <CardDescription>
                Modifiez vos informations de profil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    placeholder="Jean"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <div className="flex gap-2">
                  <Select
                    value={profile.phone_country_code}
                    onValueChange={(value) => setProfile({ ...profile, phone_country_code: value })}
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
                    value={profile.phone_number}
                    onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                    placeholder="6 12 34 56 78"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full md:w-auto bg-gray-700 hover:bg-gray-800"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer les modifications'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Type de compte */}
          <Card>
            <CardHeader>
              <CardTitle className="font-light">Type de compte</CardTitle>
              <CardDescription>
                Informations sur votre type de compte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                {profile.account_type === 'individual' ? (
                  <>
                    <User className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Compte Individuel</p>
                      <p className="text-sm text-gray-500">Pour un usage personnel</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Building2 className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Compte Entreprise</p>
                      <p className="text-sm text-gray-500">Pour un usage professionnel</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;