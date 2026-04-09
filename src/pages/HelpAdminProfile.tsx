import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, Loader2, ShieldAlert, Clock,
  FileText, Folder, Calendar, User, Building2,
  MessageSquare, CheckCircle2, PauseCircle
} from 'lucide-react';

interface FullProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone_country_code: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  is_pro: boolean;
  account_type: string;
  created_at: string;
  updated_at: string;
  subscription_status: string | null;
  subscription_end_date: string | null;
}

interface TicketSummary {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  last_message_at: string;
}

interface CloudStats {
  fileCount: number;
  folderCount: number;
}

const HelpAdminProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [cloudStats, setCloudStats] = useState<CloudStats>({ fileCount: 0, folderCount: 0 });
  const [accessTime] = useState(new Date());

  // Security: Verify staff access
  useEffect(() => {
    const verify = async () => {
      if (!user || !userId) {
        navigate('/');
        return;
      }

      try {
        const { data: staffProfile, error } = await supabase
          .from('profiles')
          .select('is_staff')
          .eq('id', user.id)
          .single();

        if (error || !staffProfile?.is_staff) {
          navigate('/');
          return;
        }

        setIsAuthorized(true);
        await loadProfile();
      } catch {
        navigate('/');
      } finally {
        setIsChecking(false);
      }
    };

    if (!loading) {
      if (user) verify();
      else navigate('/');
    }
  }, [user, loading, userId, navigate]);

  const loadProfile = async () => {
    if (!userId) return;

    // Fetch full profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileData) setProfile(profileData as any);

    // Fetch user's email from auth (fallback)
    // Profile email might not be set, we also need the auth email
    // We'll display what we have from profiles

    // Fetch tickets  
    const { data: ticketData } = await supabase
      .from('support_tickets')
      .select('id, subject, status, created_at, last_message_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    setTickets(ticketData || []);

    // Fetch cloud stats
    const { count: fileCount } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('type', 'file');

    const { count: folderCount } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('type', 'folder');

    setCloudStats({ fileCount: fileCount || 0, folderCount: folderCount || 0 });
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'open': return { label: 'Ouvert', color: 'bg-emerald-50 text-emerald-700' };
      case 'closed': return { label: 'Résolu', color: 'bg-gray-100 text-gray-500' };
      case 'suspended': return { label: 'Suspendu', color: 'bg-amber-50 text-amber-700' };
      default: return { label: status, color: 'bg-gray-100 text-gray-500' };
    }
  };

  if (loading || isChecking) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!isAuthorized || !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Accès non autorisé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>


      {/* NAV */}
      <div className="bg-white border-b border-gray-200/80">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-light">Retour au support</span>
          </button>
          <span className="text-[10px] font-mono text-gray-300 uppercase tracking-widest">
            ID {userId?.substring(0, 12)}...
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">

          {/* PROFILE HEADER */}
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden mb-8">
            <div className="p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                <div className="relative shrink-0">
                  <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-2 border-gray-100">
                    {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="bg-gray-100 text-gray-400 text-2xl font-light">
                      {profile.first_name?.[0] || '?'}{profile.last_name?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  {profile.is_pro && (
                    <div className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full border-2 border-white tracking-wider">
                      PRO
                    </div>
                  )}
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h1 className="text-3xl sm:text-4xl font-extralight text-gray-900 tracking-tight leading-tight">
                    {profile.first_name || '—'} {profile.last_name || ''}
                  </h1>
                  <p className="text-sm font-light text-gray-400 mt-2">{profile.email}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-4 justify-center sm:justify-start">
                    <Badge variant="outline" className="text-[10px] h-6 px-3 font-normal border-gray-200 text-gray-500 capitalize">
                      {profile.account_type === 'individual' ? 'Individuel' : 'Entreprise'}
                    </Badge>
                    {profile.is_pro && (
                      <Badge className="text-[10px] h-6 px-3 bg-gray-900 text-white hover:bg-gray-900 font-normal">
                        Sivara Pro {profile.subscription_status === 'trialing' ? '(Essai)' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* INFO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

            {/* COORDONNÉES */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 sm:p-8">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-6">Coordonnées</h2>
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] text-gray-300 font-light uppercase tracking-wider mb-1">Email</p>
                  <p className="text-sm font-light text-gray-900">{profile.email}</p>
                </div>
                <Separator className="bg-gray-100" />
                <div>
                  <p className="text-[11px] text-gray-300 font-light uppercase tracking-wider mb-1">Téléphone</p>
                  <p className="text-sm font-light text-gray-900">
                    {profile.phone_number
                      ? `${profile.phone_country_code || '+1'} ${profile.phone_number}`
                      : '—'}
                  </p>
                </div>
                <Separator className="bg-gray-100" />
                <div>
                  <p className="text-[11px] text-gray-300 font-light uppercase tracking-wider mb-1">Type de compte</p>
                  <div className="flex items-center gap-2 text-sm font-light text-gray-900">
                    {profile.account_type === 'individual'
                      ? <><User className="h-3.5 w-3.5 text-gray-400" /> Individuel</>
                      : <><Building2 className="h-3.5 w-3.5 text-gray-400" /> Entreprise</>
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* COMPTE */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 sm:p-8">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-6">Compte</h2>
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] text-gray-300 font-light uppercase tracking-wider mb-1">Membre depuis</p>
                  <p className="text-sm font-light text-gray-900 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {formatDate(profile.created_at)}
                  </p>
                </div>
                <Separator className="bg-gray-100" />
                <div>
                  <p className="text-[11px] text-gray-300 font-light uppercase tracking-wider mb-1">Statut abonnement</p>
                  <p className="text-sm font-light text-gray-900">
                    {profile.is_pro
                      ? profile.subscription_status === 'trialing' ? 'En essai' : 'Actif'
                      : 'Gratuit'}
                  </p>
                </div>
                {profile.is_pro && profile.subscription_end_date && (
                  <>
                    <Separator className="bg-gray-100" />
                    <div>
                      <p className="text-[11px] text-gray-300 font-light uppercase tracking-wider mb-1">
                        {profile.subscription_status === 'trialing' ? "Fin de l'essai" : 'Renouvellement'}
                      </p>
                      <p className="text-sm font-light text-gray-900">{formatDate(profile.subscription_end_date)}</p>
                    </div>
                  </>
                )}
                <Separator className="bg-gray-100" />
                <div>
                  <p className="text-[11px] text-gray-300 font-light uppercase tracking-wider mb-1">Dernière mise à jour profil</p>
                  <p className="text-sm font-light text-gray-900">{formatDateTime(profile.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* SIVARA CLOUD */}
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 sm:p-8 mb-8">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-6">Sivara Cloud</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#FAFAFA] rounded-lg p-5 text-center border border-gray-100">
                <p className="text-3xl font-extralight text-gray-900">{cloudStats.fileCount}</p>
                <p className="text-[11px] text-gray-400 mt-1 font-light flex items-center justify-center gap-1.5">
                  <FileText className="h-3 w-3" /> Fichiers
                </p>
              </div>
              <div className="bg-[#FAFAFA] rounded-lg p-5 text-center border border-gray-100">
                <p className="text-3xl font-extralight text-gray-900">{cloudStats.folderCount}</p>
                <p className="text-[11px] text-gray-400 mt-1 font-light flex items-center justify-center gap-1.5">
                  <Folder className="h-3 w-3" /> Dossiers
                </p>
              </div>
              <div className="bg-[#FAFAFA] rounded-lg p-5 text-center border border-gray-100">
                <p className="text-3xl font-extralight text-gray-900">{tickets.length}</p>
                <p className="text-[11px] text-gray-400 mt-1 font-light flex items-center justify-center gap-1.5">
                  <MessageSquare className="h-3 w-3" /> Tickets
                </p>
              </div>
              <div className="bg-[#FAFAFA] rounded-lg p-5 text-center border border-gray-100">
                <p className="text-3xl font-extralight text-gray-900">
                  {tickets.filter(t => t.status === 'open').length}
                </p>
                <p className="text-[11px] text-gray-400 mt-1 font-light flex items-center justify-center gap-1.5">
                  <Clock className="h-3 w-3" /> Ouverts
                </p>
              </div>
            </div>
          </div>

          {/* TICKET HISTORY */}
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden mb-8">
            <div className="p-6 sm:p-8 pb-0 sm:pb-0">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-6">Historique des demandes</h2>
            </div>
            {tickets.length === 0 ? (
              <div className="px-8 pb-8">
                <p className="text-sm font-light text-gray-300">Aucun ticket</p>
              </div>
            ) : (
              <div>
                {tickets.map((t, i) => {
                  const status = getStatusConfig(t.status);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between px-6 sm:px-8 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer ${
                        i < tickets.length - 1 ? 'border-b border-gray-50' : ''
                      }`}
                      onClick={() => navigate('/admin')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-light text-gray-900 truncate">{t.subject}</p>
                        <p className="text-[11px] text-gray-300 font-light mt-1">
                          Créé le {formatDate(t.created_at)} • Dernière activité {formatDateTime(t.last_message_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] h-5 px-2 font-normal border-0 shrink-0 ml-4 ${status.color}`}>
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


        </div>
      </ScrollArea>
    </div>
  );
};

export default HelpAdminProfile;
