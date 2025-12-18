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

  const isSpaceTheme = subject === 'science_st_4';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 font-sans transition-all duration-1000 ease-in-out relative overflow-hidden ${isSpaceTheme ? 'text-white' : 'bg-white text-black'}`}>
      
      {/* BACKGROUND DYNAMIQUE */}
      <div className="absolute inset-0 z-0 bg-black overflow-hidden">
          {/* Layer Vidéo (Science) */}
          <div className={`absolute inset-0 transition-opacity duration-1000 ${isSpaceTheme ? 'opacity-100' : 'opacity-0'}`}>
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

          {/* Layer Image (Défaut/Canard) */}
          <div 
              className={`absolute inset-0 bg-cover transition-opacity duration-1000 ${!isSpaceTheme ? 'opacity-100' : 'opacity-0'}`}
              style={{ 
                  backgroundImage: 'url(/default-edu-bg.jpg)',
                  backgroundPosition: 'center 35%', // Image descendue légèrement
                  filter: 'brightness(0.7)'
              }}
          />

          {/* Overlay global pour uniformiser */}
          <div className="absolute inset-0 bg-black/20"></div>
          
          {/* Overlay sombre additionnel pour le mode science (lisibilité) */}
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-1000 ${isSpaceTheme ? 'opacity-100' : 'opacity-0'}`}></div>
      </div>

      {/* Logo Minimaliste Fixe */}
      <div className="absolute top-8 left-8 flex items-center gap-3 animate-in fade-in duration-1000 z-20">
         <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold border backdrop-blur-md ${isSpaceTheme ? 'bg-white/10 border-white/20 text-white' : 'bg-black border-transparent text-white'}`}>S</div>
         <span className={`font-medium tracking-tight ${isSpaceTheme ? 'text-white/80' : 'text-black'}`}>Éducation</span>
      </div>

      <div className="w-full max-w-lg mx-auto z-10 relative">
        
        {/* STEP 0: INTRO */}
        {step === 0 && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tighter leading-[0.9]">
                    L'excellence <br/>
                    <span className={isSpaceTheme ? 'text-blue-300' : 'text-gray-400'}>académique.</span>
                </h1>
                <p className={`text-xl font-light mb-12 leading-relaxed max-w-sm mx-auto ${isSpaceTheme ? 'text-gray-300' : 'text-gray-500'}`}>
                    Une approche structurée pour maximiser votre réussite scolaire. <br/>
                    L'intelligence artificielle au service de votre potentiel.
                </p>
                <Button 
                    onClick={handleNext} 
                    className={`h-16 px-12 rounded-full text-lg font-medium transition-all hover:scale-105 shadow-xl ${isSpaceTheme ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-neutral-800'}`}
                >
                    Commencer <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
            </div>
        )}

        {/* STEP 1: SUBJECT */}
        {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12">
                <div>
                    <h2 className="text-3xl font-bold mb-3">Votre mission</h2>
                    <p className={`text-lg font-light ${isSpaceTheme ? 'text-gray-300' : 'text-gray-500'}`}>Quelle matière voulez-vous maîtriser ?</p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className={`text-xs uppercase font-bold tracking-widest pl-1 ${isSpaceTheme ? 'text-blue-300/80' : 'text-gray-400'}`}>Programme</Label>
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className={`h-16 text-xl border-0 border-b-2 rounded-none px-0 focus:ring-0 transition-all font-medium ${isSpaceTheme ? 'bg-transparent border-white/30 text-white focus:border-white' : 'bg-transparent border-gray-100 text-black focus:border-black'}`}>
                                <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-100 shadow-xl rounded-xl p-2 text-black">
                                <SelectItem value="science_st_4" className="text-base py-3 cursor-pointer focus:bg-blue-50 rounded-lg group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 text-blue-700 rounded-md group-hover:bg-blue-200 transition-colors">
                                            <Rocket className="h-5 w-5" />
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
                        <div className="flex gap-4 items-start animate-in fade-in slide-in-from-top-2 pt-4 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-lg text-white">
                            <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30"><Dna className="h-6 w-6 text-blue-300" /></div>
                            <div>
                                <h4 className="font-bold mb-1">Programme Complet</h4>
                                <p className="text-sm leading-relaxed text-gray-300">Inclut l'Univers Matériel, Vivant, Terre et Espace. Conforme au programme du Ministère.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-8">
                    <Button 
                        onClick={handleNext} 
                        disabled={!subject} 
                        className={`w-full h-14 rounded-full text-lg font-medium transition-all ${isSpaceTheme ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-neutral-800'}`}
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
                    <h2 className="text-3xl font-bold mb-3">Le pacte</h2>
                    <p className={`text-lg font-light ${isSpaceTheme ? 'text-gray-300' : 'text-gray-500'}`}>Promettez-nous d'utiliser ce pouvoir pour le bien.</p>
                </div>

                <div className="space-y-6">
                    <div className={`flex items-start gap-4 p-4 rounded-xl transition-colors cursor-pointer border ${isSpaceTheme ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'hover:bg-gray-50 border-transparent'}`} onClick={() => setAccepted(!accepted)}>
                        <Checkbox 
                            id="terms" 
                            checked={accepted} 
                            onCheckedChange={(c) => setAccepted(c as boolean)} 
                            className={`mt-1 w-6 h-6 border-2 transition-all ${isSpaceTheme ? 'border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-black' : 'border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-white'}`} 
                        />
                        <label htmlFor="terms" className={`text-base leading-relaxed cursor-pointer select-none ${isSpaceTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                            J'accepte les <span className={`font-medium border-b pb-0.5 transition-colors ${isSpaceTheme ? 'text-white border-white/50 hover:bg-white/10' : 'text-black border-gray-300 hover:bg-gray-100'}`}>Conditions d'utilisation</span>.
                            <br/><br/>
                            <span className={`text-sm block mt-2 ${isSpaceTheme ? 'text-gray-400' : 'text-gray-400'}`}>
                                "Je comprends que l'IA est un outil d'apprentissage, pas un moyen de triche. L'intégrité académique est ma responsabilité."
                            </span>
                        </label>
                    </div>
                </div>

                <div className="pt-8">
                    <Button 
                        onClick={handleFinish} 
                        disabled={!accepted} 
                        className={`w-full h-14 rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 ${isSpaceTheme ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-neutral-800'}`}
                    >
                        Activer l'accès <Sparkles className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </div>
        )}

        {/* STEP 3: LOADING */}
        {step === 3 && (
            <div className="flex flex-col items-center justify-center text-center space-y-12 animate-in fade-in duration-1000">
                <div className="relative">
                    <div className={`w-24 h-24 rounded-full border-4 animate-spin duration-1000 ${isSpaceTheme ? 'border-white/20 border-t-white' : 'border-gray-100 border-t-black'}`}></div>
                </div>
                <h3 className="text-2xl font-bold tracking-tight animate-pulse">{loadingText}</h3>
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
                            ? (isSpaceTheme ? 'w-12 bg-white' : 'w-12 bg-black') 
                            : (isSpaceTheme ? 'w-2 bg-white/20' : 'w-2 bg-gray-200')
                    }`}
                ></div>
            ))}
        </div>
      )}

    </div>
  );
};

export default EduOnboarding;