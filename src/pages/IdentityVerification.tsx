import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShieldCheck, Camera, CheckCircle2, AlertTriangle, ScanLine, Fingerprint, Lock } from 'lucide-react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const IdentityVerification = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'intro' | 'scan_front' | 'scan_back' | 'processing' | 'success' | 'rejected'>('intro');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [riskData, setRiskData] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const unitId = searchParams.get('unit_id');
  const returnTo = searchParams.get('returnTo');

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
        
        // Simuler un effet de scan
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
        
        // Extraction simple de base64 (supprime le prefix data:image...)
        const cleanFront = front.split(',')[1];
        const cleanBack = back.split(',')[1];

        // 2. Get User Profile for name comparison
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

        // 3. Call Edge Function (The Brain)
        const { data, error } = await supabase.functions.invoke('verify-identity', {
            body: {
                frontImage: cleanFront,
                backImage: cleanBack,
                fingerprint: {
                    visitorId: result.visitorId,
                    os: result.components.os?.value,
                    // Note: FingerprintJS gratuit ne donne pas GPU direct, on simule pour l'exemple
                    gpu: 'NVIDIA GeForce RTX 3060 (Simulated)', 
                    memory: 16
                },
                userId: user?.id,
                userProfile: profile,
                // Simulation des 4 derniers chiffres (normalement viendrait du contexte de paiement précédent)
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

  const handleFinalRedirect = () => {
      // Génération d'un numéro de commande "SIV-..."
      const orderId = `SIV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*1000)}`;
      
      // Simulation Stripe (Normalement on irait sur Stripe ici)
      // On redirige vers device avec le success
      const successUrl = `/?app=device&order_success=${orderId}`;
      window.location.href = successUrl;
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-4">
        
        {/* LOGO BAR */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50">
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-green-500" />
                <span className="font-bold tracking-widest text-sm">SIVARA ID SECURE</span>
            </div>
            <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
                <Lock className="h-3 w-3" /> E2EE CONNECTED
            </div>
        </div>

        <div className="w-full max-w-md">
            
            {step === 'intro' && (
                <Card className="bg-zinc-900 border-zinc-800 p-8 text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <ScanLine className="h-10 w-10 text-white animate-pulse" />
                        <div className="absolute inset-0 border-2 border-green-500/30 rounded-full animate-[spin_4s_linear_infinite]"></div>
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-white">Vérification d'Identité</h1>
                    <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                        Pour activer votre abonnement Device-as-a-Service, nous devons vérifier votre identité et évaluer le profil de risque.
                        <br/><br/>
                        <span className="text-zinc-500 text-xs">Préparez votre pièce d'identité (Permis ou Passeport).</span>
                    </p>
                    <Button onClick={() => setStep('scan_front')} className="w-full bg-white text-black hover:bg-gray-200 h-12 font-bold rounded-lg">
                        Commencer la vérification
                    </Button>
                </Card>
            )}

            {(step === 'scan_front' || step === 'scan_back') && (
                <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden border-2 border-zinc-800 shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* OVERLAY */}
                    <div className="absolute inset-0 flex flex-col justify-between p-6 z-10">
                        <div className="text-center bg-black/50 backdrop-blur-md py-2 rounded-full border border-white/10">
                            <span className="text-sm font-medium">
                                {step === 'scan_front' ? "RECTO : Placez votre carte dans le cadre" : "VERSO : Retournez votre carte"}
                            </span>
                        </div>
                        
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[60%] border-2 border-white/30 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]">
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-xl"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-xl"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-xl"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-xl"></div>
                            
                            {/* SCANNING BAR */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-green-500/80 shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-[scan_2s_linear_infinite]"></div>
                        </div>

                        <div className="flex justify-center">
                            <button 
                                onClick={() => captureImage(step === 'scan_front' ? 'front' : 'back')}
                                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center relative group"
                            >
                                <div className="w-14 h-14 bg-white rounded-full group-active:scale-90 transition-transform"></div>
                            </button>
                        </div>
                    </div>

                    {/* LOADING BAR */}
                    {scanProgress > 0 && (
                        <div className="absolute bottom-0 left-0 h-2 bg-green-500 transition-all duration-75 ease-out" style={{ width: `${scanProgress}%` }}></div>
                    )}
                </div>
            )}

            {step === 'processing' && (
                <div className="text-center space-y-8 animate-in fade-in duration-500">
                    <div className="relative w-32 h-32 mx-auto">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#333" strokeWidth="2" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="280" strokeDashoffset="100" className="animate-[spin_1.5s_linear_infinite]" />
                        </svg>
                        <Fingerprint className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-500 h-12 w-12 animate-pulse" />
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold">Analyse en cours...</h2>
                        <div className="text-xs text-gray-500 font-mono space-y-1">
                            <p>CHECKING_BIOMETRICS... OK</p>
                            <p>VALIDATING_ISSUER... OK</p>
                            <p>CALCULATING_RISK_SCORE...</p>
                            <p className="text-blue-500">ANALYZING_DEVICE_FINGERPRINT...</p>
                        </div>
                    </div>
                </div>
            )}

            {step === 'success' && (
                <Card className="bg-zinc-900 border-green-900/50 p-8 text-center animate-in fade-in zoom-in duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                    <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-white">Identité Confirmée</h1>
                    <p className="text-gray-400 text-sm mb-6">
                        Votre profil est validé. Risque estimé : <span className="text-green-400 font-mono font-bold">FAIBLE ({riskData?.riskScore}/100)</span>
                    </p>
                    
                    <div className="bg-black/30 rounded-lg p-4 text-left text-xs font-mono text-gray-500 mb-6 space-y-1">
                        <div className="flex justify-between"><span>LTV PREDICTION:</span> <span className="text-blue-400">{riskData?.ltvPrediction}</span></div>
                        <div className="flex justify-between"><span>DEVICE TRUST:</span> <span className="text-green-400">HIGH</span></div>
                        <div className="flex justify-between"><span>LOCATION:</span> <span>SECURE ZONE</span></div>
                    </div>

                    <Button onClick={handleFinalRedirect} className="w-full bg-green-600 hover:bg-green-700 h-12 font-bold rounded-lg text-white">
                        Procéder au paiement (Stripe)
                    </Button>
                </Card>
            )}

            {step === 'rejected' && (
                <Card className="bg-zinc-900 border-red-900/50 p-8 text-center animate-in fade-in zoom-in duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                    <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-white">Vérification Échouée</h1>
                    <p className="text-gray-400 text-sm mb-6">
                        Nous ne pouvons pas valider votre demande automatiquement en raison d'un score de risque élevé.
                    </p>
                    
                    {riskData?.reason && (
                        <div className="bg-red-950/30 border border-red-900/30 p-3 rounded mb-6 text-xs text-red-400">
                            Raison: {riskData.reason}
                        </div>
                    )}

                    <Button onClick={() => window.location.href = '/'} variant="outline" className="w-full border-zinc-700 text-white hover:bg-zinc-800 h-12">
                        Retour à l'accueil
                    </Button>
                </Card>
            )}

        </div>
    </div>
  );
};

export default IdentityVerification;