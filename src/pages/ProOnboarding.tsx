import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

const ProOnboarding = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Lancer des confettis
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="animate-in zoom-in duration-700">
        <div className="w-24 h-24 bg-gradient-to-tr from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
           <CheckCircle2 size={48} className="text-white" />
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
           Bienvenue dans l'élite.
        </h1>
        
        <p className="text-xl text-gray-400 max-w-xl mx-auto mb-12 leading-relaxed">
           Votre compte Sivara Pro est maintenant actif. Votre domaine personnalisé est en cours de provisionnement et sera disponible sous 24h.
        </p>

        <Button 
            onClick={() => navigate('/profile')}
            className="h-14 px-10 bg-white text-black hover:bg-gray-100 rounded-full text-lg font-bold shadow-lg transition-all hover:scale-105"
        >
            Accéder à mon espace
            <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default ProOnboarding;