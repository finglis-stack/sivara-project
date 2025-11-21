import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Zap, Lock } from 'lucide-react';

const DocsLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-black selection:text-white">
      {/* Navbar Transparente */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/20 backdrop-blur-sm transition-all duration-300">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-white rounded-lg flex items-center justify-center text-black font-bold shadow-lg">S</div>
            <span className="font-medium text-lg tracking-wide text-white drop-shadow-md">Sivara Docs</span>
          </div>
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login?returnTo=/docs')}
              className="text-white hover:text-white hover:bg-white/10 font-medium tracking-wide"
            >
              Connexion
            </Button>
            <Button 
              onClick={() => navigate('/onboarding?returnTo=/docs')}
              className="bg-white text-black hover:bg-gray-100 font-medium rounded-full px-8 py-6 transition-transform hover:scale-105 shadow-xl"
            >
              Commencer
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section Immersive */}
      <div className="relative h-screen w-full overflow-hidden">
        {/* Image de fond */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-in fade-in duration-1000 scale-105"
          style={{ 
            backgroundImage: 'url(/docs-hero.jpg)',
            backgroundPosition: 'center 40%' 
          }}
        >
          {/* Overlay dégradé subtil pour la lisibilité */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-white"></div>
        </div>

        {/* Contenu Hero */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 pt-20">
          <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 space-y-8">
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium mb-4 shadow-lg">
              <Lock className="w-3 h-3" />
              <span>Chiffré de bout en bout</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tight text-white drop-shadow-xl leading-[1.1]">
              L'écriture <br/>
              <span className="font-medium">sans compromis.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 font-light max-w-2xl mx-auto leading-relaxed drop-shadow-md">
              L'endroit le plus sûr pour vos pensées. <br className="hidden md:block"/>
              Un éditeur minimaliste, puissant et totalement privé.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                onClick={() => navigate('/onboarding?returnTo=/docs')}
                className="h-16 px-10 bg-white text-black hover:bg-gray-50 text-lg rounded-full shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:-translate-y-1 font-medium group"
              >
                Créer un document
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section Features Ultra-Minimaliste */}
      <div className="py-32 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 max-w-6xl mx-auto">
            
            <div className="group space-y-6">
              <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors duration-500">
                <Shield className="h-8 w-8 stroke-[1.5]" />
              </div>
              <h3 className="text-2xl font-medium tracking-tight text-gray-900">Sécurité Absolue</h3>
              <p className="text-gray-500 text-lg font-light leading-relaxed">
                Vos documents sont chiffrés sur votre appareil avant d'être sauvegardés. Personne d'autre que vous ne possède la clé.
              </p>
            </div>

            <div className="group space-y-6">
              <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors duration-500">
                <Zap className="h-8 w-8 stroke-[1.5]" />
              </div>
              <h3 className="text-2xl font-medium tracking-tight text-gray-900">Vitesse Pure</h3>
              <p className="text-gray-500 text-lg font-light leading-relaxed">
                Conçu pour être instantané. Synchronisation en temps réel, chargement immédiat, frappe sans latence.
              </p>
            </div>

            <div className="group space-y-6">
              <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors duration-500">
                <Lock className="h-8 w-8 stroke-[1.5]" />
              </div>
              <h3 className="text-2xl font-medium tracking-tight text-gray-900">Privé par Design</h3>
              <p className="text-gray-500 text-lg font-light leading-relaxed">
                Pas de tracking, pas de publicité, pas d'analyse de données. Juste vous et vos mots.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Footer Épuré */}
      <footer className="py-12 border-t border-gray-100">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-400 font-light">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">Sivara Docs</span>
            <span>&copy; 2024</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-gray-900 transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Conditions</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DocsLanding;