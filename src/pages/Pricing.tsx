import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, ArrowLeft, Loader2, ArrowRight, Globe, Mail, Database, ShieldCheck, Zap, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) {
        navigate('/login?returnTo=/pricing');
        return;
    }

    try {
        setIsLoading(true);
        // Simulation d'un processus de paiement
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const { error } = await supabase
            .from('profiles')
            .update({ is_pro: true })
            .eq('id', user.id);

        if (error) throw error;

        showSuccess('Bienvenue dans Sivara Pro !');
        navigate('/profile');
    } catch (e) {
        showError('Erreur lors de l\'activation');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Navbar Transparente */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/10 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/profile')}>
            <div className="h-10 w-10 bg-gradient-to-br from-pink-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-semibold text-lg tracking-wide text-white drop-shadow-md">Sivara Pro</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/profile')}
              className="text-white hover:text-white hover:bg-white/20 font-medium tracking-wide rounded-full px-6"
            >
              Retour
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section Immersive */}
      <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
        {/* Image de fond */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-in fade-in duration-1000 scale-105"
          style={{ 
            backgroundImage: 'url(/pro-hero.jpg)',
            backgroundPosition: 'center center'
          }}
        >
          {/* Dégradé dynamique pour plus de vie */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white"></div>
        </div>

        {/* Contenu Hero */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto pt-20">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-8 flex flex-col items-center">
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-medium shadow-xl mb-4">
              <Zap className="w-4 h-4 text-yellow-300 fill-current" />
              <span>Passez à la vitesse supérieure</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white drop-shadow-2xl leading-[1.1]">
              Votre travail mérite <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-200 via-white to-violet-200">l'exceptionnel.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 font-medium max-w-2xl mx-auto leading-relaxed drop-shadow-lg text-shadow">
              Domaine personnalisé, stockage massif et outils exclusifs.
              <br className="hidden md:block"/> L'abonnement tout-en-un pour les créateurs et les pros.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              <Button 
                onClick={handleSubscribe}
                disabled={isLoading}
                className="h-16 px-12 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white text-lg rounded-full shadow-2xl transition-all duration-300 hover:-translate-y-1 font-bold group w-full sm:w-auto border-0"
              >
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                Essayer gratuitement 14 jours
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <p className="text-white/80 text-sm font-medium drop-shadow">Puis 4.99$/mois. Sans engagement.</p>
          </div>
        </div>
      </div>

      {/* Section Features Dynamique */}
      <div className="py-32 bg-white relative overflow-hidden">
        {/* Cercles décoratifs d'arrière-plan */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-pink-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-violet-50 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 opacity-50 pointer-events-none"></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-6xl mx-auto space-y-32">
            
            {/* Feature 1: Email Pro */}
            <div className="flex flex-col md:flex-row items-center gap-16 group">
                <div className="flex-1 space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-violet-100 text-violet-700 text-sm font-bold uppercase tracking-wider">
                        Identité
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                        Votre marque,<br/>votre domaine.
                    </h2>
                    <p className="text-xl text-gray-500 leading-relaxed">
                        Ne faites plus la promotion des autres. Utilisez votre propre nom de domaine pour vos emails et vos liens de partage.
                        Connectez n'importe quel domaine que vous possédez en quelques clics.
                    </p>
                    <ul className="space-y-4">
                        <li className="flex items-center gap-3 text-gray-700 font-medium">
                            <Check className="h-5 w-5 text-violet-600" />
                            <span>Adresse personnalisée (ex: contact@votre-entreprise.com)</span>
                        </li>
                        <li className="flex items-center gap-3 text-gray-700 font-medium">
                            <Check className="h-5 w-5 text-violet-600" />
                            <span>Certificats SSL automatiques inclus</span>
                        </li>
                    </ul>
                </div>
                <div className="flex-1 flex justify-center w-full">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 transform transition-all duration-500 group-hover:scale-105 group-hover:rotate-1">
                        <div className="flex items-center gap-4 mb-6 border-b border-gray-50 pb-4">
                             <div className="h-3 w-3 rounded-full bg-red-400"></div>
                             <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                             <div className="h-3 w-3 rounded-full bg-green-400"></div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="h-10 w-10 bg-pink-100 rounded-full flex items-center justify-center">
                                    <Mail className="h-5 w-5 text-pink-600" />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400 font-medium uppercase">De</div>
                                    <div className="font-semibold text-gray-900">contact@votre-entreprise.com</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="h-10 w-10 bg-violet-100 rounded-full flex items-center justify-center">
                                    <Globe className="h-5 w-5 text-violet-600" />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400 font-medium uppercase">Site Web</div>
                                    <div className="font-semibold text-gray-900">www.votre-entreprise.com</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature 2: Stockage & Apps */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-16 group">
                <div className="flex-1 space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-pink-100 text-pink-700 text-sm font-bold uppercase tracking-wider">
                        Puissance
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                        30 Go de liberté.<br/>Et tout l'écosystème.
                    </h2>
                    <p className="text-xl text-gray-500 leading-relaxed">
                        Fini les limites. Stockez tous vos projets lourds, photos HD et vidéos 4K. 
                        Profitez en plus d'accès exclusifs aux versions "Enterprise" de nos applications.
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <Database className="h-6 w-6 text-gray-900 mb-2" />
                            <div className="font-bold text-gray-900">Stockage Cloud</div>
                            <div className="text-sm text-gray-500">30 Go Sécurisés</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <Layers className="h-6 w-6 text-gray-900 mb-2" />
                            <div className="font-bold text-gray-900">Apps Pro</div>
                            <div className="text-sm text-gray-500">Accès illimité</div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex justify-center w-full">
                     <div className="relative w-full max-w-sm">
                        <div className="absolute top-0 -right-4 w-full h-full bg-gradient-to-br from-pink-200 to-violet-200 rounded-2xl transform rotate-6 opacity-50 blur-sm"></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden group-hover:-translate-y-2 transition-transform duration-500">
                            <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
                                <span className="font-bold">Stockage</span>
                                <ShieldCheck className="h-5 w-5 text-green-400" />
                            </div>
                            <div className="p-8 text-center">
                                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600 mb-2">
                                    30<span className="text-2xl text-gray-400">GB</span>
                                </div>
                                <p className="text-gray-400 text-sm font-medium">Espace disponible immédiat</p>
                            </div>
                            <div className="px-8 pb-8">
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full w-[15%] bg-gradient-to-r from-pink-500 to-violet-600 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                     </div>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-24 bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="container mx-auto px-6 text-center space-y-8 relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
            Prêt à passer au niveau supérieur ?
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Rejoignez des milliers de professionnels qui ont choisi l'indépendance numérique avec Sivara Pro.
          </p>
          <div className="flex justify-center pt-8">
            <Button 
                onClick={handleSubscribe}
                disabled={isLoading}
                className="h-16 px-12 bg-white text-black hover:bg-gray-100 text-lg rounded-full shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all hover:scale-105 font-bold"
            >
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                Activer mon essai gratuit
            </Button>
          </div>
          <p className="text-gray-500 text-sm mt-6">Garantie satisfait ou remboursé de 30 jours.</p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;