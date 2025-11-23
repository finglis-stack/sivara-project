import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, ShieldCheck, CheckCircle2, ArrowRight, Lock, CreditCard } from 'lucide-react';

// ID de prix Stripe officiel (Sivara Pro - Mensuel)
const STRIPE_PRICE_ID_MONTHLY = 'price_1SWTi12UEuKhlvPiQdVw7Jwl'; 

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isTrial = searchParams.get('trial') === 'true';

  const [isLoading, setIsLoading] = useState(false);

  const handleProceedToStripe = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-api', {
        body: {
          action: 'create_checkout',
          priceId: STRIPE_PRICE_ID_MONTHLY,
          isTrial: isTrial
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url; // Redirection vers Stripe
      } else {
        throw new Error('Pas d\'URL de paiement reçue');
      }
    } catch (err: any) {
      console.error(err);
      showError("Erreur de connexion au service de paiement.");
      setIsLoading(false);
    }
  };

  if (!user) {
      navigate('/login?returnTo=/pricing');
      return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-sans">
      
      {/* GAUCHE : RÉCAPITULATIF (Sombre) */}
      <div className="lg:w-1/2 bg-[#0F172A] text-white p-8 lg:p-20 flex flex-col justify-between relative overflow-hidden">
        {/* Background FX */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12 cursor-pointer" onClick={() => navigate('/pricing')}>
            <div className="h-8 w-8 bg-white/10 backdrop-blur rounded-lg flex items-center justify-center border border-white/20">
              <span className="font-bold">S</span>
            </div>
            <span className="font-medium text-lg tracking-wide">Sivara Pro</span>
          </div>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-500/30">
               {isTrial ? 'Essai Gratuit 14 jours' : 'Abonnement Mensuel'}
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Récapitulatif de votre commande
            </h1>
            <div className="flex flex-col gap-4 text-gray-400 pt-4">
               <div className="flex items-center gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 text-green-400"><CheckCircle2 size={16} /></div>
                  <span>Identité Pro (Domaine personnalisé)</span>
               </div>
               <div className="flex items-center gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 text-green-400"><CheckCircle2 size={16} /></div>
                  <span>30 Go de stockage sécurisé</span>
               </div>
               <div className="flex items-center gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 text-green-400"><CheckCircle2 size={16} /></div>
                  <span>Support prioritaire 24/7</span>
               </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-12 pt-12 border-t border-white/10">
           <div className="flex justify-between items-end">
              <div>
                 <p className="text-sm text-gray-400 mb-1">Total à payer aujourd'hui</p>
                 <div className="text-3xl font-bold">
                    {isTrial ? '0.00 $' : '4.99 $'}
                 </div>
              </div>
              {isTrial && (
                 <div className="text-right text-sm text-gray-400">
                    Puis 4.99 $/mois<br/>après 14 jours
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* DROITE : CONFIRMATION (Clair) */}
      <div className="lg:w-1/2 bg-white p-8 lg:p-20 flex flex-col justify-center">
         <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
            
            <div className="text-center lg:text-left">
               <h2 className="text-2xl font-bold text-gray-900 mb-2">Dernière étape</h2>
               <p className="text-gray-500">
                 Vous allez être redirigé vers l'interface sécurisée de Stripe pour {isTrial ? 'valider votre essai' : 'finaliser le paiement'}.
               </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-700">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">Paiement Sécurisé</p>
                        <p className="text-xs text-gray-500">Chiffré SSL 256-bit</p>
                    </div>
                </div>
                {isTrial ? (
                    <p className="text-sm text-gray-600 leading-relaxed">
                        <span className="font-semibold text-gray-900">Aucun débit aujourd'hui.</span> Une empreinte bancaire est requise pour activer l'essai. Vous pouvez annuler à tout moment avant la fin des 14 jours sans frais.
                    </p>
                ) : (
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Vous serez débité de 4.99 $ immédiatement pour le mois à venir. Renouvellement automatique, annulable à tout moment.
                    </p>
                )}
            </div>

            <Button 
                onClick={handleProceedToStripe}
                disabled={isLoading}
                className="w-full h-14 text-lg bg-gray-900 hover:bg-black text-white rounded-xl shadow-lg transition-all hover:scale-[1.01]"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Connexion à Stripe...
                    </>
                ) : (
                    <span className="flex items-center">
                        <Lock className="mr-2 h-4 w-4" />
                        {isTrial ? 'Valider mon essai (0 $)' : 'Procéder au paiement'} 
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </span>
                )}
            </Button>
            
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
                <ShieldCheck size={12} />
                <span>Powered by Stripe</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Checkout;