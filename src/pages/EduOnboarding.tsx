import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Sparkles, Atom } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import confetti from 'canvas-confetti';

const EduOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: Intro, 1: Subject, 2: Terms, 3: Loading
  const [subject, setSubject] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loadingText, setLoadingText] = useState('Initialisation du cortex...');

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
    setStep(3);

    const texts = [
      "Calibrage...",
      "Programme du Ministère...",
      "Optimisation...",
      "Prêt."
    ];

    for (let i = 0; i < texts.length; i++) {
       setLoadingText(texts[i]);
       await new Promise(r => setTimeout(r, 600));
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
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#000000', '#555555', '#ffffff'] // Confetti N&B
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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans selection:bg-black selection:text-white">
      
      {/* Logo Minimaliste Fixe */}
      <div className="absolute top-8 left-8 flex items-center gap-3 opacity-0 animate-in fade-in duration-1000">
         <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold">S</div>
         <span className="font-medium tracking-tight">Éducation</span>
      </div>

      <div className="w-full max-w-lg mx-auto">
        
        {/* STEP 0: INTRO */}
        {step === 0 && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h1 className="text-5xl md:text-7xl font-bold text-black mb-8 tracking-tighter leading-[0.9]">
                    Hacker <br/>
                    <span className="text-gray-300">vos études.</span>
                </h1>
                <p className="text-gray-500 text-xl font-light mb-12 leading-relaxed max-w-sm mx-auto">
                    Plus de notes, moins d'efforts. <br/>
                    L'intelligence artificielle au service de votre GPA.
                </p>
                <Button 
                    onClick={handleNext} 
                    className="h-16 px-12 bg-black hover:bg-neutral-800 text-white rounded-full text-lg font-medium transition-all hover:scale-105 shadow-xl"
                >
                    Commencer <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
            </div>
        )}

        {/* STEP 1: SUBJECT */}
        {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12">
                <div>
                    <h2 className="text-3xl font-bold text-black mb-3">Votre mission</h2>
                    <p className="text-gray-500 text-lg font-light">Quelle matière voulez-vous maîtriser ?</p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-gray-400 tracking-widest pl-1">Programme</Label>
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="h-16 text-xl bg-transparent border-0 border-b-2 border-gray-100 rounded-none px-0 focus:ring-0 focus:border-black transition-all font-medium">
                                <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-100 shadow-xl rounded-xl p-2">
                                <SelectItem value="science_st_4" className="text-base py-3 cursor-pointer focus:bg-gray-50 rounded-lg">Science et Technologie (ST) - Sec 4</SelectItem>
                                <SelectItem value="history_4" disabled className="text-base py-3 opacity-50">Histoire - Sec 4 (Bientôt)</SelectItem>
                                <SelectItem value="math_ts_5" disabled className="text-base py-3 opacity-50">Math TS - Sec 5 (Bientôt)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {subject === 'science_st_4' && (
                        <div className="flex gap-4 items-start text-gray-600 animate-in fade-in slide-in-from-top-2 pt-2">
                            <div className="p-2 bg-gray-50 rounded-full"><Atom className="h-5 w-5 text-black" /></div>
                            <p className="text-sm leading-relaxed pt-1.5">Module complet incluant l'Univers Matériel, Vivant, Terre et Espace. Conforme au programme du Ministère.</p>
                        </div>
                    )}
                </div>

                <div className="pt-8">
                    <Button onClick={handleNext} disabled={!subject} className="w-full h-14 bg-black hover:bg-neutral-800 text-white rounded-full text-lg font-medium transition-all">
                        Suivant
                    </Button>
                </div>
            </div>
        )}

        {/* STEP 2: TERMS */}
        {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12">
                <div>
                    <h2 className="text-3xl font-bold text-black mb-3">Le pacte</h2>
                    <p className="text-gray-500 text-lg font-light">Promettez-nous d'utiliser ce pouvoir pour le bien.</p>
                </div>

                <div className="space-y-6">
                    <div className="flex items-start gap-4 p-2 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer" onClick={() => setAccepted(!accepted)}>
                        <Checkbox id="terms" checked={accepted} onCheckedChange={(c) => setAccepted(c as boolean)} className="mt-1 w-6 h-6 border-2 border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black transition-all" />
                        <label htmlFor="terms" className="text-base text-gray-600 leading-relaxed cursor-pointer select-none">
                            J'accepte les <span className="text-black font-medium border-b border-gray-300 pb-0.5">Conditions d'utilisation</span> et la <span className="text-black font-medium border-b border-gray-300 pb-0.5">Politique de confidentialité</span>.
                            <br/><br/>
                            <span className="text-gray-400 text-sm block mt-2">Je comprends que l'IA est un outil d'apprentissage, pas un moyen de triche. L'intégrité académique est ma responsabilité.</span>
                        </label>
                    </div>
                </div>

                <div className="pt-8">
                    <Button onClick={handleFinish} disabled={!accepted} className="w-full h-14 bg-black hover:bg-neutral-800 text-white rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                        Activer l'accès <Sparkles className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </div>
        )}

        {/* STEP 3: LOADING */}
        {step === 3 && (
            <div className="flex flex-col items-center justify-center text-center space-y-12 animate-in fade-in duration-1000">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-gray-100 border-t-black animate-spin duration-1000"></div>
                </div>
                <h3 className="text-2xl font-bold text-black tracking-tight animate-pulse">{loadingText}</h3>
            </div>
        )}

      </div>
      
      {/* Indicateur minimaliste en bas */}
      {step < 3 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex gap-4">
            {[0,1,2].map(i => (
                <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-700 ease-out ${i === step ? 'w-12 bg-black' : 'w-2 bg-gray-200'}`}
                ></div>
            ))}
        </div>
      )}

    </div>
  );
};

export default EduOnboarding;