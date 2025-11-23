import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { 
  Globe, FileText, Mail, UserCircle, LogOut, 
  Shield, Search, ArrowRight
} from 'lucide-react';

const MobileLanding = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ first_name: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, avatar_url')
          .eq('id', user.id)
          .single();
        setProfile(data);
      };
      fetchProfile();
    }
  }, [user]);

  // Navigation interne pour changer de "module" dans l'app hybride
  const openApp = (appName: string) => {
    window.location.href = `/?app=${appName}`;
  };

  const handleLogin = () => {
    // FORCE PRODUCTION URL : On utilise toujours le vrai serveur d'auth pour le deep link
    const baseUrl = 'https://account.sivara.ca';
    
    // Callback vers l'app native
    const callbackUrl = 'com.example.sivara://login-callback';
    
    // Redirection vers le navigateur système
    window.location.href = `${baseUrl}/login?returnTo=${encodeURIComponent(callbackUrl)}`;
  };

  // --- ÉCRAN NON CONNECTÉ (LANDING) ---
  if (!user) {
    return (
      <div className="min-h-screen relative flex flex-col justify-end pb-12 px-6 overflow-hidden">
        {/* Image de fond */}
        <div className="absolute inset-0 z-0">
           <img 
             src="/mobile-login.jpg" 
             alt="Background" 
             className="w-full h-full object-cover"
           />
           {/* Gradient overlay pour la lisibilité */}
           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90"></div>
        </div>

        {/* Contenu */}
        <div className="relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div>
            <h1 className="text-6xl font-thin text-white tracking-tighter mb-2 drop-shadow-lg">
              Sivara
            </h1>
            <div className="h-1 w-12 bg-white/50 rounded-full mb-6"></div>
            <p className="text-xl text-white/90 font-light leading-relaxed max-w-[80%] drop-shadow-md">
              Retrouvez la liberté. <br/>
              <span className="text-white/60">Vos données, vos règles.</span>
            </p>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={handleLogin}
              className="w-full h-16 text-lg bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-md rounded-2xl font-medium transition-all duration-300 active:scale-95 shadow-xl"
            >
              Se connecter
              <ArrowRight className="ml-2 h-5 w-5 opacity-70" />
            </Button>
            
            <p className="text-center text-white/40 text-xs font-light">
              Protégé par chiffrement de bout en bout.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- ÉCRAN CONNECTÉ (DASHBOARD) ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white px-6 pt-12 pb-6 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
        <div>
          <p className="text-gray-500 text-sm font-medium">Bonjour,</p>
          <h1 className="text-2xl font-bold text-gray-900">{profile?.first_name || user.email?.split('@')[0]}</h1>
        </div>
        <Avatar onClick={() => openApp('account')} className="cursor-pointer border-2 border-white shadow-sm h-10 w-10">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="bg-gray-900 text-white">{user.email?.substring(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </header>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        
        {/* Search Bar Fake */}
        <div onClick={() => openApp('www')} className="bg-white rounded-full shadow-sm border border-gray-200 p-4 flex items-center gap-3 cursor-pointer active:scale-95 transition-transform">
           <Search className="text-gray-400 w-5 h-5" />
           <span className="text-gray-400">Rechercher sur le web...</span>
        </div>

        {/* Apps Grid */}
        <div className="grid grid-cols-2 gap-4">
           <Card 
             onClick={() => openApp('mail')}
             className="p-5 flex flex-col justify-between h-36 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border-0 shadow-sm bg-gradient-to-br from-orange-50 to-white"
           >
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                 <Mail className="w-5 h-5" />
              </div>
              <div>
                 <h3 className="font-bold text-gray-900">Mail</h3>
                 <p className="text-xs text-gray-500">Boîte sécurisée</p>
              </div>
           </Card>

           <Card 
             onClick={() => openApp('docs')}
             className="p-5 flex flex-col justify-between h-36 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white"
           >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                 <FileText className="w-5 h-5" />
              </div>
              <div>
                 <h3 className="font-bold text-gray-900">Docs</h3>
                 <p className="text-xs text-gray-500">Espace de travail</p>
              </div>
           </Card>

           <Card 
             onClick={() => openApp('www')}
             className="p-5 flex flex-col justify-between h-36 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border-0 shadow-sm bg-gradient-to-br from-gray-50 to-white"
           >
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                 <Globe className="w-5 h-5" />
              </div>
              <div>
                 <h3 className="font-bold text-gray-900">Moteur</h3>
                 <p className="text-xs text-gray-500">Navigation privée</p>
              </div>
           </Card>

           <Card 
             onClick={() => openApp('account')}
             className="p-5 flex flex-col justify-between h-36 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white"
           >
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                 <UserCircle className="w-5 h-5" />
              </div>
              <div>
                 <h3 className="font-bold text-gray-900">Compte</h3>
                 <p className="text-xs text-gray-500">Paramètres & Pro</p>
              </div>
           </Card>
        </div>

        {/* Notifications / Status */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
           <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
              <Shield className="w-5 h-5" />
           </div>
           <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">Protection active</h4>
              <p className="text-xs text-gray-500">Vos données sont chiffrées localement.</p>
           </div>
        </div>

        {/* Logout */}
        <Button variant="ghost" onClick={() => signOut()} className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 h-12">
           <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
        </Button>
      </div>
    </div>
  );
};

export default MobileLanding;