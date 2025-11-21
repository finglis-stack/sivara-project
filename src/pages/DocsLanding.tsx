import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, FileText, Zap } from 'lucide-react';

const DocsLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-gray-900 selection:text-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-black rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <span className="font-semibold text-lg tracking-tight">Sivara Docs</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login?returnTo=/docs')}
              className="text-gray-600 hover:text-black font-medium"
            >
              Connexion
            </Button>
            <Button 
              onClick={() => navigate('/onboarding?returnTo=/docs')}
              className="bg-black hover:bg-gray-800 text-white font-medium rounded-full px-6"
            >
              S'inscrire
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section avec Image de Fond */}
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image & Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 animate-in fade-in duration-1000"
          style={{ backgroundImage: 'url(/auth-background.jpg)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/70 to-white/90 backdrop-blur-[2px]"></div>
        </div>

        {/* Contenu Hero */}
        <div className="relative z-10 container mx-auto px-6 text-center max-w-4xl pt-20">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            <span className="inline-block py-1 px-3 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-semibold tracking-wide mb-6 uppercase">
              Nouveau Standard de Sécurité
            </span>
            <h1 className="text-6xl md:text-7xl font-light tracking-tight text-gray-900 mb-8 leading-tight">
              Vos idées, <br/>
              <span className="font-semibold">réellement privées.</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
              L'éditeur de documents chiffré de bout en bout. <br/>
              Personne ne peut lire vos écrits. Pas même nous.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                onClick={() => navigate('/onboarding?returnTo=/docs')}
                className="h-14 px-8 bg-black hover:bg-gray-900 text-white text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                Commencer Gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section Minimaliste Features */}
      <div className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4 p-6 rounded-2xl hover:bg-gray-50 transition-colors duration-300">
              <div className="h-12 w-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="text-xl font-semibold">Chiffrement Militaire</h3>
              <p className="text-gray-500 leading-relaxed">
                Algorithme AES-256-GCM côté client. Vos données sont chiffrées avant même de quitter votre appareil.
              </p>
            </div>
            <div className="space-y-4 p-6 rounded-2xl hover:bg-gray-50 transition-colors duration-300">
              <div className="h-12 w-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="text-xl font-semibold">Éditeur Fluide</h3>
              <p className="text-gray-500 leading-relaxed">
                Une expérience d'écriture sans distraction, rapide et réactive, conçue pour la concentration.
              </p>
            </div>
            <div className="space-y-4 p-6 rounded-2xl hover:bg-gray-50 transition-colors duration-300">
              <div className="h-12 w-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="text-xl font-semibold">Performance Maximale</h3>
              <p className="text-gray-500 leading-relaxed">
                Accédez à vos documents instantanément, partout dans le monde. Synchronisation en temps réel.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Simple */}
      <footer className="py-8 border-t border-gray-100 text-center text-gray-400 text-sm">
        <p>&copy; {new Date().getFullYear()} Sivara. Tous droits réservés.</p>
      </footer>
    </div>
  );
};

export default DocsLanding;