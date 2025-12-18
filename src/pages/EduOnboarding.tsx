import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Sparkles, Atom, Dna, BookOpen } from 'lucide-react';
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
      "Analyse du programme...",
      "Calibration des modules...",
      "Optimisation de ton parcours...",
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
        colors: ['#000000', '#FCD34D', '#ffffff'] // Noir, Jaune, Blanc
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
    <div className="min-h-screen bg-[#FFFCF5] flex flex-col items-center justify-center p-6 font-sans selection:bg-yellow-200 selection:text-black">
      
      {/* Logo Minimaliste Fixe */}
      <div className="absolute top-8 left-8 flex items-center gap-3 opacity-0 animate-in fade-in duration-1000">
         <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold border border-yellow-500/30">S</div>
         <span className="font-medium tracking-tight">Éducation</span>
      </div>

      <div className="w-full max-w-lg mx-auto">
        
        {/* STEP 0: INTRO */}
        {step === 0 && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="inline-block mb-6 p-4 bg-yellow-100/50 rounded-full border border-yellow-200/50">
                    <Sparkles className="h-8 w-8 text-yellow-600" />
                </div>
                <h1 className="text-5xl md:text-7xl font-bold text-black mb-8 tracking-tighter leading-[0.9]">
                    Maîtrisez <br/>
                    <span className="text-yellow-600">vos études.</span>
                </h1>
                <p className="text-gray-600 text-xl font-light mb-12 leading-relaxed max-w-sm mx-auto">
                    Comprendre plus vite, réviser mieux. <br/>
                    L'intelligence artificielle au service de ta réussite.
                </p>
                <Button 
                    onClick={handleNext} 
                    className="h-16 px-12 bg-black hover:bg-neutral-800 text-white rounded-full text-lg font-medium transition-all hover:scale-105 shadow-xl hover:shadow-yellow-200/50 border border-yellow-900/10"
                >
                    Commencer <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
            </div>
        )}

        {/* STEP 1: SUBJECT */}
        {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12">
                <div>
                    <h2 className="text-3xl font-bold text-black mb-3">Ton programme</h2>
                    <p className="text-gray-600 text-lg font-light">Quelle matière veux-tu approfondir ?</p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-yellow-600/80 tracking-widest pl-1">Sélection</Label>
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="h-16 text-xl bg-white/50 border-0 border-b-2 border-gray-200 rounded-none px-0 focus:ring-0 focus:border-yellow-500 transition-all font-medium">
                                <SelectValue placeholder="Choisir une matière..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-100 shadow-xl rounded-xl p-2">
                                <SelectItem value="science_st_4" className="text-base py-3 cursor-pointer focus:bg-yellow-50 rounded-lg group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-100 text-yellow-700 rounded-md group-hover:bg-yellow-200 transition-colors">
                                            <Dna className="h-5 w-5" />
                                        </div>
                                        <span>Science et Technologie (ST) - Sec 4</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="history_4" disabled className="text-base py-3 opacity-50">Histoire - Sec 4 (Bientôt)</SelectItem>
                                <SelectItem value="math_ts_5" disabled className="text-base py-3 opacity-50">Math TS - Sec 5 (Bientôt)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {subject === 'science_st_4' && (
                        <div className="flex gap-4 items-start text-gray-700 animate-in fade-in slide-in-from-top-2 pt-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100"><Atom className="h-6 w-6 text-yellow-600" /></div>
                            <div>
                                <h4 className="font-bold text-black mb-1">Programme Complet</h4>
                                <p className="text-sm leading-relaxed text-gray-500">Inclut l'Univers Matériel, Vivant, Terre et Espace. Conforme aux exigences du Ministère de l'Éducation.</p>
                            </div>
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
                    <h2 className="text-3xl font-bold text-black mb-3">Engagement</h2>
                    <p className="text-gray-600 text-lg font-light">L'intégrité est la clé de la réussite.</p>
                </div>

                <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 hover:bg-yellow-50/50 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-yellow-100" onClick={() => setAccepted(!accepted)}>
                        <Checkbox id="terms" checked={accepted} onCheckedChange={(c) => setAccepted(c as boolean)} className="mt-1 w-6 h-6 border-2 border-gray-300 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500 data-[state=checked]:text-black transition-all" />
                        <label htmlFor="terms" className="text-base text-gray-600 leading-relaxed cursor-pointer select-none">
                            J'accepte les <span className="text-black font-medium border-b border-yellow-300 pb-0.5 hover:bg-yellow-100 transition-colors">Conditions d'utilisation</span> et la <span className="text-black font-medium border-b border-yellow-300 pb-0.5 hover:bg-yellow-100 transition-colors">Politique de confidentialité</span>.
                            <br/><br/>
                            <span className="text-gray-400 text-sm block mt-2 pl-3 border-l-2 border-gray-200">
                                "Je comprends que l'IA est un outil pour apprendre et comprendre, non pour remplacer mon travail personnel."
                            </span>
                        </label>
                    </div>
                </div>

                <div className="pt-8">
                    <Button onClick={handleFinish} disabled={!accepted} className="w-full h-14 bg-black hover:bg-neutral-800 text-white rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 group">
                        Accéder à mon espace <BookOpen className="ml-2 h-5 w-5 group-hover:text-yellow-300 transition-colors" />
                    </Button>
                </div>
            </div>
        )}

        {/* STEP 3: LOADING */}
        {step === 3 && (
            <div className="flex flex-col items-center justify-center text-center space-y-12 animate-in fade-in duration-1000">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-yellow-100 border-t-black animate-spin duration-1000"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
                    </div>
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