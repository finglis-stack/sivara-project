import { User, LogOut, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface Profile {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

const UserMenu = () => {
  const { user, signOut: authSignOut } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Helpers pour générer les liens corrects (Prod vs Localhost)
  const getAccountUrl = (path: string) => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    
    if (isLocal) {
      return `/?app=account&path=${encodeURIComponent(path)}`; // Simulation locale
    }
    return `https://account.sivara.ca${path}`;
  };

  // En localhost, pour aller sur "login", on doit simuler le changement d'app
  const handleLoginClick = () => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const currentUrl = window.location.href; // URL de retour

    if (isLocal) {
      // On ajoute le paramètre de retour
      window.location.href = `/?app=account&path=/login&returnTo=${encodeURIComponent(currentUrl)}`;
    } else {
      window.location.href = `https://account.sivara.ca/login?returnTo=${encodeURIComponent(currentUrl)}`;
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', user.id)
          .single();

        setProfile(profileData);
      } else {
        setProfile(null);
      }
    };

    fetchProfile();

    // Subscription pour les changements de profil
    const channel = supabase
      .channel('profile_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user?.id}`,
      }, (payload) => {
        setProfile(payload.new as Profile);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    try {
      setIsSigningOut(true);
      await authSignOut();
      showSuccess('Déconnexion réussie');
    } catch (error: any) {
      console.error('Sign out error (handled):', error);
      // On considère que c'est réussi même en cas d'erreur technique
    } finally {
      setIsSigningOut(false);
      // Redirection forcée vers la page d'accueil ou de login
      window.location.href = '/';
    }
  };

  if (!user) {
    return (
      <Button
        onClick={handleLoginClick}
        className="flex items-center gap-2 px-4 py-2 rounded-none bg-[#00236F] hover:bg-[#1e3a8a] transition-all duration-300 text-white"
      >
        <User size={18} />
        <span className="text-sm font-light">{t('userMenu.login')}</span>
      </Button>
    );
  }

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return user.email;
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {profile?.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={getDisplayName()} />
            )}
            <AvatarFallback className="bg-gray-700 text-white">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-light leading-none">{getDisplayName()}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault();
            const currentUrl = window.location.href;
            // Redirection vers le sous-domaine account avec paramètre de retour
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                 window.location.href = `/?app=account&path=/profile&returnTo=${encodeURIComponent(currentUrl)}`;
            } else {
                window.location.href = `https://account.sivara.ca/profile?returnTo=${encodeURIComponent(currentUrl)}`;
            }
          }}
        >
          <UserCircle className="mr-2 h-4 w-4" />
          <span>{t('userMenu.profile')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault();
            handleSignOut();
          }}
          disabled={isSigningOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isSigningOut ? t('userMenu.loggingOut') : t('userMenu.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;