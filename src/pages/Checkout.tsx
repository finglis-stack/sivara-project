import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Lock, CreditCard, ShieldCheck, CheckCircle2, Sparkles, ArrowLeft } from 'lucide-react';

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const planType = searchParams.get('plan') || 'monthly'; // monthly or yearly
  const isTrial = searchParams.get('trial') === 'true';

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Form, 2: Processing, 3: Success
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  // Formatage carte bancaire (simulation visuelle)
  const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(val.substring(0, 19));
  };

  const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 2) val = val.substring(0, 2) + '/' + val.substring(2, 4);
    setExpiry(val.substring(0, 5));
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulation délai Stripe
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Calcul de la date de fin (14 jours si essai, sinon 1 mois)
      const now = new Date();
      const endDate = new Date();
      if (isTrial) {
        endDate.setDate(now.getDate() + 14);
      } else {
        endDate.setMonth(now.getMonth() + 1);
      }

      // Mise à jour BDD
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_pro: true,
          subscription_status: isTrial ? 'trialing' : 'active',
          subscription_end_date: endDate.toISOString(),
          has_used_trial: true // Marqué comme utilisé
        })
        .eq('id', user?.id);

      if (error) throw error;

      setStep(3); // Succès
      
      setTimeout(() => {
        navigate('/pro-onboarding');
      }, 1500);

    } catch (err) {
      showError("Échec du paiement. Veuillez réessayer.");
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
              Passez à la vitesse supérieure.
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
                    Puis 4.99 $/mois<br/>à partir du {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* DROITE : PAIEMENT (Clair) */}
      <div className="lg:w-1/2 bg-white p-8 lg:p-20 flex flex-col justify-center">
         <div className="max-w-md mx-auto w-full">
            {step === 3 ? (
               <div className="text-center space-y-6 animate-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                     <Sparkles size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Paiement confirmé !</h2>
                  <p className="text-gray-500">Configuration de votre espace Pro en cours...</p>
               </div>
            ) : (
               <form onSubmit={handlePayment} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div>
                     <h2 className="text-2xl font-bold text-gray-900 mb-2">Informations de paiement</h2>
                     <p className="text-gray-500 text-sm">Transactions sécurisées et chiffrées par Stripe.</p>
                  </div>

                  <div className="space-y-4">
                     <div className="space-y-2">
                        <Label>Titulaire de la carte</Label>
                        <Input 
                           placeholder="Jean Dupont" 
                           value={name}
                           onChange={e => setName(e.target.value)}
                           required
                           className="h-12 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                        />
                     </div>

                     <div className="space-y-2">
                        <Label>Numéro de carte</Label>
                        <div className="relative">
                           <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                           <Input 
                              placeholder="0000 0000 0000 0000" 
                              value={cardNumber}
                              onChange={handleCardNumber}
                              required
                              maxLength={19}
                              className="h-12 pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors font-mono"
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label>Expiration</Label>
                           <Input 
                              placeholder="MM/AA" 
                              value={expiry}
                              onChange={handleExpiry}
                              maxLength={5}
                              required
                              className="h-12 bg-gray-50 border-gray-200 focus:bg-white transition-colors font-mono text-center"
                           />
                        </div>
                        <div className="space-y-2">
                           <Label>CVC</Label>
                           <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input 
                                 placeholder="123" 
                                 value={cvc}
                                 onChange={e => setCvc(e.target.value)}
                                 maxLength={3}
                                 type="password"
                                 required
                                 className="h-12 pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors font-mono text-center"
                              />
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="pt-4">
                     <Button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full h-14 text-lg bg-gray-900 hover:bg-black text-white rounded-xl shadow-lg transition-all hover:scale-[1.01]"
                     >
                        {isLoading ? (
                           <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Traitement sécurisé...
                           </>
                        ) : (
                           <span className="flex items-center">
                              {isTrial ? 'Commencer l\'essai' : 'Payer 4.99 $'} 
                              <ArrowRight className="ml-2 h-5 w-5" />
                           </span>
                        )}
                     </Button>
                     <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
                        <ShieldCheck size={12} />
                        <span>Paiement sécurisé SSL 256-bit</span>
                     </div>
                  </div>
               </form>
            )}
         </div>
      </div>
    </div>
  );
};

export default Checkout;