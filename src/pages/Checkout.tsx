import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, ArrowRight, Check, ShieldCheck, Lock, CreditCard, AlertCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// --- CONFIGURATION ---
const STRIPE_PRICE_ID_MONTHLY = 'price_1SWTi12UEuKhlvPiQdVw7Jwl'; 
// REMPLACE CECI PAR TA CLÉ PUBLIQUE (pk_test_...)
const stripePromise = loadStripe('pk_test_51SWTi12UEuKhlvPisWq48Z3iX4p8Qv5t9gq7x6z0y1a2b3c4d5e6f7g8h9i0j'); 

const Appearance = {
  theme: 'flat',
  variables: {
    fontFamily: '"Inter", sans-serif',
    colorPrimary: '#000000',
    colorBackground: '#ffffff',
    colorText: '#30313d',
    colorDanger: '#df1b41',
    borderRadius: '8px',
  },
  rules: {
    '.Input': { border: '1px solid #E5E7EB', boxShadow: 'none', padding: '12px' },
    '.Input:focus': { border: '1px solid #000000', boxShadow: 'none' },
  }
};

// --- FORMULAIRE INTERNE ---
const CheckoutForm = ({ clientSecret, isTrial }: { clientSecret: string, isTrial: boolean }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pro-onboarding`,
      },
    });

    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
        setMessage(error.message ?? "Une erreur est survenue.");
      } else {
        setMessage("Une erreur inattendue est survenue.");
      }
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-700">
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      
      {message && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg">{message}</div>}
      
      <Button 
        type="submit" 
        disabled={isLoading || !stripe || !elements}
        className="w-full h-14 bg-black hover:bg-gray-800 text-white rounded-xl text-lg font-light tracking-wide transition-all duration-300 hover:scale-[1.01] shadow-lg"
      >
        {isLoading ? (
          <Loader2 className="animate-spin h-5 w-5" />
        ) : (
          <span className="flex items-center justify-center gap-3">
             {isTrial ? "Activer l'essai gratuit" : "Confirmer le paiement"}
             <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
      
      <div className="flex justify-center items-center gap-2 text-xs text-gray-400 font-light">
         <Lock className="h-3 w-3" />
         <span>Paiement chiffré de bout en bout. Aucune donnée bancaire stockée par Sivara.</span>
      </div>
    </form>
  );
};

// --- PAGE PRINCIPALE ---
const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  // On récupère l'intention de l'utilisateur, mais le serveur aura le dernier mot
  const requestedTrial = searchParams.get('trial') === 'true';
  
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmedIsTrial, setConfirmedIsTrial] = useState<boolean>(requestedTrial);
  const [isDowngraded, setIsDowngraded] = useState(false);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    if (!user) {
       navigate('/login?returnTo=/pricing');
       return;
    }

    const initPayment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('stripe-api', {
          body: {
            action: 'create_subscription_intent',
            priceId: STRIPE_PRICE_ID_MONTHLY,
            isTrial: requestedTrial // On demande un essai
          }
        });

        if (error || !data?.clientSecret) throw error;
        
        setClientSecret(data.clientSecret);
        
        // Le serveur nous dit si l'essai a été accepté ou refusé (car déjà utilisé)
        setConfirmedIsTrial(data.isTrialActive);
        
        // Si on demandait un essai mais que le serveur a dit non, on notifie l'utilisateur
        if (requestedTrial && !data.isTrialActive) {
            setIsDowngraded(true);
            showError("Vous avez déjà bénéficié de l'essai gratuit.");
        }

      } catch (e) {
        console.error(e);
        setInitError(true);
        showError("Impossible d'initialiser le paiement sécurisé.");
      }
    };

    initPayment();
  }, [user, requestedTrial]);

  if (initError) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
              <p className="text-gray-500 font-light">Le service de paiement est momentanément indisponible.</p>
              <Button onClick={() => window.location.reload()} variant="outline">Réessayer</Button>
          </div>
      );
  }

  // On utilise la valeur CONFIRMÉE par le serveur pour l'affichage
  const isTrial = confirmedIsTrial;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans selection:bg-black selection:text-white">
      
      {/* GAUCHE : RÉCAPITULATIF ÉPURÉ */}
      <div className="lg:w-5/12 bg-gray-50 p-8 lg:p-16 flex flex-col justify-between border-r border-gray-100">
         <div>
            <div className="flex items-center gap-3 mb-16 cursor-pointer opacity-70 hover:opacity-100 transition-opacity" onClick={() => navigate('/pricing')}>
                <div className="h-8 w-8 bg-black text-white rounded-lg flex items-center justify-center">
                    <span className="font-bold font-serif">S</span>
                </div>
                <span className="font-medium tracking-wide">Sivara Pro</span>
            </div>

            <div className="space-y-2 mb-10">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Commande</p>
                <h1 className="text-3xl md:text-4xl font-light text-gray-900 leading-tight">
                    {isTrial ? "Activation de l'essai" : "Abonnement Mensuel"}
                </h1>
            </div>

            <div className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="mt-1 h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center bg-white"><Check className="h-3 w-3 text-black" /></div>
                    <div>
                        <p className="font-medium text-gray-900">Domaine Personnalisé</p>
                        <p className="text-sm text-gray-500 font-light">Votre identité numérique unique.</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="mt-1 h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center bg-white"><Check className="h-3 w-3 text-black" /></div>
                    <div>
                        <p className="font-medium text-gray-900">Stockage Cloud 30 Go</p>
                        <p className="text-sm text-gray-500 font-light">Sécurisé et chiffré.</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="mt-1 h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center bg-white"><Check className="h-3 w-3 text-black" /></div>
                    <div>
                        <p className="font-medium text-gray-900">Support Prioritaire</p>
                        <p className="text-sm text-gray-500 font-light">Accès direct à l'équipe technique.</p>
                    </div>
                </div>
            </div>
         </div>

         <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex justify-between items-end">
               <span className="text-sm text-gray-500 font-light">Total aujourd'hui</span>
               <span className="text-4xl font-thin tracking-tighter">
                   {isTrial ? '0.00 $' : '4.99 $'}
               </span>
            </div>
            {isTrial ? (
                <p className="text-right text-xs text-gray-400 mt-2 font-light">
                    Puis 4.99 $/mois après 14 jours. Annulable à tout moment.
                </p>
            ) : (
                <p className="text-right text-xs text-gray-400 mt-2 font-light">
                    Facturé mensuellement. Annulable à tout moment.
                </p>
            )}
         </div>
      </div>

      {/* DROITE : FORMULAIRE STRIPE ELEMENTS */}
      <div className="lg:w-7/12 p-8 lg:p-20 flex flex-col justify-center items-center">
         <div className="w-full max-w-md space-y-8">
            <div className="mb-8">
                <h2 className="text-xl font-medium text-gray-900 mb-2">Paiement</h2>
                <p className="text-sm text-gray-500 font-light">
                   Entrez vos coordonnées bancaires pour {isTrial ? "valider l'empreinte" : "régler votre abonnement"}.
                </p>
            </div>

            {isDowngraded && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-6 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                        <p className="font-semibold mb-1">Essai gratuit non disponible</p>
                        <p>Vous avez déjà utilisé votre période d'essai gratuite. La facturation standard de 4.99 $ s'applique.</p>
                    </div>
                </div>
            )}

            {clientSecret ? (
                // @ts-ignore
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: Appearance }}>
                    <CheckoutForm clientSecret={clientSecret} isTrial={isTrial} />
                </Elements>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-200" />
                    <p className="text-sm text-gray-400 font-light">Initialisation sécurisée...</p>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Checkout;