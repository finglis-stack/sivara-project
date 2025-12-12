import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { ArrowLeft, Loader2, User, Mail, Phone, Building2, Calendar, Grid3x3, Camera, X, ArrowRight, CreditCard, ExternalLink, RefreshCw, Globe, Laptop, Search, FileText } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Switch } from '@/components/ui/switch';

interface Profile {
  first_name: string;
  last_name: string;
  phone_country_code: string;
  phone_number: string;
  account_type: string;
  created_at: string;
  avatar_url: string | null;
  is_pro?: boolean;
  subscription_status?: string;
  subscription_end_date?: string | null;
  search_documents_enabled?: boolean;
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
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
    is_pro: false,
    search_documents_enabled: true,
  });

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      if (data) {
        // On s'assure que la valeur par défaut est true si null
        const searchEnabled = data.search_documents_enabled !== false;
        setProfile({ ...data, search_documents_enabled: searchEnabled });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      showError('Erreur lors du chargement du profil');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [user, navigate]);

  const handleSyncStripe = async () => {
    setIsSyncing(true);
    try {
        const { data, error } = await supabase.functions.invoke('stripe-api', {
            body: { action: 'sync_subscription' }
        });
        if (error) throw error;
        
        await fetchProfile();
        showSuccess("Statut abonnement synchronisé");
    } catch (e) {
        showError("Erreur de synchronisation");
    } finally {
        setIsSyncing(false);
    }
  };

  const handleReturn = () => {
    // 1. Logique Mobile (Capacitor)
    if (Capacitor.isNativePlatform()) {
      // Retour au Dashboard Mobile
      navigate('/?app=mobile');
      return;
    }

    // 2. Logique Web (Retour à l'app précédente)
    const returnTo = searchParams.get('returnTo');
    if (returnTo) {
      window.location.href = returnTo;
      return;
    }

    // 3. Fallback Web (Retour à l'accueil)
    window.location.href = 'https://sivara.ca';
  };

  const navigateToApp = (app: string) => {
     // Navigation intelligente selon l'environnement
     if (Capacitor.isNativePlatform()) {
        navigate(`/?app=${app}`);
        return;
     }

     const hostname = window.location.hostname;
     const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
     
     if (app === 'docs') {
         if (isLocal) window.location.href = '/?app=docs';
         else window.location.href = 'https://docs.sivara.ca';
     } else if (app === 'mail') {
         if (isLocal) window.location.href = '/?app=mail';
         else window.location.href = 'https://mail.sivara.ca';
     } else if (app === 'www') {
         if (isLocal) window.location.href = '/?app=www';
         else window.location.href = 'https://sivara.ca';
     } else if (app === 'device') {
         if (isLocal) window.location.href = '/?app=device';
         else window.location.href = 'https://device.sivara.ca';
     }
  };

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
          search_documents_enabled: profile.search_documents_enabled,
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

  const handleManageSubscription = async () => {
    setIsPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-api', {
        body: { action: 'create_portal' }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      showError("Impossible d'accéder au portail de facturation");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('Veuillez sélectionner une image'); return; }
    if (file.size > 5 * 1024 * 1024) { showError('L\'image ne doit pas dépasser 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => { setSelectedImage(e.target?.result as string); setImagePosition({ x: 0, y: 0 }); setShowAvatarDialog(true); };
    reader.readAsDataURL(file);
  };
  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y }); };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging || !imageRef.current) return; setImagePosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const handleMouseUp = () => { setIsDragging(false); };
  const handleValidateAvatar = async () => {
    if (!selectedImage || !user) return;
    try {
      setIsUploadingAvatar(true);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      const img = new Image();
      img.src = selectedImage;
      await new Promise((resolve) => { img.onload = resolve; });
      const size = 400; canvas.width = size; canvas.height = size;
      const scale = Math.max(size / img.width, size / img.height);
      const scaledWidth = img.width * scale; const scaledHeight = img.height * scale;
      const x = (size - scaledWidth) / 2 + imagePosition.x; const y = (size - scaledHeight) / 2 + imagePosition.y;
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      const blob = await new Promise<Blob>((resolve) => { canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9); });
      const fileName = `avatar-${Date.now()}.jpg`; const filePath = `${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (updateError) throw updateError;
      setProfile({ ...profile, avatar_url: publicUrl }); setShowAvatarDialog(false); setSelectedImage(null); showSuccess('Photo de profil mise à jour');
    } catch (error: any) { console.error('Error uploading avatar:', error); showError(error.message || 'Erreur lors de l\'upload de la photo'); } finally { setIsUploadingAvatar(false); }
  };

  const getInitials = () => {
    if (profile.first_name && profile.last_name) return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pt-[env(safe-area-inset-top)]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={handleReturn} className="text-gray-600 hover:text-gray-900 pl-0 sm:pl-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Retour à l'application</span>
                  <span className="sm:hidden">Retour</span>
              </Button>
              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
              <h1 className="text-lg sm:text-2xl font-light text-gray-900 hidden sm:block">Mon Profil</h1>
            </div>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-gray-700 hover:bg-gray-800 h-9 sm:h-10">{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : 'Enregistrer'}</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {!profile.is_pro ? (
            <div className="mb-6 sm:mb-8 relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg group">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" style={{ backgroundImage: 'url(/pro-banner.jpg)' }} />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-500" />
                <div className="relative z-10 p-6 sm:p-10 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight">Passez à <span className="font-semibold">Sivara Pro</span></h2>
                        <p className="text-sm sm:text-base md:text-lg font-light text-white/90 max-w-xl">Débloquez le stockage illimité et la personnalisation avancée. <br className="hidden md:block"/>Essai gratuit de 14 jours, puis 4.99$/mois.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                         <Button variant="ghost" size="icon" onClick={handleSyncStripe} disabled={isSyncing} className="text-white hover:bg-white/10">
                             <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
                         </Button>
                         <Button onClick={() => navigate('/pricing')} className="bg-white text-black hover:bg-gray-100 font-medium text-sm sm:text-base px-6 py-5 sm:px-8 sm:py-6 rounded-full shadow-xl transition-all hover:scale-105 hover:shadow-2xl border-0 flex-1 md:flex-none">Voir les offres <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" /></Button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="mb-6 sm:mb-8 bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 sm:h-14 sm:w-14 bg-gradient-to-tr from-yellow-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-xl sm:text-2xl font-bold text-white">S</span>
                   </div>
                   <div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">Abonnement Pro <span className="bg-green-500 text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full">Actif</span></h2>
                          <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button onClick={handleSyncStripe} disabled={isSyncing} className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-gray-50 rounded-full ml-1">
                                        <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Synchroniser le statut</p>
                                </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">
                          {profile.subscription_status === 'trialing' 
                            ? `Essai jusqu'au ${formatDate(profile.subscription_end_date!)}` 
                            : `Renouvellement le ${formatDate(profile.subscription_end_date!)}`
                          }
                      </p>
                   </div>
                </div>
                <Button 
                    variant="outline" 
                    onClick={handleManageSubscription} 
                    disabled={isPortalLoading}
                    className="gap-2 h-10 sm:h-12 px-4 sm:px-6 w-full md:w-auto text-sm sm:text-base"
                >
                    {isPortalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Gérer mon abonnement
                </Button>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            <div className="relative group shrink-0">
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
                {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.first_name} /> : <AvatarFallback className="bg-gray-700 text-white text-3xl sm:text-4xl">{getInitials()}</AvatarFallback>}
              </Avatar>
              <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="h-6 w-6 sm:h-8 sm:w-8 text-white" /></button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
            <div className="flex-1 text-center sm:text-left w-full">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 mb-1 justify-center sm:justify-start">
                <h2 className="text-2xl sm:text-3xl font-light text-gray-900 truncate max-w-full">{profile.first_name} {profile.last_name}</h2>
                {profile.is_pro && <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">PRO</span>}
              </div>
              <div className="space-y-2 mt-3 flex flex-col items-center sm:items-start">
                <div className="flex items-center gap-3 text-gray-600"><Mail className="h-4 w-4 sm:h-5 sm:w-5" /><span className="text-sm sm:text-lg truncate max-w-[250px] sm:max-w-md">{user?.email}</span></div>
                <div className="flex items-center gap-3 text-gray-600"><Calendar className="h-4 w-4 sm:h-5 sm:w-5" /><span className="text-sm sm:text-base">Membre depuis le {formatDate(profile.created_at)}</span></div>
                <div className="flex items-center gap-3 text-gray-600">{profile.account_type === 'individual' ? <><User className="h-4 w-4 sm:h-5 sm:w-5" /><span className="text-sm sm:text-base">Compte Individuel</span></> : <><Building2 className="h-4 w-4 sm:h-5 sm:w-5" /><span className="text-sm sm:text-base">Compte Entreprise</span></>}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <Grid3x3 className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
            <h2 className="text-xl sm:text-2xl font-light text-gray-900">Mes application(s)</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <button onClick={() => navigateToApp('docs')} className="group relative bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left active:scale-95">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <img src="/docs-icon.png" alt="Docs" className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                <div className="text-center w-full"><h3 className="text-xs sm:text-sm font-medium text-gray-900 truncate">Docs</h3></div>
              </div>
            </button>
            <button onClick={() => navigateToApp('mail')} className="group relative bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left active:scale-95">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <div className="text-center w-full"><h3 className="text-xs sm:text-sm font-medium text-gray-900 truncate">Mail</h3></div>
              </div>
            </button>
            <button onClick={() => navigateToApp('www')} className="group relative bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left active:scale-95">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                  <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
                <div className="text-center w-full"><h3 className="text-xs sm:text-sm font-medium text-gray-900 truncate">Moteur</h3></div>
              </div>
            </button>
            <button onClick={() => navigateToApp('device')} className="group relative bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left active:scale-95">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-zinc-50 rounded-xl flex items-center justify-center group-hover:bg-zinc-100 transition-colors">
                  <Laptop className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-900" />
                </div>
                <div className="text-center w-full"><h3 className="text-xs sm:text-sm font-medium text-gray-900 truncate">Book</h3></div>
              </div>
            </button>
          </div>
        </div>

        {/* NOUVELLE SECTION PREFERENCES */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <Search className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
                <h2 className="text-xl sm:text-2xl font-light text-gray-900">Préférences</h2>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="space-y-1">
                        <Label htmlFor="searchDocs" className="font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" /> Moteur de recherche
                        </Label>
                        <p className="text-xs text-gray-500 max-w-[250px] sm:max-w-md">
                            Autoriser le moteur de recherche Sivara à afficher vos documents personnels (chiffrés) dans les résultats.
                        </p>
                    </div>
                    <Switch 
                        id="searchDocs" 
                        checked={profile.search_documents_enabled} 
                        onCheckedChange={(checked) => setProfile({ ...profile, search_documents_enabled: checked })} 
                    />
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="px-5 sm:px-6"><CardTitle className="font-light text-lg sm:text-xl">Informations personnelles</CardTitle><CardDescription>Modifiez vos informations de profil</CardDescription></CardHeader>
            <CardContent className="space-y-4 sm:space-y-5 px-5 sm:px-6 pb-6">
              <div className="space-y-2"><Label htmlFor="firstName" className="text-sm font-medium">Prénom</Label><Input id="firstName" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} placeholder="Jean" className="h-10 sm:h-11" /></div>
              <div className="space-y-2"><Label htmlFor="lastName" className="text-sm font-medium">Nom</Label><Input id="lastName" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} placeholder="Dupont" className="h-10 sm:h-11" /></div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="px-5 sm:px-6"><CardTitle className="font-light text-lg sm:text-xl">Contact</CardTitle><CardDescription>Gérez vos informations de contact</CardDescription></CardHeader>
            <CardContent className="space-y-4 sm:space-y-5 px-5 sm:px-6 pb-6">
              <div className="space-y-2"><Label htmlFor="email" className="text-sm font-medium">Email</Label><Input id="email" type="email" value={user?.email || ''} disabled className="h-10 sm:h-11 bg-gray-50 text-gray-500" /><p className="text-xs text-gray-400">L'email ne peut pas être modifié</p></div>
              <div className="space-y-2"><Label htmlFor="phone" className="text-sm font-medium">Numéro de téléphone</Label><div className="flex gap-2"><Select value={profile.phone_country_code} onValueChange={(value) => setProfile({ ...profile, phone_country_code: value })}><SelectTrigger className="w-[110px] sm:w-[140px] h-10 sm:h-11 text-xs sm:text-sm"><SelectValue /></SelectTrigger><SelectContent>{countryCodes.map((country) => (<SelectItem key={country.code} value={country.code}><span>{country.flag} {country.code}</span></SelectItem>))}</SelectContent></Select><Input id="phone" type="tel" value={profile.phone_number} onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })} placeholder="6 12 34 56 78" className="flex-1 h-10 sm:h-11" /></div></div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="sm:max-w-[500px] max-w-[95vw]">
          <DialogHeader><DialogTitle>Ajuster votre photo</DialogTitle><DialogDescription>Déplacez l'image pour la centrer dans le cercle</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="relative w-full h-[300px] sm:h-[400px] bg-gray-100 rounded-lg overflow-hidden cursor-move touch-none" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={(e) => { setIsDragging(true); const touch = e.touches[0]; setDragStart({ x: touch.clientX - imagePosition.x, y: touch.clientY - imagePosition.y }); }} onTouchMove={(e) => { if (!isDragging) return; const touch = e.touches[0]; setImagePosition({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y }); }} onTouchEnd={() => setIsDragging(false)}>
              {selectedImage && (
                <>
                  <img ref={imageRef} src={selectedImage} alt="Preview" className="absolute select-none" style={{ transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`, maxWidth: 'none', height: '100%', width: 'auto', }} draggable={false} />
                  <div className="absolute inset-0 pointer-events-none"><svg width="100%" height="100%"><defs><mask id="circle-mask"><rect width="100%" height="100%" fill="white" /><circle cx="50%" cy="50%" r="140" fill="black" /></mask></defs><rect width="100%" height="100%" fill="black" opacity="0.5" mask="url(#circle-mask)" /><circle cx="50%" cy="50%" r="140" fill="none" stroke="white" strokeWidth="2" /></svg></div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setShowAvatarDialog(false); setSelectedImage(null); }}><X className="mr-2 h-4 w-4" />Annuler</Button><Button onClick={handleValidateAvatar} disabled={isUploadingAvatar} className="bg-gray-700 hover:bg-gray-800">{isUploadingAvatar ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Upload...</> : 'Valider'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;