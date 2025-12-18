import { Button } from '@/components/ui/button';
import { ArrowRight, BrainCircuit, CheckSquare, TrendingUp } from 'lucide-react';
import Footer from '@/components/Footer';
import Lottie from 'lottie-react';
import catAnimation from '../../public/cat-sleeping.json';

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
    <div className="min-h-screen bg-white font-sans selection:bg-green-500 selection:text-white flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 w-full z-50 transition-all duration-300 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gray-900 text-white rounded-xl flex items-center justify-center border border-gray-800 shadow-inner">
              <span className="font-bold text-lg">É</span>
            </div>
            <span className="font-medium text-lg tracking-wide text-gray-900">Sivara Éducation</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Button 
              variant="ghost" 
              onClick={() => navigateToAuth('/login')}
              className="text-gray-700 hover:text-black hover:bg-gray-100 font-medium tracking-wide rounded-full px-6"
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
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="w-64 h-64 mx-auto">
              <Lottie animationData={catAnimation} loop={true} />
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-gray-900 mt-8 leading-tight">
              Maîtrisez vos examens.
              <br/>
              <span className="text-gray-500 font-light">(Ou pas. On vous juge pas.)</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 font-light max-w-2xl mx-auto mt-6 leading-relaxed">
              Notre IA adaptative vous aide à réviser. Pendant que vous procrastinez, elle prépare un plan d'étude. C'est presque de la triche.
            </p>
            <div className="mt-10">
              <Button 
                onClick={() => navigateToAuth('/onboarding')}
                className="h-14 px-10 bg-gray-900 text-white hover:bg-black text-lg rounded-full shadow-xl transition-all duration-300 hover:-translate-y-1 font-medium group"
              >
                Commencer à étudier (plus intelligemment)
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-gray-50 border-t border-gray-100">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">Étudiez mieux, pas plus longtemps.</h2>
            <p className="text-lg text-gray-500 font-light">Parce qu'on sait que vous préférez regarder des vidéos de chats.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <div className="bg-white p-8 rounded-3xl border border-gray-100">
              <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center mb-5">
                <BrainCircuit className="h-6 w-6 text-green-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Votre Tuteur Robot Personnel</h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Notre IA détecte vos faiblesses avec une précision chirurgicale. Un peu épeurant, mais drôlement efficace.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100">
              <div className="h-12 w-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-5">
                <CheckSquare className="h-6 w-6 text-blue-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Anti-Charabia Garanti</h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Basé sur le programme du Ministère. Pas de n'importe quoi trouvé sur un blog obscur de 2007.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100">
              <div className="h-12 w-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-5">
                <TrendingUp className="h-6 w-6 text-purple-700" />
              </div>
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