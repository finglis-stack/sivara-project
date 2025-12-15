import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Loader2, ArrowRight, Globe, Database, ShieldCheck, Zap, Layers, Sparkles, Star, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import Footer from '@/components/Footer';

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

  const handleAction = () => {
    if (!user) {
        navigate('/login?returnTo=/pricing');
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

  const getButtonContent = () => {
    if (isLoadingProfile) return <Loader2 className="animate-spin h-6 w-6" />;
    
    if (profile?.is_pro) {
        return (
            <span className="flex items-center gap-2">
                <Check className="h-5 w-5" /> Abonnement Actif
            </span>
        );
    }

    if (profile?.has_used_trial) {
        return "Réactiver mon abonnement";
    }

    return "Commencer l'essai gratuit";
  };

  const getExpirationText = () => {
      if (profile?.is_pro && profile?.subscription_end_date) {
          const date = new Date(profile.subscription_end_date).toLocaleDateString();
          return (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-green-400 bg-green-400/10 px-4 py-2 rounded-full inline-flex border border-green-400/20">
                <Clock className="w-4 h-4" />
                <span>Prochain renouvellement le {date}</span>
            </div>
          );
      }
      return null;
  };

  return (
    <div className="min-h-screen bg-white selection:bg-pink-500 selection:text-white flex flex-col" style={{ fontFamily: '"Inter", sans-serif' }}>
      
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-black/10 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/profile')}>
            <div className="h-8 w-8 sm:h-9 sm:w-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-white font-bold text-base sm:text-lg">S</span>
            </div>
            <span className="font-medium text-base sm:text-lg tracking-wide text-white drop-shadow-md">Sivara Pro</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/profile')}
              className="text-white hover:text-white hover:bg-white/20 font-medium tracking-wide rounded-full px-4 sm:px-6"
            >
              Retour
            </Button>
          </div>
        </div>
      </nav>

      <div className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-in fade-in duration-1000 scale-105"
          style={{ 
            backgroundImage: 'url(/pro-hero.jpg)',
            backgroundPosition: 'center center'
          }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto mt-10 sm:mt-0">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-6 sm:space-y-8 flex flex-col items-center">
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-medium shadow-lg mb-2">
              <span>L'expérience ultime</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-white drop-shadow-2xl leading-tight sm:leading-[1.1]">
              Le pouvoir de tout <br/>
              <span className="font-light text-white/90">accomplir.</span>
            </h1>
            
            <p className="text-lg sm:text-xl md:text-2xl text-white/90 font-light max-w-xl mx-auto leading-relaxed drop-shadow-lg px-2">
              Débloquez tout le potentiel de l'écosystème Sivara. Plus d'espace, 
              des outils exclusifs et une identité numérique unique.
            </p>

            <div className="pt-4 sm:pt-8 flex flex-col items-center justify-center gap-4 w-full px-4">
              <Button 
                onClick={handleAction}
                disabled={isLoadingProfile || profile?.is_pro}
                className={`h-14 sm:h-16 px-8 sm:px-12 text-base sm:text-lg rounded-full shadow-2xl transition-all duration-300 hover:-translate-y-1 font-bold group w-full sm:w-auto border-0 ${
                    profile?.is_pro 
                    ? 'bg-green-500 text-white hover:bg-green-500 cursor-default opacity-90' 
                    : 'bg-white text-black hover:bg-gray-100'
                }`}
              >
                {getButtonContent()}
                {!profile?.is_pro && !isLoadingProfile && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
              </Button>
              
              {getExpirationText()}
            </div>
            
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/50 hidden md:block">
              <ArrowRight className="h-6 w-6 rotate-90" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-16 sm:py-32 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-[300px] sm:w-[800px] h-[300px] sm:h-[800px] bg-purple-200/30 rounded-full blur-[80px] sm:blur-[120px] -translate-y-1/2 translate-x-1/4 pointer-events-none mix-blend-multiply"></div>
         <div className="absolute bottom-0 left-0 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-blue-200/30 rounded-full blur-[80px] sm:blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none mix-blend-multiply"></div>

         <div className="container mx-auto px-4 sm:px-6 relative z-10">
            
            <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-20">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 tracking-tight leading-tight">
                    L'excellence n'est pas une option.<br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">C'est un standard.</span>
                </h2>
                <p className="text-lg sm:text-xl text-gray-500 font-light leading-relaxed">
                    Sivara Pro transforme votre espace de travail en un centre de commande puissant. 
                    Une suite d'outils conçue pour ceux qui ne font pas de compromis.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 auto-rows-[minmax(auto,auto)]">
                
                <div className="md:col-span-2 bg-white rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-10 shadow-sm border border-gray-100 hover:shadow-2xl transition-all duration-500 group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-10 relative z-10 h-full">
                        <div className="flex-1 space-y-4 sm:space-y-6 w-full text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider">
                                <Globe className="w-3 h-3" /> Identité Pro
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Votre nom de domaine.<br/>Votre marque.</h3>
                            <p className="text-gray-500 leading-relaxed font-light text-sm sm:text-base">
                                Connectez votre propre domaine (ex: .com, .fr) et obtenez une adresse email professionnelle. 
                                Certificats SSL et configuration DNS gérés automatiquement.
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
                                <div className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs sm:text-sm font-mono text-gray-600 break-all">contact@votre-entreprise.com</div>
                            </div>
                        </div>
                        <div className="flex-1 w-full flex items-center justify-center">
                            <div className="relative w-full max-w-[280px] sm:max-w-xs aspect-[4/3] bg-gray-900 rounded-2xl shadow-2xl transform rotate-3 group-hover:rotate-0 group-hover:scale-105 transition-all duration-500 flex flex-col overflow-hidden">
                                <div className="bg-gray-800 p-3 flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                    </div>
                                    <div className="flex-1 bg-gray-900 rounded px-2 py-0.5 text-[10px] text-gray-400 text-center font-mono truncate">admin.votre-site.com</div>
                                </div>
                                <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 shadow-lg animate-pulse"></div>
                                    <div className="space-y-2 w-full px-4">
                                        <div className="h-2 bg-gray-700 rounded-full w-3/4 mx-auto"></div>
                                        <div className="h-2 bg-gray-800 rounded-full w-1/2 mx-auto"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md:row-span-2 bg-black rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden group text-white flex flex-col justify-between hover:-translate-y-2 transition-transform duration-500 min-h-[300px]">
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-800/50 to-black z-0"></div>
                    <div className="relative z-10">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 sm:mb-8 group-hover:rotate-12 transition-transform duration-500">
                            <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <h3 className="text-3xl sm:text-4xl font-bold mb-2">Illimité</h3>
                        <p className="text-gray-400 font-light leading-relaxed text-sm sm:text-base">
                            Un espace colossal pour vos projets les plus ambitieux. Photos RAW, vidéos 4K, archives... tout tient.
                        </p>
                    </div>
                    <div className="relative z-10 mt-8 sm:mt-10">
                         <div className="flex justify-between text-sm font-medium mb-3 text-gray-300">
                            <span>Utilisation</span>
                            <span>Illimité</span>
                         </div>
                         <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 w-[15%] group-hover:w-[85%] transition-all duration-1000 ease-out rounded-full shadow-[0_0_20px_rgba(168,85,247,0.5)]"></div>
                         </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 min-h-[250px]">
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-1/3 -translate-y-1/3 transition-transform duration-500 group-hover:scale-125">
                        <Layers size={120} />
                    </div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-wider mb-4">
                                <Zap className="w-3 h-3" /> Illimité
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold mb-2">Suite Apps Pro</h3>
                            <p className="text-purple-100 text-sm leading-relaxed font-light">
                                Accès prioritaire aux nouvelles fonctionnalités et outils exclusifs pour créateurs.
                            </p>
                        </div>
                        <div className="flex -space-x-3 mt-6">
                             {[1,2,3].map((i) => (
                                <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-indigo-600 bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg">
                                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                                </div>
                             ))}
                             <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-indigo-600 bg-white text-indigo-700 flex items-center justify-center font-bold shadow-lg z-10 text-xs sm:text-sm">+</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100 group hover:shadow-xl transition-all duration-300 flex flex-col justify-center min-h-[200px]">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-50 rounded-xl group-hover:scale-110 transition-transform duration-300">
                            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Support VIP</h3>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed font-light">
                        Une équipe dédiée disponible 24/7 pour vous aider à configurer votre domaine et migrer vos données.
                    </p>
                </div>

            </div>
         </div>
      </div>

      <div className="py-20 sm:py-32 bg-gray-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
          <div className="absolute top-0 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-500/20 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-0 right-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-500/20 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none"></div>
          
          <div className="container mx-auto px-6 relative z-10 text-center">
              <div className="inline-block mb-4 sm:mb-6 animate-pulse">
                  <Star className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 fill-current" />
              </div>
              
              <h2 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight mb-6 sm:mb-8 leading-tight">
                  Prêt à marquer <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">l'histoire ?</span>
              </h2>
              
              <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8 sm:mb-12 font-light px-4">
                  Rejoignez les créateurs, entrepreneurs et visionnaires qui ont choisi Sivara Pro pour construire leur empire numérique.
              </p>
              
              <div className="flex flex-col items-center gap-6">
                  <Button 
                    onClick={handleAction}
                    disabled={isLoadingProfile || profile?.is_pro}
                    className={`h-16 sm:h-20 px-8 sm:px-12 text-lg sm:text-xl rounded-full shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] transition-all duration-300 hover:scale-105 font-bold border-0 group w-full sm:w-auto ${
                        profile?.is_pro 
                        ? 'bg-green-500 text-white hover:bg-green-500 cursor-default opacity-90' 
                        : 'bg-white text-black hover:bg-gray-100'
                    }`}
                  >
                    {getButtonContent()}
                    {!profile?.is_pro && !isLoadingProfile && <ArrowRight className="ml-3 w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform" />}
                  </Button>
                  
                  {getExpirationText()}

                  {!profile?.is_pro && (
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-sm font-medium text-gray-500">
                        <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 14 jours offerts</span>
                        <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Annulation sans frais</span>
                    </div>
                  )}
              </div>
          </div>
      </div>
      <Footer />
    </div>
  );
};

export default Pricing;