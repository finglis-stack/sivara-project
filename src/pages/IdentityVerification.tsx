import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Camera, CheckCircle2, AlertTriangle, ScanLine } from 'lucide-react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const IdentityVerification = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'intro' | 'scan_front' | 'scan_back' | 'processing' | 'success' | 'payment_redirect' | 'rejected'>('intro');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [riskData, setRiskData] = useState<any>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const unitId = searchParams.get('unit_id');

  // Initialisation de la caméra
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      showError("Accès caméra requis pour la vérification.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  useEffect(() => {
    if (step === 'scan_front' || step === 'scan_back') {
      startCamera();
    } else {
      stopCamera();
    }
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
        
        // Simuler un effet de scan visuel
        setScanProgress(0);
        const interval = setInterval(() => {
            setScanProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    if (side === 'front') {
                        setFrontImage(dataUrl);
                        setStep('scan_back');
                    } else {
                        setBackImage(dataUrl);
                        processVerification(frontImage!, dataUrl); // Lancer la verif
                    }
                    return 100;
                }
                return prev + 5;
            });
        }, 20);
      }
    }
  };

  const processVerification = async (front: string, back: string) => {
    setStep('processing');
    
    try {
        // 1. Get Fingerprint
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        
        const cleanFront = front.split(',')[1];
        const cleanBack = back.split(',')[1];

        // 2. Get User Profile for name comparison
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

        // 3. Call Edge Function (The Brain - Gemini Risk Engine)
        const { data, error } = await supabase.functions.invoke('verify-identity', {
            body: {
                frontImage: cleanFront,
                backImage: cleanBack,
                fingerprint: {
                    visitorId: result.visitorId,
                    os: (result.components as any).os?.value || (result.components as any).platform?.value,
                    gpu: 'NVIDIA GeForce RTX 3060 (Simulated)', 
                    memory: 16
                },
                userId: user?.id,
                userProfile: profile,
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

    } catch (e: any) {
        console.error(e);
        showError("Erreur lors de l'analyse sécurisée.");
        setStep('intro'); // Retry
    }
  };

  const startPaymentHandoff = async () => {
      setStep('payment_redirect');
      setIsRedirecting(true);
      
      try {
          const origin = window.location.origin;
          const successUrl = `${origin}/?app=device&order_success=true`;
          const cancelUrl = `${origin}/?app=device&error=payment_cancelled`;

          const { data, error } = await supabase.functions.invoke('stripe-api', {
              body: {
                  action: 'create_device_checkout',
                  unitId: unitId,
                  successUrl: successUrl,
                  cancelUrl: cancelUrl
              }
          });

          if (error) throw error;
          if (data?.url) {
              window.location.href = data.url; 
          } else {
              throw new Error("Pas d'URL de paiement reçue");
          }

      } catch (e: any) {
          console.error("Erreur Checkout:", e);
          showError("Impossible d'initialiser le paiement sécurisé.");
          setStep('success'); 
          setIsRedirecting(false);
      }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col items-center justify-center p-4">
        
        {/* LOGO BAR SIMPLE */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-center items-center z-50">
            <span className="font-bold tracking-widest text-sm text-gray-900">SIVARA ID</span>
        </div>

        <div className="w-full max-w-md">
            
            {step === 'intro' && (
                <div className="text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-gray-200 shadow-sm">
                        <ScanLine className="h-8 w-8 text-gray-900" />
                    </div>
                    <h1 className="text-2xl font-bold mb-3 text-gray-900">Vérification d'Identité</h1>
                    <p className="text-gray-500 text-sm mb-10 leading-relaxed max-w-xs mx-auto">
                        Nous devons vérifier votre pièce d'identité pour valider la commande.
                    </p>
                    <Button onClick={() => setStep('scan_front')} className="w-full bg-black text-white hover:bg-gray-800 h-12 font-medium rounded-lg shadow-md transition-all hover:scale-[1.02]">
                        Commencer
                    </Button>
                </div>
            )}

            {(step === 'scan_front' || step === 'scan_back') && (
                <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-xl ring-1 ring-gray-200">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* OVERLAY */}
                    <div className="absolute inset-0 flex flex-col justify-between p-6 z-10">
                        <div className="text-center bg-white/90 backdrop-blur-md py-2 px-4 rounded-full border border-gray-200 mx-auto shadow-sm">
                            <span className="text-sm font-medium text-gray-900">
                                {step === 'scan_front' ? "Recto de la carte" : "Verso de la carte"}
                            </span>
                        </div>
                        
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[60%] border-2 border-white/80 rounded-xl">
                            {/* Coins blancs simples */}
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-lg"></div>
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-lg"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-lg"></div>
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white rounded-br-lg"></div>
                        </div>

                        <div className="flex justify-center pb-4">
                            <button 
                                onClick={() => captureImage(step === 'scan_front' ? 'front' : 'back')}
                                className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                            >
                                <Camera className="h-6 w-6 text-black" />
                            </button>
                        </div>
                    </div>

                    {/* LOADING BAR */}
                    {scanProgress > 0 && (
                        <div className="absolute bottom-0 left-0 h-1.5 bg-black transition-all duration-75 ease-out" style={{ width: `${scanProgress}%` }}></div>
                    )}
                </div>
            )}

            {step === 'processing' && (
                <div className="text-center space-y-8 animate-in fade-in duration-500">
                    <Loader2 className="h-10 w-10 text-gray-900 animate-spin mx-auto" />
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold text-gray-900">Analyse en cours</h2>
                        <p className="text-sm text-gray-500">Vérification des données...</p>
                    </div>
                </div>
            )}

            {step === 'success' && (
                <div className="text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-gray-900">Identité confirmée</h1>
                    <p className="text-gray-500 text-sm mb-8">
                        Votre profil a été validé avec succès.
                    </p>
                    
                    <Button onClick={startPaymentHandoff} disabled={isRedirecting} className="w-full bg-black hover:bg-gray-800 h-12 font-medium rounded-lg text-white shadow-md">
                        {isRedirecting ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Redirection...</> : "Continuer vers le paiement"}
                    </Button>
                </div>
            )}

            {step === 'payment_redirect' && (
                <div className="text-center space-y-6 animate-in fade-in duration-300">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-300 mx-auto" />
                    <p className="text-gray-500 text-sm">Connexion sécurisée au terminal de paiement...</p>
                </div>
            )}

            {step === 'rejected' && (
                <div className="text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-gray-900">Vérification échouée</h1>
                    <p className="text-gray-500 text-sm mb-8">
                        Nous n'avons pas pu valider votre identité automatiquement.
                        {riskData?.reason && <span className="block mt-2 font-medium text-red-600 bg-red-50 py-1 px-2 rounded text-xs mx-auto w-fit">{riskData.reason}</span>}
                    </p>

                    <Button onClick={() => window.location.href = '/'} variant="outline" className="w-full h-12">
                        Retour à l'accueil
                    </Button>
                </div>
            )}

        </div>
    </div>
  );
};

export default IdentityVerification;