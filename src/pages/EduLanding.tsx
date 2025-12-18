import { Button } from '@/components/ui/button';
import { ArrowRight, BrainCircuit, CheckSquare, TrendingUp } from 'lucide-react';
import Footer from '@/components/Footer';

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
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-black/10 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-white font-bold text-lg">É</span>
            </div>
            <span className="font-medium text-lg tracking-wide text-white drop-shadow-md">Sivara Éducation</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Button 
              variant="ghost" 
              onClick={() => navigateToAuth('/login')}
              className="text-white hover:text-white hover:bg-white/20 font-medium tracking-wide rounded-full px-6"
            >
              Connexion
            </Button>
            <Button 
              onClick={() => navigateToAuth('/onboarding')}
              className="bg-white text-black hover:bg-gray-100 font-semibold rounded-full px-8 py-6 transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)] border-2 border-transparent hover:border-white/50"
            >
              Commencer
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-in fade-in duration-1000 scale-105"
          style={{ backgroundImage: 'url(/edu-hero.jpg)' }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto mt-10">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-8 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-sm font-medium shadow-lg mb-2">
              <span>100% Gratuit • Basé sur la science</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-white drop-shadow-2xl leading-[1.1]">
              Maîtrisez vos examens.
              <br/>
              <span className="font-light text-white/90">La révision intelligente.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 font-light max-w-3xl mx-auto leading-relaxed drop-shadow-lg">
              Une plateforme d'étude gratuite et adaptative, conçue pour les examens ministériels du Québec. Ciblez vos faiblesses, maximisez vos forces.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => navigateToAuth('/onboarding')}
                className="h-16 px-12 bg-white text-black hover:bg-gray-50 text-lg rounded-full shadow-2xl transition-all duration-300 hover:-translate-y-1 font-bold group w-full sm:w-auto"
              >
                Commencer à réviser
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-32 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">Étudiez mieux, pas plus.</h2>
            <p className="text-xl text-gray-500 font-light">Notre système analyse vos réponses pour créer un plan de révision sur mesure qui s'adapte à vous en temps réel.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <BrainCircuit className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Apprentissage Adaptatif</h3>
              <p className="text-gray-500 leading-relaxed">
                L'algorithme identifie vos lacunes et vous propose des exercices ciblés pour renforcer vos connaissances là où ça compte.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <CheckSquare className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Contenu Officiel</h3>
              <p className="text-gray-500 leading-relaxed">
                Des milliers de questions basées sur le programme du Ministère de l'Éducation du Québec. Conforme et à jour.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Suivi de Progrès</h3>
              <p className="text-gray-500 leading-relaxed">
                Visualisez votre progression, identifiez vos points forts et suivez votre préparation jusqu'au jour de l'examen.
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