import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, ArrowRight, Lock, AlertCircle } from 'lucide-react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import LanguageSelector from '@/components/LanguageSelector';
import { useTranslation } from 'react-i18next';

// --- CONFIGURATION ---
const STRIPE_PRICE_ID_MONTHLY = 'price_1SWTi12UEuKhlvPiQdVw7Jwl'; 
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SWTTe2UEuKhlvPiZK33IJhJSYPTaYPfkQX9KcBUt39uD4w0vEf8z5iTYufLx01PfJyNvgN4Pa20iGXskGEzPl7x00danXtwmY';

// Updated appearance to match Sivara's 90-degree cream theme
const Appearance = {
  theme: 'flat',
  variables: {
    fontFamily: '"Inter", sans-serif',
    colorPrimary: '#00236F',
    colorBackground: 'transparent',
    colorText: '#111111',
    colorDanger: '#df1b41',
    borderRadius: '0px',
  },
  rules: {
    '.Input': { 
        border: '1px solid rgba(197, 197, 211, 0.4)', 
        boxShadow: 'none', 
        padding: '12px',
        backgroundColor: '#FFFFFF'
    },
    '.Input:focus': { 
        border: '1px solid #00236F', 
        boxShadow: 'none' 
    },
    '.Tab': {
        border: '1px solid rgba(197, 197, 211, 0.4)', 
        backgroundColor: '#FFFFFF',
        borderRadius: '0px',
    },
    '.Tab--selected': {
        border: '1px solid #00236F', 
        backgroundColor: '#FFFFFF',
    }
  }
};

