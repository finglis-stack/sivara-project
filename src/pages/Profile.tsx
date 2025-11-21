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
import { ArrowLeft, Loader2, User, Mail, Phone, Building2, Calendar, Grid3x3, FileText } from 'lucide-react';

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
      {/* Header fixe */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <div className="h-6 w-px bg-gray-200"></div>
              <h1 className="text-2xl font-light text-gray-900">Mon Profil</h1>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gray-700 hover:bg-gray-800"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Section Avatar et infos principales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start gap-8">
            <Avatar className="h-32 w-32 flex-shrink-0">
              <AvatarFallback className="bg-gray-700 text-white text-4xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-3xl font-light text-gray-900 mb-3">
                {profile.first_name} {profile.last_name}
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="h-5 w-5" />
                  <span className="text-lg">{user?.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Calendar className="h-5 w-5" />
                  <span>Membre depuis le {formatDate(profile.created_at)}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  {profile.account_type === 'individual' ? (
                    <>
                      <User className="h-5 w-5" />
                      <span>Compte Individuel</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-5 w-5" />
                      <span>Compte Entreprise</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Mes Applications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Grid3x3 className="h-6 w-6 text-gray-700" />
            <h2 className="text-2xl font-light text-gray-900">Mes application(s)</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Carte Docs */}
            <button className="group relative bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-md transition-all duration-300 text-left">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 bg-gray-100 rounded-2xl flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <FileText className="h-8 w-8 text-gray-700" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Docs</h3>
                  <p className="text-sm text-gray-500">Documentation</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Grille pour les informations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informations personnelles */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="font-light text-xl">Informations personnelles</CardTitle>
              <CardDescription>
                Modifiez vos informations de profil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium">Prénom</Label>
                <Input
                  id="firstName"
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  placeholder="Jean"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium">Nom</Label>
                <Input
                  id="lastName"
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  placeholder="Dupont"
                  className="h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="font-light text-xl">Contact</CardTitle>
              <CardDescription>
                Gérez vos informations de contact
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="h-11 bg-gray-50"
                />
                <p className="text-xs text-gray-500">L'email ne peut pas être modifié</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Numéro de téléphone</Label>
                <div className="flex gap-2">
                  <Select
                    value={profile.phone_country_code}
                    onValueChange={(value) => setProfile({ ...profile, phone_country_code: value })}
                  >
                    <SelectTrigger className="w-[140px] h-11">
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
                    className="flex-1 h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;