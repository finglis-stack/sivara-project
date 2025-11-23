import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, ArrowLeft, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen bg-white font-sans selection:bg-gray-900 selection:text-white">
      {/* Header minimaliste */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/profile')}>
             <span className="font-semibold text-xl tracking-tight">Sivara</span>
             <span className="bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded">PRO</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/profile')} className="text-gray-500 hover:text-black">
             <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Button>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
           <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight">
             Élevez votre expérience.
           </h1>
           <p className="text-xl text-gray-500 font-light max-w-xl mx-auto">
             Plus d'espace, plus de vitesse, plus de possibilités. <br/>
             Une suite d'outils conçue pour ceux qui en veulent plus.
           </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Plan Gratuit */}
            <div className="p-8 rounded-3xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Standard</h3>
                <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-gray-900">0$</span>
                    <span className="text-gray-500">/mois</span>
                </div>
                <p className="text-gray-500 mb-8 text-sm leading-relaxed h-10">
                    L'essentiel pour organiser votre vie numérique et collaborer simplement.
                </p>
                <Button variant="outline" className="w-full rounded-full h-12 font-medium border-gray-300" disabled>
                    Votre plan actuel
                </Button>
                
                <div className="mt-8 space-y-4">
                    {['Recherche illimitée', '500 Mo de stockage Docs', 'Collaboration de base', 'Publicités non-intrusives'].map((item) => (
                        <div key={item} className="flex items-start gap-3 text-sm text-gray-600">
                            <Check className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <span>{item}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Plan Pro */}
            <div className="p-8 rounded-3xl border border-gray-200 bg-white shadow-xl relative overflow-hidden ring-1 ring-black/5">
                <div className="absolute top-0 right-0 bg-black text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                    POPULAIRE
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sivara Pro</h3>
                <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-gray-900">4.99$</span>
                    <span className="text-gray-500">/mois</span>
                </div>
                <p className="text-gray-500 mb-8 text-sm leading-relaxed h-10">
                    Essai gratuit de 14 jours, puis facturation mensuelle. Annulable à tout moment.
                </p>
                <Button 
                    onClick={handleSubscribe} 
                    disabled={isLoading}
                    className="w-full rounded-full h-12 font-medium bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Commencer l\'essai gratuit'}
                </Button>
                
                <div className="mt-8 space-y-4">
                    {[
                        'Tout du plan Standard', 
                        'Stockage illimité', 
                        'Support prioritaire 24/7', 
                        'Zéro publicité',
                        'Personnalisation avancée des dossiers',
                        'Upload d\'images HD'
                    ].map((item) => (
                        <div key={item} className="flex items-start gap-3 text-sm text-gray-900">
                            <div className="h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <Check className="h-3 w-3 text-blue-600" />
                            </div>
                            <span>{item}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="mt-20 text-center">
            <p className="text-xs text-gray-400 max-w-2xl mx-auto">
                L'abonnement se renouvelle automatiquement. Vous pouvez gérer votre abonnement dans les paramètres de votre compte. 
                Les prix sont en dollars canadiens. Taxes en sus si applicables.
            </p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;