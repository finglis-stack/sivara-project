import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Camera, CheckCircle2, AlertTriangle, ScanLine, CreditCard, Lock } from 'lucide-react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Configuration Stripe
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SWTTe2UEuKhlvPiZK33IJhJSYPTaYPfkQX9KcBUt39uD4w0vEf8z5iTYufLx01PfJyNvgN4Pa20iGXskGEzPl7x00danXtwmY';
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// --- COMPOSANT FORMULAIRE INTERNE ---
const PaymentForm = ({ clientSecret, orderId, onSuccess }: { clientSecret: string, orderId: string, onSuccess: () => void }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);

        const { error } = await stripe.confirmPayment({
            elements,
            redirect: 'if_required', // Important: On gère la redirection nous-mêmes
        });

        if (error) {
            setMessage(error.message || "Erreur de paiement");
            setIsProcessing(false);
        } else {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm mb-4">
                <div className="flex justify-between mb-2">
                    <span className="text-gray-500">Commande</span>
                    <span className="font-mono font-bold">#{orderId.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-medium">Financement 16 mois</span>
                    <Badge>0% APR</Badge>
                </div>
            </div>

            <PaymentElement />
            
            {message && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{message}</div>}
            
            <Button 
                type="submit" 
                disabled={!stripe || isProcessing} 
                className="w-full bg-black hover:bg-gray-900 text-white h-12 rounded-lg font-bold shadow-lg"
            >
                {isProcessing ? <Loader2 className="animate-spin" /> : "Payer le dépôt et valider"}
            </Button>
            
            <div className="flex justify-center items-center gap-2 text-xs text-gray-400 mt-4">
                <Lock className="h-3 w-3" /> Paiement sécurisé SSL 256-bit
            </div>
        </form>
    );
};

