import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Loader2, ArrowRight, Server, Sparkles, Globe, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';
import UserMenu from '@/components/UserMenu';

interface UserProfile {
  is_pro: boolean;
  has_used_trial: boolean;
  subscription_status: string;
  subscription_end_date: string | null;
}

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('is_pro, has_used_trial, subscription_status, subscription_end_date')
          .eq('id', user.id)
          .single();
        setProfile(data);
        setIsLoadingProfile(false);
      };
      fetchProfile();
    } else {
        setIsLoadingProfile(false);
    }
  }, [user]);

  const handleFreeAction = () => {
     if (!user) {
         navigate('/onboarding');
     } else {
         navigate('/profile');
     }
  };

  const handleProAction = () => {
    if (!user) {
        navigate('/onboarding?returnTo=/checkout?plan=monthly');
        return;
    }
    if (profile?.is_pro) {
        return; 
    }
    if (!profile?.has_used_trial) {
        navigate('/checkout?plan=monthly&trial=true');
        return;
    }
    navigate('/checkout?plan=monthly&trial=false');
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-blue-200 selection:text-black flex flex-col">
      <div className="bg-[#faf9f4] text-[#111111] flex flex-col antialiased relative font-sans flex-1">
        <style>{`
          .grid-bg-pattern {
              background-image: 
                  linear-gradient(to right, rgba(197, 197, 211, 0.4) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(197, 197, 211, 0.4) 1px, transparent 1px);
              background-size: 40px 40px;
          }
        `}</style>
        <div className="fixed inset-0 grid-bg-pattern opacity-50 z-0 pointer-events-none"></div>
        
        {/* TopNavBar */}
        <nav className="sticky top-0 z-50 bg-[#FAF9F4]/90 backdrop-blur-xl w-full border-b border-[#c5c5d3]/30">
          <div className="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
            {/* Brand */}
            <div className="flex items-center gap-6">
              <div onClick={() => navigate('/')} className="flex items-center gap-3 cursor-pointer transition-all active:scale-95">
                <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
                <span className="text-xl font-bold tracking-tighter text-[#111111]">Sivara</span>
              </div>
            </div>

            {/* Trailing Actions */}
            <div className="flex items-center gap-4 lg:gap-6">
               <UserMenu />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-screen-xl mx-auto px-6 md:px-12 py-16 flex flex-col gap-16 relative z-10">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
             <h1 className="text-4xl md:text-6xl font-light tracking-[-0.02em] text-[#111111] leading-tight">
               Choisissez l'espace qui vous correspond
             </h1>
             <p className="text-lg md:text-xl font-light text-[#5a5b67]">
               Une infrastructure souveraine adaptée à vos besoins. Aucun engagement, pas de trackers.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
            
            {/* Carte GRATUITE */}
            <div className="bg-white border border-[#c5c5d3]/30 rounded-2xl p-8 lg:p-12 shadow-sm flex flex-col">
               <div className="space-y-2 mb-8">
                  <h3 className="text-2xl font-semibold text-[#111111]">Sivara Libre</h3>
                  <p className="text-[#5a5b67] font-light">L'essentiel pour reprendre le contrôle.</p>
               </div>
               <div className="mb-8 font-light flex items-end gap-2">
                  <span className="text-5xl tracking-tight text-[#111111]">0$</span>
                  <span className="text-[#5a5b67] pb-1">/ mois</span>
               </div>
               <div className="flex-1">
                  <ul className="space-y-4 text-sm font-light text-[#2c2d38]">
                      <li className="flex gap-3"><Check className="text-green-500 w-5 h-5 flex-shrink-0" /> Moteur de recherche anonyme sans publicité</li>
                      <li className="flex gap-3"><Check className="text-green-500 w-5 h-5 flex-shrink-0" /> Boîte courriel sécurisée de base</li>
                      <li className="flex gap-3"><Check className="text-green-500 w-5 h-5 flex-shrink-0" /> Éditeur de documents avec chiffrement Zero-Knowledge</li>
                      <li className="flex gap-3"><Check className="text-green-500 w-5 h-5 flex-shrink-0" /> Hébergement souverain certifié au Québec</li>
                  </ul>
               </div>
               <div className="pt-8 mt-8 border-t border-[#c5c5d3]/20">
                  <Button 
                    onClick={handleFreeAction}
                    variant="outline"
                    className="w-full h-14 bg-transparent border-[#c5c5d3]/50 hover:bg-[#faf9f4] text-[#111111] font-medium text-lg rounded-xl transition-all shadow-none"
                  >
                    {!user ? "Créer un compte gratuit" : "Accéder à mon espace"}
                  </Button>
               </div>
            </div>

            {/* Carte PRO */}
            <div className="bg-[#00236F] border border-[#00236F] rounded-2xl p-8 lg:p-12 shadow-2xl flex flex-col relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                   <Server size={180} className="text-white bg-blend-overlay" />
               </div>
               
               <div className="relative z-10 space-y-2 mb-8">
                  <div className="inline-block px-3 py-1 mb-2 bg-blue-500/20 text-blue-200 border border-blue-400/30 rounded-full text-xs font-bold uppercase tracking-widest">
                     Recommandé
                  </div>
                  <h3 className="text-2xl font-semibold text-white">Sivara Pro</h3>
                  <p className="text-blue-100 font-light">La suite complète pour créateurs et professionnels.</p>
               </div>
               <div className="relative z-10 mb-8 font-light flex items-end gap-2">
                  <span className="text-5xl tracking-tight text-white">4.99$</span>
                  <span className="text-blue-200 pb-1">/ mois</span>
               </div>
               <div className="relative z-10 flex-1">
                  <ul className="space-y-4 text-sm font-light text-white">
                      <li className="flex gap-3 items-start"><Server className="text-blue-300 w-5 h-5 flex-shrink-0 mt-0.5" /> <span><strong className="font-semibold">30 GB d'espace NVMe.</strong> Sauvegardez tous vos documents et photos à très haute vitesse.</span></li>
                      <li className="flex gap-3 items-start"><Sparkles className="text-purple-300 w-5 h-5 flex-shrink-0 mt-0.5" /> <span><strong className="font-semibold">IA Générative intégrée.</strong> Utilisation de modèles d'IA souverains pour des buts génératifs et d'assistance sans limite.</span></li>
                      <li className="flex gap-3 items-start"><Globe className="text-cyan-300 w-5 h-5 flex-shrink-0 mt-0.5" /> <span><strong className="font-semibold">Nom de domaine personnalisé.</strong> (ex. contact@votrenom.com) avec gestion DNS automatique.</span></li>
                      <li className="flex gap-3 items-start"><Shield className="text-green-300 w-5 h-5 flex-shrink-0 mt-0.5" /> <span><strong className="font-semibold">Support VIP.</strong> Accès direct prioritaire à notre équipe pour migration ou configuration.</span></li>
                  </ul>
               </div>
               <div className="relative z-10 pt-8 mt-8 border-t border-blue-500/30">
                  <Button 
                    onClick={handleProAction}
                    disabled={isLoadingProfile}
                    className="w-full h-14 bg-white hover:bg-gray-100 text-[#00236F] font-semibold text-lg rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {isLoadingProfile ? <Loader2 className="animate-spin w-5 h-5" /> : (
                       profile?.is_pro ? "Déjà Abonné" : (
                          <span className="flex items-center justify-center gap-2">Passer à Pro <ArrowRight className="w-5 h-5" /></span>
                       )
                    )}
                  </Button>
               </div>
            </div>

          </div>

          {/* FAQ or Bottom Info */}
          <div className="text-center text-sm text-[#5a5b67] font-light mt-8">
             * Les 14 premiers jours sont gratuits pour tout nouvel abonnement Pro. Annulable en un clic.
          </div>

        </main>
      </div>
      <Footer />
    </div>
  );
};

export default Pricing;