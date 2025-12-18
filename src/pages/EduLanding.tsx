import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Footer from '@/components/Footer';
import Lottie from 'lottie-react';
import gameAnimation from '../../public/game-asset.json';
import { Badge } from '@/components/ui/badge';

const EduLanding = () => {
  
  const navigateToAuth = (path: string) => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const returnUrl = isLocal ? 'http://localhost:8080/?app=edu' : 'https://edu.sivara.ca';
    
    if (isLocal) {
      window.location.href = `/?app=account&path=${path}&returnTo=${encodeURIComponent(returnUrl)}`;
    } else {
      window.location.href = `https://account.sivara.ca${path}?returnTo=${encodeURIComponent(returnUrl)}`;
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBF8] font-sans selection:bg-green-500 selection:text-white flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 w-full z-50 transition-all duration-300 bg-[#FBFBF8]/80 backdrop-blur-md border-b border-gray-200/80">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/sivara-edu-logo.png" alt="Sivara Éducation Logo" className="h-9 w-9 object-contain" />
            <span className="font-medium text-lg tracking-wide text-gray-900">Sivara Éducation</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Button 
              variant="ghost" 
              onClick={() => navigateToAuth('/login')}
              className="text-gray-700 hover:text-black hover:bg-gray-200/50 font-medium tracking-wide rounded-full px-6"
            >
              Connexion
            </Button>
            <Button 
              onClick={() => navigateToAuth('/onboarding')}
              className="bg-gray-900 text-white hover:bg-black font-semibold rounded-full px-8 py-3 transition-all hover:scale-105 shadow-lg"
            >
              Commencer
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center py-24 sm:py-32">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-center lg:text-left animate-in fade-in slide-in-from-left-8 duration-700">
              <Badge variant="outline" className="mb-6 bg-white border-gray-200 text-gray-600">Pour les examens du Ministère</Badge>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-gray-900 leading-tight">
                Maîtrisez vos révisions.
              </h1>
              <p className="text-lg md:text-xl text-gray-600 font-light max-w-xl mx-auto lg:mx-0 mt-6 leading-relaxed">
                Notre IA adaptative vous aide à vous préparer pour vos examens. Pendant que vous procrastinez, elle prépare un plan d'étude personnalisé.
              </p>
              <div className="mt-10">
                <Button 
                  onClick={() => navigateToAuth('/onboarding')}
                  className="h-14 px-10 bg-gray-900 text-white hover:bg-black text-lg rounded-full shadow-xl transition-all duration-300 hover:-translate-y-1 font-medium group"
                >
                  Commencer gratuitement
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
            <div className="w-full max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-700 delay-200">
              <Lottie animationData={gameAnimation} loop={true} />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white border-y border-gray-100">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">Étudiez mieux, pas plus longtemps.</h2>
            <p className="text-lg text-gray-500 font-light">Parce qu'on sait que vous préférez regarder des vidéos de chats.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <div className="bg-gray-50/80 p-8 rounded-3xl border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Votre Tuteur Robot Personnel</h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Notre IA détecte vos faiblesses avec une précision chirurgicale. Un peu épeurant, mais drôlement efficace.
              </p>
            </div>

            <div className="bg-gray-50/80 p-8 rounded-3xl border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Anti-Charabia Garanti</h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Basé sur le programme du Ministère. Pas de n'importe quoi trouvé sur un blog obscur de 2007.
              </p>
            </div>

            <div className="bg-gray-50/80 p-8 rounded-3xl border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Des Graphiques Qui Montent</h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Visualisez votre progression. Idéal pour se vanter auprès de vos parents (ou pour réaliser l'ampleur du désastre).
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default EduLanding;