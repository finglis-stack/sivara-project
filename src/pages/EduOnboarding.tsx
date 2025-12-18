import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Sparkles, Atom, Dna, BookOpen, Rocket } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import confetti from 'canvas-confetti';

const EduOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: Intro, 1: Subject, 2: Terms, 3: Loading
  const [subject, setSubject] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loadingText, setLoadingText] = useState('Initialisation du parcours...');

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
      "Calibrage des propulseurs...",
      "Chargement du programme...",
      "Trajectoire calculée...",
      "Décollage."
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
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#3B82F6', '#ffffff', '#FCD34D']
      });

      setTimeout(() => {
          navigate('/?app=edu&path=/dash');
      }, 1000);

    } catch (e: any) {
      showError(e.message);
      setStep(2);
    }
  };

  const isScienceSelected = subject === 'science_st_4';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans text-white relative overflow-hidden selection:bg-white/30 selection:text-white">
      
      {/* BACKGROUND DYNAMIQUE */}
      <div className="absolute inset-0 z-0 bg-black overflow-hidden">
          {/* Layer Vidéo (Science - Cyclone) */}
          <div className={`absolute inset-0 transition-opacity duration-1000 ${isScienceSelected ? 'opacity-100' : 'opacity-0'}`}>
              <video 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: 'brightness(0.6) blur(2px) contrast(1.1)' }}
              >
                  <source src="/science-bg.mp4" type="video/mp4" />
              </video>
          </div>

          {/* Layer Image (Défaut - Canard) */}
          <div 
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${!isScienceSelected ? 'opacity-100' : 'opacity-0'}`}
              style={{ 
                  backgroundImage: 'url(/default-edu-bg.jpg)',
                  backgroundPosition: 'center 35%', // Ajustement vertical pour le canard
                  filter: 'brightness(0.5)' // Assombri pour le texte blanc
              }}
          />
          
          {/* Overlay global pour garantir la lisibilité du texte blanc */}
          <div className="absolute inset-0 bg-black/30"></div>
      </div>

      {/* Logo Minimaliste Fixe */}
      <div className="absolute top-8 left-8 flex items-center gap-3 animate-in fade-in duration-1000 z-20">
         <img src="/sivara-education.png" alt="Sivara Éducation" className="w-8 h-8 object-contain drop-shadow-md" />
         <span className="font-medium tracking-tight text-white/90">Sivara Éducation</span>
      </div>

      <div className="w-full max-w-lg mx-auto z-10 relative">
        
        {/* STEP 0: INTRO */}
        {step === 0 && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tighter leading-[0.9] drop-shadow-xl text-white">
                    L'excellence <br/>
                    <span className="text-blue-300">académique.</span>
                </h1>
                <p className="text-xl text-white/90 font-light mb-12 leading-relaxed max-w-sm mx-auto drop-shadow-md">
                    Une approche structurée pour maximiser votre réussite scolaire. <br/>
                    L'intelligence artificielle au service de votre potentiel.
                </p>
                <Button 
                    onClick={handleNext} 
                    className="h-16 px-12 rounded-full text-lg font-medium transition-all hover:scale-105 shadow-xl bg-white text-black hover:bg-gray-100 border-0"
                >
                    Commencer <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
            </div>
        )}

        {/* STEP 1: SUBJECT */}
        {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12">
                <div>
                    <h2 className="text-3xl font-bold mb-3 drop-shadow-md text-white">Votre mission</h2>
                    <p className="text-lg text-white/80 font-light">Quelle matière voulez-vous maîtriser ?</p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold tracking-widest pl-1 text-white/70">Programme</Label>
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="h-16 text-xl bg-white/10 backdrop-blur-md border-0 border-b-2 border-white/30 rounded-none px-4 focus:ring-0 focus:border-white transition-all font-medium text-white hover:bg-white/20">
                                <SelectValue placeholder="Sélectionner une matière..." />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 shadow-xl rounded-xl p-2 text-white">
                                <SelectItem value="science_st_4" className="text-base py-3 cursor-pointer focus:bg-blue-900/50 focus:text-white rounded-lg group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-md">
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
                    
                    {isScienceSelected && (
                        <div className="flex gap-4 items-start animate-in fade-in slide-in-from-top-2 pt-4 bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-lg text-white">
                            <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30"><Atom className="h-6 w-6 text-blue-300" /></div>
                            <div>
                                <h4 className="font-bold mb-1">Programme Complet</h4>
                                <p className="text-sm leading-relaxed text-gray-300">Couvre l'Univers Matériel, Vivant, Terre et Espace. Conforme aux exigences du Ministère de l'Éducation du Québec.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-8">
                    <Button 
                        onClick={handleNext} 
                        disabled={!subject} 
                        className="w-full h-14 rounded-full text-lg font-medium transition-all bg-white text-black hover:bg-gray-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Suivant
                    </Button>
                </div>
            </div>
        )}

        {/* STEP 2: TERMS */}
        {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12">
                <div>
                    <h2 className="text-3xl font-bold mb-3 drop-shadow-md text-white">Code d'honneur</h2>
                    <p className="text-lg text-white/80 font-light">L'intégrité est la base de l'apprentissage.</p>
                </div>

                <div className="space-y-6">
                    <div className="flex items-start gap-4 p-5 rounded-xl transition-colors cursor-pointer border bg-white/10 border-white/10 hover:bg-white/20 backdrop-blur-md" onClick={() => setAccepted(!accepted)}>
                        <Checkbox 
                            id="terms" 
                            checked={accepted} 
                            onCheckedChange={(c) => setAccepted(c as boolean)} 
                            className="mt-1 w-6 h-6 border-2 border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-black transition-all" 
                        />
                        <label htmlFor="terms" className="text-base text-gray-200 leading-relaxed cursor-pointer select-none">
                            Je m'engage à respecter les <span className="text-white font-semibold border-b border-white/30 pb-0.5 hover:border-white transition-colors">Conditions d'utilisation</span>.
                            <br/><br/>
                            <span className="text-gray-400 text-sm block mt-2 pl-3 border-l-2 border-white/20 italic">
                                "Je comprends que cet outil est conçu pour m'aider à comprendre et apprendre, et non pour effectuer le travail à ma place."
                            </span>
                        </label>
                    </div>
                </div>

                <div className="pt-8">
                    <Button 
                        onClick={handleFinish} 
                        disabled={!accepted} 
                        className="w-full h-14 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white text-black hover:bg-gray-200 disabled:opacity-50"
                    >
                        Accéder à mon espace <Sparkles className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </div>
        )}

        {/* STEP 3: LOADING */}
        {step === 3 && (
            <div className="flex flex-col items-center justify-center text-center space-y-12 animate-in fade-in duration-1000">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-white animate-spin duration-1000"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Rocket className="h-8 w-8 text-white animate-pulse" />
                    </div>
                </div>
                <h3 className="text-2xl font-bold tracking-tight animate-pulse text-white drop-shadow-md">{loadingText}</h3>
            </div>
        )}

      </div>
      
      {/* Indicateur minimaliste en bas */}
      {step < 3 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex gap-4 z-20">
            {[0,1,2].map(i => (
                <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-700 ease-out ${
                        i === step 
                            ? 'w-12 bg-white' 
                            : 'w-2 bg-white/20'
                    }`}
                ></div>
            ))}
        </div>
      )}

    </div>
  );
};

export default EduOnboarding;