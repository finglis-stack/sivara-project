import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { ArrowLeft, Loader2, User, Mail, Phone, Building2, Calendar, Grid3x3, Camera, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Profile {
  first_name: string;
  last_name: string;
  phone_country_code: string;
  phone_number: string;
  account_type: string;
  created_at: string;
  avatar_url: string | null;
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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [profile, setProfile] = useState<Profile>({
    first_name: '',
    last_name: '',
    phone_country_code: '+33',
    phone_number: '',
    account_type: 'individual',
    created_at: '',
    avatar_url: null,
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('L\'image ne doit pas dépasser 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setImagePosition({ x: 0, y: 0 });
      setShowAvatarDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - imagePosition.x,
      y: e.clientY - imagePosition.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    setImagePosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleValidateAvatar = async () => {
    if (!selectedImage || !user) return;

    try {
      setIsUploadingAvatar(true);

      // Créer un canvas pour recadrer l'image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const img = new Image();
      img.src = selectedImage;

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Taille du canvas (carré de 400x400)
      const size = 400;
      canvas.width = size;
      canvas.height = size;

      // Calculer le facteur de zoom pour remplir le cercle
      const scale = Math.max(size / img.width, size / img.height);

      // Dessiner l'image centrée et zoomée
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (size - scaledWidth) / 2 + imagePosition.x;
      const y = (size - scaledHeight) / 2 + imagePosition.y;

      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

      // Convertir en blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
      });

      // Upload vers Supabase Storage
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Mettre à jour le profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      setShowAvatarDialog(false);
      setSelectedImage(null);
      showSuccess('Photo de profil mise à jour');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      showError('Erreur lors de l\'upload de la photo');
    } finally {
      setIsUploadingAvatar(false);
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
            <div className="relative group">
              <Avatar className="h-32 w-32 flex-shrink-0">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile.first_name} />
                ) : (
                  <AvatarFallback className="bg-gray-700 text-white text-4xl">
                    {getInitials()}
                  </AvatarFallback>
                )}
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Camera className="h-8 w-8 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
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
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Carte Docs */}
            <button 
              onClick={() => navigate('/docs')}
              className="group relative bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <img src="/docs-icon.png" alt="Docs" className="h-7 w-7" />
                </div>
                <div className="text-center w-full">
                  <h3 className="text-sm font-medium text-gray-900 truncate">Docs</h3>
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

      {/* Dialog de recadrage d'avatar */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajuster votre photo</DialogTitle>
            <DialogDescription>
              Déplacez l'image pour la centrer dans le cercle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div 
              className="relative w-full h-[400px] bg-gray-100 rounded-lg overflow-hidden cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {selectedImage && (
                <>
                  <img
                    ref={imageRef}
                    src={selectedImage}
                    alt="Preview"
                    className="absolute select-none"
                    style={{
                      transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                      maxWidth: 'none',
                      height: '100%',
                      width: 'auto',
                    }}
                    draggable={false}
                  />
                  {/* Overlay avec cercle de découpe */}
                  <div className="absolute inset-0 pointer-events-none">
                    <svg width="100%" height="100%">
                      <defs>
                        <mask id="circle-mask">
                          <rect width="100%" height="100%" fill="white" />
                          <circle cx="50%" cy="50%" r="180" fill="black" />
                        </mask>
                      </defs>
                      <rect width="100%" height="100%" fill="black" opacity="0.5" mask="url(#circle-mask)" />
                      <circle cx="50%" cy="50%" r="180" fill="none" stroke="white" strokeWidth="2" />
                    </svg>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAvatarDialog(false);
                  setSelectedImage(null);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Annuler
              </Button>
              <Button
                onClick={handleValidateAvatar}
                disabled={isUploadingAvatar}
                className="bg-gray-700 hover:bg-gray-800"
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Upload...
                  </>
                ) : (
                  'Valider'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;