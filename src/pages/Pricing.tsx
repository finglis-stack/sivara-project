import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, ArrowLeft, Loader2, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-white font-sans selection:bg-black selection:text-white">
      {/* Navbar Transparente */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-black/10 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/profile')}>
            {/* Logo simplifié blanc */}
            <div className="h-9 w-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-medium text-lg tracking-wide text-white drop-shadow-md">Sivara Pro</span>
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
      <div className="relative h-[90vh] w-full overflow-hidden flex items-center justify-center">
        {/* Image de fond */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-in fade-in duration-1000 scale-105"
          style={{ 
            backgroundImage: 'url(/pro-hero.jpg)',
            backgroundPosition: 'center center'
          }}
        >
          {/* Overlay sombre élégant */}
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* Contenu Hero */}
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto mt-10">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-8 flex flex-col items-center">
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-sm font-medium shadow-lg mb-2">
              <span>L'expérience ultime</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-white drop-shadow-2xl leading-[1.1]">
              Le pouvoir de tout <br/>
              <span className="font-light text-white/90">accomplir.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 font-light max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
              Débloquez tout le potentiel de l'écosystème Sivara. Plus d'espace, 
              des outils exclusifs et une identité numérique unique.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              <Button 
                onClick={handleSubscribe}
                disabled={isLoading}
                className="h-16 px-12 bg-white text-black hover:bg-gray-100 text-lg rounded-full shadow-2xl transition-all duration-300 hover:-translate-y-1 font-bold group w-full sm:w-auto"
              >
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                Commencer l'essai gratuit
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <p className="text-white/60 text-sm">14 jours gratuits, puis 4.99$/mois. Annulable à tout moment.</p>
          </div>
        </div>
      </div>

      {/* Section Features Détail */}
      <div className="py-32 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-24">
            
            {/* Feature 1: Stockage */}
            <div className="flex flex-col md:flex-row items-center gap-12 group">
                <div className="flex-1 space-y-6">
                    <h2 className="text-4xl font-bold text-gray-900 tracking-tight">30 Go de stockage Cloud.</h2>
                    <p className="text-xl text-gray-500 font-light leading-relaxed">
                        Ne vous souciez plus jamais de l'espace. Stockez tous vos documents, images et projets 
                        dans un cloud sécurisé et chiffré de bout en bout. Accessible partout, tout le temps.
                    </p>
                    <div className="pt-4">
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-black w-[15%] rounded-full"></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                            <span>Utilisé</span>
                            <span>30 Go disponibles</span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="h-64 w-64 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center relative shadow-2xl group-hover:scale-105 transition-transform duration-500">
                        <span className="text-5xl font-bold text-gray-900">30<span className="text-2xl align-top text-gray-400">Go</span></span>
                    </div>
                </div>
            </div>

            {/* Feature 2: Email */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12 group">
                <div className="flex-1 space-y-6">
                    <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Votre identité professionnelle.</h2>
                    <p className="text-xl text-gray-500 font-light leading-relaxed">
                        Obtenez une adresse email personnalisée <strong>@{user?.email?.split('@')[0] || 'votre-nom'}.sivara.pro</strong>. 
                        Affirmez votre présence numérique avec une identité unique et mémorable.
                    </p>
                    <div className="inline-flex items-center px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-600 font-mono text-sm">
                        {user?.email ? user.email.split('@')[0] : 'jean'}@sivara.pro
                    </div>
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="w-full max-w-sm aspect-video bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 flex flex-col justify-center items-center gap-4 group-hover:-rotate-2 transition-transform duration-500">
                        <div className="h-12 w-12 rounded-full bg-black flex items-center justify-center text-white font-bold text-xl">S</div>
                        <div className="text-center">
                            <div className="font-bold text-gray-900">Bienvenue chez Pro</div>
                            <div className="text-sm text-gray-400">support@sivara.pro</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature 3: Apps */}
            <div className="flex flex-col md:flex-row items-center gap-12 group">
                <div className="flex-1 space-y-6">
                    <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Suite collaborative étendue.</h2>
                    <p className="text-xl text-gray-500 font-light leading-relaxed">
                        Accédez à des applications exclusives pour gérer vos projets, vos finances et votre créativité. 
                        Sivara Pro débloque des fonctionnalités avancées dans Docs, Sheets et Slides.
                    </p>
                    <ul className="space-y-3 pt-2">
                        {['Historique des versions illimité', 'Export PDF haute qualité', 'Collaboration en temps réel jusqu\'à 50 personnes'].map(item => (
                            <li key={item} className="flex items-center gap-3 text-gray-600">
                                <div className="h-5 w-5 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                                    <Check className="h-3 w-3 text-white" />
                                </div>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="grid grid-cols-2 gap-4">
                        {[1,2,3,4].map(i => (
                            <div key={i} className="h-24 w-24 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:-translate-y-1"></div>
                        ))}
                    </div>
                </div>
            </div>

          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-24 bg-black text-white">
        <div className="container mx-auto px-6 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Rejoignez l'élite numérique.
          </h2>
          <div className="flex justify-center">
            <Button 
                onClick={handleSubscribe}
                disabled={isLoading}
                className="h-14 px-10 bg-white text-black hover:bg-gray-100 text-lg rounded-full shadow-lg transition-all hover:scale-105 font-bold"
            >
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                Activer Sivara Pro maintenant
            </Button>
          </div>
          <p className="text-white/40 text-sm">Paiement sécurisé. Satisfait ou remboursé.</p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;