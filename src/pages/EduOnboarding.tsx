import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Rocket, BrainCircuit, Sparkles, CheckCircle2, Atom, ArrowRight, Shield } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import confetti from 'canvas-confetti';

const EduOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: Intro, 1: Subject, 2: Terms, 3: Loading
  const [subject, setSubject] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loadingText, setLoadingText] = useState('Initialisation du cortex...');

  // Vérifier si déjà onboardé
  useEffect(() => {
    const check = async () => {
      if (!user) return;
      const { data } = await supabase.from('edu_preferences').select('user_id').eq('user_id', user.id).single();
      if (data) navigate('/?app=edu&path=/dash');
    };
    check();
  }, [user, navigate]);

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleFinish = async () => {
    if (!user) return;
    setStep(3); // Loading screen

    // Séquence d'animation de chargement fake
    const texts = [
      "Calibrage des neurones...",
      "Téléchargement du programme du Ministère...",
      "Suppression des devoirs ennuyeux...",
      "Optimisation de la dopamine...",
      "Prêt au décollage !"
    ];

    for (let i = 0; i < texts.length; i++) {
       setLoadingText(texts[i]);
       await new Promise(r => setTimeout(r, 800));
    }

    try {
      const { error } = await supabase.from('edu_preferences').insert({
        user_id: user.id,
        subject: subject,
        level: 1,
        xp: 0
      });

      if (error) throw error;
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setTimeout(() => {
          navigate('/?app=edu&path=/dash');
      }, 1000);

    } catch (e: any) {
      showError(e.message);
      setStep(2);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans overflow-hidden relative">
      
      {/* Background Blobs Animés */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] animate-blob"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-400/20 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>
      </div>

      <Card className="w-full max-w-lg border-0 shadow-2xl bg-white/80 backdrop-blur-xl relative z-10 overflow-hidden">
        
        {/* STEP 0: INTRO */}
        {step === 0 && (
            <div className="p-8 text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl transform -rotate-6 hover:rotate-0 transition-all duration-500">
                    <Rocket className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Prêt à hacker tes études ?</h1>
                <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                    Sivara Éducation n'est pas un manuel scolaire. <br/>
                    C'est ton copilote intelligent pour exploser tes scores sans y passer tes nuits.
                </p>
                <Button onClick={handleNext} className="w-full h-14 text-lg bg-gray-900 hover:bg-black text-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
                    C'est parti <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </div>
        )}

        {/* STEP 1: SUBJECT */}
        {step === 1 && (
            <div className="p-8 animate-in slide-in-from-right-8 duration-500">
                <div className="mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                        <BrainCircuit className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Choisis ta mission</h2>
                    <p className="text-gray-500">Quelle matière veux-tu maîtriser en premier ?</p>
                </div>

                <div className="space-y-4 mb-8">
                    <Label>Matière principale</Label>
                    <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger className="h-14 text-lg bg-white border-gray-200">
                            <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="science_st_4">🧬 Science et Technologie (ST) - Sec 4</SelectItem>
                            <SelectItem value="history_4" disabled>📜 Histoire - Sec 4 (Bientôt)</SelectItem>
                            <SelectItem value="math_ts_5" disabled>📐 Math TS - Sec 5 (Bientôt)</SelectItem>
                        </SelectContent>
                    </Select>
                    {subject === 'science_st_4' && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                            <Atom className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div className="text-sm text-blue-700">
                                <span className="font-bold">Excellent choix !</span> Le module inclut l'Univers Matériel, Vivant, Terre et Espace.
                            </div>
                        </div>
                    )}
                </div>

                <Button onClick={handleNext} disabled={!subject} className="w-full h-14 text-lg bg-gray-900 hover:bg-black text-white rounded-xl">
                    Suivant
                </Button>
            </div>
        )}

        {/* STEP 2: TERMS */}
        {step === 2 && (
            <div className="p-8 animate-in slide-in-from-right-8 duration-500">
                <div className="mb-6">
                     <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-4 text-green-600">
                        <Shield className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Le serment</h2>
                    <p className="text-gray-500">Promets-nous de ne pas utiliser tes super-pouvoirs pour le mal.</p>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 space-y-4">
                    <div className="flex items-start gap-3">
                        <Checkbox id="terms" checked={accepted} onCheckedChange={(c) => setAccepted(c as boolean)} className="mt-1" />
                        <label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed cursor-pointer select-none">
                            J'accepte les <a href="#" className="text-gray-900 underline font-medium">Conditions d'utilisation</a> et la <a href="#" className="text-gray-900 underline font-medium">Politique de confidentialité</a>. <br/><br/>
                            Je comprends que Sivara utilise l'IA pour m'aider à apprendre, pas pour tricher (clin d'œil).
                        </label>
                    </div>
                </div>

                <Button onClick={handleFinish} disabled={!accepted} className="w-full h-14 text-lg bg-gray-900 hover:bg-black text-white rounded-xl shadow-lg hover:shadow-xl transition-all">
                    Activer mon Dashboard <Sparkles className="ml-2 h-5 w-5" />
                </Button>
            </div>
        )}

        {/* STEP 3: LOADING */}
        {step === 3 && (
            <div className="p-12 flex flex-col items-center justify-center text-center h-[400px] animate-in fade-in duration-500">
                <div className="relative mb-8">
                    <div className="w-24 h-24 rounded-full border-4 border-gray-100"></div>
                    <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BrainCircuit className="h-10 w-10 text-blue-600 animate-pulse" />
                    </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 animate-pulse">{loadingText}</h3>
            </div>
        )}

      </Card>
      
      {/* Indicateur d'étape */}
      {step < 3 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {[0,1,2].map(i => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-gray-900' : 'w-2 bg-gray-300'}`}></div>
            ))}
        </div>
      )}

    </div>
  );
};

export default EduOnboarding;