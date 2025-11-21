import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Feather, Layout, Smartphone } from 'lucide-react';

const DocsLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-purple-500 selection:text-white">
      {/* Navbar Transparente */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-black/10 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo simplifié blanc */}
            <div className="h-9 w-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-medium text-lg tracking-wide text-white drop-shadow-md">Sivara Docs</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login?returnTo=/docs')}
              className="text-white hover:text-white hover:bg-white/20 font-medium tracking-wide rounded-full px-6"
            >
              Connexion
            </Button>
            <Button 
              onClick={() => navigate('/onboarding?returnTo=/docs')}
              className="bg-white text-black hover:bg-gray-100 font-semibold rounded-full px-8 py-6 transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)] border-2 border-transparent hover:border-white/50"
            >
              Commencer
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section Immersive */}
      <div className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        {/* Image de fond */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-in fade-in duration-1000 scale-105"
          style={{ 
            backgroundImage: 'url(/docs-hero-v2.jpg)',
            backgroundPosition: 'center center'
          }}
        >
          {/* Overlay sombre léger et uniforme pour le contraste du texte, sans dégradé blanc moche en bas */}
          <div className="absolute inset-0 bg-black/30"></div>
        </div>

        {/* Contenu Hero */}
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto mt-10">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-8 flex flex-col items-center">
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-sm font-medium shadow-lg mb-2">
              <span>La nouvelle façon d'écrire</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-white drop-shadow-2xl leading-[1.1]">
              Capturez vos idées <br/>
              <span className="font-light text-white/90">instantanément.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 font-light max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
              Un espace de travail simple et élégant qui s'adapte à votre créativité. 
              Organisez, rédigez et retrouvez tout, sans effort.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => navigate('/onboarding?returnTo=/docs')}
                className="h-16 px-12 bg-white text-black hover:bg-gray-50 text-lg rounded-full shadow-2xl transition-all duration-300 hover:-translate-y-1 font-bold group w-full sm:w-auto"
              >
                Créer mon espace
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Indicateur de scroll subtil */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/50">
          <ArrowRight className="h-6 w-6 rotate-90" />
        </div>
      </div>

      {/* Section Features "Bento Grid" style moderne */}
      <div className="py-32 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">Tout ce dont vous avez besoin,<br/>rien de superflu.</h2>
            <p className="text-xl text-gray-500 font-light">Sivara Docs supprime le bruit pour vous laisser vous concentrer sur l'essentiel : vos mots.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Feather className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Simplicité Absolue</h3>
              <p className="text-gray-500 leading-relaxed">
                Une interface épurée qui disparaît quand vous écrivez. Des outils de mise en forme intuitifs qui apparaissent juste quand il faut.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Layout className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Organisation Visuelle</h3>
              <p className="text-gray-500 leading-relaxed">
                Ne perdez plus vos notes. Rangez tout visuellement avec des couleurs et des icônes personnalisables.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Smartphone className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Toujours avec vous</h3>
              <p className="text-gray-500 leading-relaxed">
                Commencez sur votre ordinateur, finissez sur votre téléphone. Vos écrits sont synchronisés instantanément partout.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Section CTA Finale */}
      <div className="py-24 bg-white border-t border-gray-100">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-8">
            Prêt à organiser vos pensées ?
          </h2>
          <Button 
            onClick={() => navigate('/onboarding?returnTo=/docs')}
            className="h-14 px-10 bg-black hover:bg-gray-800 text-white text-lg rounded-full shadow-lg transition-all hover:scale-105"
          >
            Commencer gratuitement
          </Button>
          <p className="mt-6 text-sm text-gray-400">Aucune carte bancaire requise. Compte gratuit à vie.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 bg-gray-50 border-t border-gray-200">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">Sivara Docs</span>
            <span>&copy; 2024</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-gray-900 transition-colors">À propos</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Aide</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Confidentialité</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DocsLanding;