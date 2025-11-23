import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';

const ProOnboarding = () => {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const runConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  useEffect(() => {
    const syncStatus = async () => {
        try {
            // Appel API pour forcer la synchronisation Stripe -> Supabase
            const { data, error } = await supabase.functions.invoke('stripe-api', {
                body: { action: 'sync_subscription' }
            });

            if (error) throw error;

            if (data?.isPro) {
                setSyncSuccess(true);
                runConfetti();
            } else {
                // Si toujours pas pro après sync, c'est louche, on réessaiera ou message d'erreur
                console.warn("Sync terminée mais statut non Pro:", data);
            }
        } catch (err) {
            console.error("Erreur sync:", err);
        } finally {
            setIsSyncing(false);
        }
    };

    // Petit délai pour laisser Stripe traiter le setup
    setTimeout(syncStatus, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="animate-in zoom-in duration-700 max-w-2xl">
        
        {isSyncing ? (
             <div className="flex flex-col items-center gap-6">
                <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mx-auto shadow-lg border border-gray-800">
                    <Loader2 size={40} className="text-blue-500 animate-spin" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight animate-pulse">
                   Activation de votre espace...
                </h1>
                <p className="text-gray-400">Nous synchronisons votre abonnement avec les serveurs sécurisés.</p>
             </div>
        ) : (
            <>
                <div className="w-24 h-24 bg-gradient-to-tr from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
                   <CheckCircle2 size={48} className="text-white" />
                </div>
                
                <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                   {syncSuccess ? "Bienvenue dans l'élite." : "Activation terminée."}
                </h1>
                
                <p className="text-xl text-gray-400 max-w-xl mx-auto mb-12 leading-relaxed">
                   {syncSuccess 
                     ? "Votre compte Sivara Pro est maintenant actif. Votre domaine personnalisé est en cours de provisionnement et sera disponible sous 24h." 
                     : "Votre demande a été prise en compte. Si votre statut ne s'affiche pas immédiatement, il le sera d'ici quelques instants."}
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button 
                        onClick={() => navigate('/profile')}
                        className="h-14 px-10 bg-white text-black hover:bg-gray-100 rounded-full text-lg font-bold shadow-lg transition-all hover:scale-105"
                    >
                        Accéder à mon espace
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    
                    {!syncSuccess && (
                        <Button variant="ghost" onClick={() => window.location.reload()} className="text-gray-500 hover:text-white">
                             <RefreshCw className="mr-2 h-4 w-4" /> Vérifier à nouveau
                        </Button>
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default ProOnboarding;