// --- FORMULAIRE INTERNE ---
const CheckoutForm = ({ clientSecret, isTrial }: { clientSecret: string, isTrial: boolean }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);

    const returnUrl = `${window.location.origin}/pro-onboarding`;

    let error;

    if (isTrial) {
        // POUR ESSAI GRATUIT : On confirme le SetupIntent (pas de paiement immédiat)
        const result = await stripe.confirmSetup({
            elements,
            confirmParams: {
                return_url: returnUrl,
            },
        });
        error = result.error;
    } else {
        // POUR PAIEMENT : On confirme le PaymentIntent
        const result = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: returnUrl,
            },
        });
        error = result.error;
    }

    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
        setMessage(error.message ?? "Une erreur est survenue.");
      } else {
        setMessage("Une erreur inattendue est survenue.");
      }
      setIsLoading(false);
    } else {
        // Normalement on est redirigé avant d'arriver ici
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-700 w-full">
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      
      {message && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-none border border-red-100">{message}</div>}
      
      <Button 
        type="submit" 
        disabled={isLoading || !stripe || !elements}
        className="w-full h-14 bg-[#00236F] hover:bg-[#001b54] text-white rounded-none text-lg font-medium transition-all duration-300 shadow-md"
      >
        {isLoading ? (
          <Loader2 className="animate-spin h-5 w-5" />
        ) : (
          <span className="flex items-center justify-center gap-3 tracking-wide">
             {isTrial ? t('checkout.btnTrial') : t('checkout.btnPro')}
             <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
      
      <div className="flex justify-center items-center gap-2 text-xs text-[#5a5b67] font-light mt-4">
         <Lock className="h-3 w-3" />
         <span>{t('checkout.encryptionNote')}</span>
      </div>
    </form>
  );
};

// --- PAGE PRINCIPALE ---
const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  
  const requestedTrial = searchParams.get('trial') === 'true';
  
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmedIsTrial, setConfirmedIsTrial] = useState<boolean>(requestedTrial);
  const [isDowngraded, setIsDowngraded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const initializationRef = useRef(false);

  useEffect(() => {
    if (!user) {
       navigate('/login?returnTo=/pricing');
       return;
    }

    const initPayment = async () => {
      if (initializationRef.current) return;
      initializationRef.current = true;

      try {
        setStripePromise(loadStripe(STRIPE_PUBLISHABLE_KEY));

        const { data, error } = await supabase.functions.invoke('stripe-api', {
          body: {
            action: 'create_subscription_intent',
            priceId: STRIPE_PRICE_ID_MONTHLY,
            isTrial: requestedTrial
          }
        });

        if (error) {
            console.error("Erreur réseau:", error);
            throw new Error("Erreur de communication avec le serveur.");
        }

        if (data && data.error) {
             console.error("Erreur Stripe:", data.error);
             throw new Error(data.error);
        }

        if (!data?.clientSecret) {
            throw new Error("Réponse invalide du serveur (Pas de clientSecret)");
        }
        
        setClientSecret(data.clientSecret);
        setConfirmedIsTrial(data.isTrialActive);
        
        if (requestedTrial && !data.isTrialActive) {
            setIsDowngraded(true);
            showError("Vous avez déjà bénéficié de l'essai gratuit.");
        }

      } catch (e: any) {
        console.error(e);
        setErrorMessage(e.message || "Erreur inconnue");
        showError(e.message || "Impossible d'initialiser le paiement.");
        initializationRef.current = false; 
      }
    };

    initPayment();
  }, [user, requestedTrial]);

  if (errorMessage) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#FAF9F4] p-4 text-center font-sans">
              <div className="bg-red-50 p-4 rounded-none border border-red-100">
                  <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div className="max-w-md">
                  <h1 className="text-xl font-medium text-[#111111] mb-2">{t('checkout.errorTitle')}</h1>
                  <p className="text-[#5a5b67] font-light mb-6">{errorMessage}</p>
                  <Button onClick={() => window.location.reload()} variant="outline" className="rounded-none border-[#c5c5d3]/50">{t('checkout.errorRetryBtn')}</Button>
              </div>
          </div>
      );
  }

  const isTrial = confirmedIsTrial;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F4] font-sans selection:bg-[#00236F] selection:text-white relative">
      <style>{`
          .grid-bg-pattern {
              background-image: 
                  linear-gradient(to right, rgba(197, 197, 211, 0.4) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(197, 197, 211, 0.4) 1px, transparent 1px);
              background-size: 40px 40px;
          }
      `}</style>
      <div className="fixed inset-0 grid-bg-pattern opacity-50 z-0 pointer-events-none"></div>

      {/* Navigation */}
      <nav className="relative z-50 w-full px-8 py-6 flex justify-between items-center max-w-screen-xl mx-auto">
         <div onClick={() => navigate('/pricing')} className="flex items-center gap-3 cursor-pointer transition-all active:scale-95 group">
             <div className="h-8 w-8 bg-[#00236F] text-white rounded-none flex items-center justify-center shadow-sm">
                 <span className="font-bold font-serif leading-none">S</span>
             </div>
             <span className="font-medium tracking-wide text-[#111111] group-hover:text-[#00236F] transition-colors">{t('pricing.proTitle')}</span>
         </div>
         <div className="flex items-center gap-4">
             <LanguageSelector />
         </div>
      </nav>

      {/* Layout */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 py-8">
         <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-0 bg-[#FAF9F4] border border-[#c5c5d3]/40 shadow-sm relative overflow-hidden">
             
             {/* LEFT: RECAP */}
             <div className="p-10 lg:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#c5c5d3]/40 bg-white/50 backdrop-blur-sm">
                <div>
                    <h1 className="text-3xl md:text-4xl font-light text-[#111111] leading-tight mb-2">
                        {isTrial ? t('checkout.titleTrial') : t('checkout.titlePro')}
                    </h1>
                    <p className="text-[#5a5b67] font-light mb-12">{t('checkout.subtitle')}</p>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <span className="text-[#00236F] font-bold">—</span>
                            <div>
                                <p className="font-medium text-[#111111]">{t('checkout.featStorageTitle')}</p>
                                <p className="text-sm text-[#5a5b67] font-light">{t('checkout.featStorageDesc')}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <span className="text-[#00236F] font-bold">—</span>
                            <div>
                                <p className="font-medium text-[#111111]">{t('checkout.featDomainTitle')}</p>
                                <p className="text-sm text-[#5a5b67] font-light">{t('checkout.featDomainDesc')}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <span className="text-[#00236F] font-bold">—</span>
                            <div>
                                <p className="font-medium text-[#111111]">{t('checkout.featAITitle')}</p>
                                <p className="text-sm text-[#5a5b67] font-light">{t('checkout.featAIDesc')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-16 pt-8 border-t border-[#c5c5d3]/40">
                    <div className="flex justify-between items-end">
                       <span className="text-sm text-[#5a5b67] font-medium uppercase tracking-widest">{t('checkout.totalToday')}</span>
                       <span className="text-4xl font-light tracking-tighter text-[#111111]">
                           {isTrial ? '0.00 $' : '4.99 $'}
                       </span>
                    </div>
                    {isTrial ? (
                        <p className="text-right text-xs text-[#5a5b67] mt-2 font-light">
                            {t('checkout.trialNotice')}
                        </p>
                    ) : (
                        <p className="text-right text-xs text-[#5a5b67] mt-2 font-light">
                            {t('checkout.standardNotice')}
                        </p>
                    )}
                </div>
             </div>

             {/* RIGHT: STRIPE FORM */}
             <div className="p-10 lg:p-16 flex flex-col justify-center bg-white">
                <div className="w-full space-y-6">
                    <div>
                        <h2 className="text-xl font-medium text-[#111111] mb-1">{t('checkout.billingInfo')}</h2>
                        <p className="text-sm text-[#5a5b67] font-light">
                           {isTrial ? t('checkout.billingSubtitleTrial') : t('checkout.billingSubtitlePro')}
                        </p>
                    </div>

                    {isDowngraded && (
                        <div className="bg-[#FAF9F4] border border-[#c5c5d3]/40 rounded-none p-4 mb-6 flex items-start gap-3 animate-in fade-in">
                            <AlertCircle className="h-5 w-5 text-[#111111] flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-[#111111]">
                                <p className="font-medium mb-1">{t('checkout.expiredTrialTitle')}</p>
                                <p className="font-light">{t('checkout.expiredTrialDesc')}</p>
                            </div>
                        </div>
                    )}

                    {clientSecret && stripePromise ? (
                        // @ts-ignore
                        <Elements stripe={stripePromise} options={{ clientSecret, appearance: Appearance }}>
                            <CheckoutForm clientSecret={clientSecret} isTrial={isTrial} />
                        </Elements>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-[#c5c5d3]" />
                            <p className="text-sm text-[#5a5b67] font-light">{t('checkout.loading')}</p>
                        </div>
                    )}
                </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default Checkout;