// --- COMPOSANT PRINCIPAL ---
const IdentityVerification = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'intro' | 'scan_front' | 'scan_back' | 'processing' | 'success' | 'payment' | 'finalizing' | 'rejected'>('intro');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [riskData, setRiskData] = useState<any>(null);
  
  // Payment State
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Robust unitId retrieval
  const unitId = searchParams.get('unit_id');

  // Verify Unit ID on load
  useEffect(() => {
      if (!unitId) {
          console.error("Unit ID missing in URL");
      }
  }, [unitId]);

  // ... (Code Caméra inchangé) ...
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { showError("Accès caméra requis."); }
  };
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };
  useEffect(() => {
    if (step === 'scan_front' || step === 'scan_back') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [step]);

  const captureImage = (side: 'front' | 'back') => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setScanProgress(0);
        const interval = setInterval(() => {
            setScanProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    if (side === 'front') { setFrontImage(dataUrl); setStep('scan_back'); } 
                    else { setBackImage(dataUrl); processVerification(frontImage!, dataUrl); }
                    return 100;
                }
                return prev + 5;
            });
        }, 20);
      }
    }
  };

  const getRealFingerprint = async () => {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    let gpuRenderer = "Unknown GPU";
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        // @ts-ignore
        if (gl) { const debugInfo = gl.getExtension('WEBGL_debug_renderer_info'); if (debugInfo) gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL); }
    } catch(e) {}
    // @ts-ignore
    return { visitorId: result.visitorId, os: navigator.userAgent, gpu: gpuRenderer, memory: navigator.deviceMemory || "Unknown" };
  };

  const processVerification = async (front: string, back: string) => {
    setStep('processing');
    try {
        const fingerprint = await getRealFingerprint();
        const { data, error } = await supabase.functions.invoke('verify-identity', {
            body: {
                frontImage: front.split(',')[1],
                backImage: back.split(',')[1],
                fingerprint,
                userId: user?.id,
                cardBin: '4567' 
            }
        });
        if (error) throw error;
        setRiskData(data);
        if (data.status === 'APPROVE') {
            setTimeout(() => setStep('success'), 2000);
        } else {
            setStep('rejected');
        }
    } catch (e: any) { showError(e.message); setStep('intro'); }
  };

  // --- TRANSITION VERS PAIEMENT (FIXED) ---
  const initializePayment = async () => {
      if (!unitId) {
          showError("Erreur: ID de l'appareil manquant. Veuillez recommencer.");
          return;
      }

      setStep('payment'); // On affiche le loader
      
      try {
          console.log("Initializing payment for unit:", unitId);
          
          const { data, error } = await supabase.functions.invoke('stripe-api', {
              body: {
                  action: 'create_device_checkout',
                  unitId: unitId
              }
          });

          if (error) {
              console.error("Function error:", error);
              throw new Error(error.message || "Erreur serveur de paiement");
          }

          if (data?.error) {
              throw new Error(data.error);
          }

          if (data?.clientSecret) {
              setClientSecret(data.clientSecret);
              setSubscriptionId(data.subscriptionId);
          } else {
              throw new Error("Réponse de paiement invalide (Pas de secret)");
          }
      } catch (e: any) {
          console.error("Payment Init Error:", e);
          showError(e.message || "Impossible d'initialiser le paiement.");
          setStep('success'); // REVIENT A L'ETAPE PRECEDENTE POUR NE PAS BLOQUER
      }
  };

  // --- SUCCÈS PAIEMENT ---
  const handlePaymentSuccess = () => {
      setStep('finalizing');
      
      // Construction de l'URL de retour vers Device
      const hostname = window.location.hostname;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      
      let targetUrl = '';
      if (isLocal) {
          targetUrl = `http://localhost:8080/?app=device&order_success=true&session_id=${subscriptionId}`;
      } else {
          targetUrl = `https://device.sivara.ca/?order_success=true&session_id=${subscriptionId}`;
      }

      // Petite pause pour UX
      setTimeout(() => {
          window.location.href = targetUrl;
      }, 1500);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col items-center justify-center p-4">
        <div className="absolute top-0 left-0 w-full p-6 flex justify-center items-center z-50">
            <span className="font-bold tracking-widest text-sm text-gray-900">SIVARA ID</span>
        </div>

        <div className="w-full max-w-md">
            {step === 'intro' && (
                <div className="text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-gray-200 shadow-sm"><ScanLine className="h-8 w-8 text-gray-900" /></div>
                    <h1 className="text-2xl font-bold mb-3 text-gray-900">Vérification d'Identité</h1>
                    <p className="text-gray-500 text-sm mb-10 leading-relaxed max-w-xs mx-auto">Nous devons vérifier votre pièce d'identité pour valider la commande.</p>
                    <Button onClick={() => setStep('scan_front')} className="w-full bg-black text-white hover:bg-gray-800 h-12 font-medium rounded-lg shadow-md">Commencer</Button>
                </div>
            )}

            {(step === 'scan_front' || step === 'scan_back') && (
                <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-xl ring-1 ring-gray-200">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 flex flex-col justify-between p-6 z-10">
                        <div className="text-center bg-white/90 backdrop-blur-md py-2 px-4 rounded-full border border-gray-200 mx-auto shadow-sm"><span className="text-sm font-medium text-gray-900">{step === 'scan_front' ? "Recto de la carte" : "Verso de la carte"}</span></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[60%] border-2 border-white/80 rounded-xl"></div>
                        <div className="flex justify-center pb-4"><button onClick={() => captureImage(step === 'scan_front' ? 'front' : 'back')} className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"><Camera className="h-6 w-6 text-black" /></button></div>
                    </div>
                    {scanProgress > 0 && <div className="absolute bottom-0 left-0 h-1.5 bg-black transition-all duration-75 ease-out" style={{ width: `${scanProgress}%` }}></div>}
                </div>
            )}

            {step === 'processing' && <div className="text-center space-y-8 animate-in fade-in duration-500"><Loader2 className="h-10 w-10 text-gray-900 animate-spin mx-auto" /><div className="space-y-2"><h2 className="text-lg font-semibold text-gray-900">Analyse en cours</h2><p className="text-sm text-gray-500">Vérification des données biométriques...</p></div></div>}

            {step === 'success' && (
                <div className="text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
                    <h1 className="text-2xl font-bold mb-2 text-gray-900">Identité confirmée</h1>
                    <p className="text-gray-500 text-sm mb-8">Votre profil a été validé avec succès. Vous pouvez procéder au paiement.</p>
                    <Button onClick={initializePayment} className="w-full bg-black hover:bg-gray-800 h-12 font-medium rounded-lg text-white shadow-md">Procéder au paiement</Button>
                </div>
            )}

            {/* --- ETAPE PAIEMENT INTEGRÉE --- */}
            {step === 'payment' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600"><CreditCard className="h-6 w-6" /></div>
                        <h2 className="text-xl font-bold text-gray-900">Finaliser la commande</h2>
                    </div>
                    
                    {clientSecret ? (
                        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                            <PaymentForm clientSecret={clientSecret} orderId={subscriptionId || ''} onSuccess={handlePaymentSuccess} />
                        </Elements>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                            <p className="text-sm text-gray-500">Préparation du contrat sécurisé...</p>
                        </div>
                    )}
                </div>
            )}

            {step === 'finalizing' && (
                <div className="text-center space-y-6 animate-in fade-in duration-300">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
                    <h2 className="text-xl font-bold">Paiement Accepté</h2>
                    <p className="text-gray-500 text-sm">Redirection vers votre espace commande...</p>
                </div>
            )}

            {step === 'rejected' && <div className="text-center animate-in fade-in zoom-in duration-500"><div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100"><AlertTriangle className="h-8 w-8 text-red-600" /></div><h1 className="text-2xl font-bold mb-2 text-gray-900">Vérification échouée</h1><p className="text-gray-500 text-sm mb-8">{riskData?.reason}</p><Button onClick={() => window.location.href = '/'} variant="outline" className="w-full h-12">Retour à l'accueil</Button></div>}
        </div>
        
        {/* Badge Shadcn pour le style */}
        <div className="hidden">
            <Badge>Hidden</Badge>
        </div>
    </div>
  );
};

export default IdentityVerification;