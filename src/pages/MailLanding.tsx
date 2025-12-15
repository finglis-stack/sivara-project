import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Zap, Inbox, Lock } from 'lucide-react';
import Footer from '@/components/Footer';

const MailLanding = () => {
  
  const navigateToAuth = (path: string) => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const returnUrl = isLocal ? 'http://localhost:8080/?app=mail' : 'https://mail.sivara.ca';
    
    if (isLocal) {
      window.location.href = `/?app=account&path=${path}&returnTo=${encodeURIComponent(returnUrl)}`;
    } else {
      window.location.href = `https://account.sivara.ca${path}?returnTo=${encodeURIComponent(returnUrl)}`;
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-orange-500 selection:text-white flex flex-col">
      {/* Navbar Transparente */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-black/10 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-medium text-lg tracking-wide text-white drop-shadow-md">Sivara Mail</span>
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
              Créer une adresse
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section Immersive */}
      <div className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-in fade-in duration-1000 scale-105"
          style={{ 
            backgroundImage: 'url(/mail-hero.jpg)',
            backgroundPosition: 'center center'
          }}
        >
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto mt-10">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-8 flex flex-col items-center">
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-sm font-medium shadow-lg mb-2">
              <Lock className="w-3 h-3 text-orange-300" />
              <span>Chiffrement de bout en bout</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-white drop-shadow-2xl leading-[1.1]">
              Réinventez vos <br/>
              <span className="font-light text-white/90">échanges.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 font-light max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
              Une boîte de réception intelligente, sécurisée et épurée. 
              Zéro publicité, 100% privé, conçu pour la tranquillité d'esprit.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => navigateToAuth('/onboarding')}
                className="h-16 px-12 bg-white text-black hover:bg-gray-50 text-lg rounded-full shadow-2xl transition-all duration-300 hover:-translate-y-1 font-bold group w-full sm:w-auto"
              >
                Sécuriser mes emails
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-32 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">Le calme après la tempête.</h2>
            <p className="text-xl text-gray-500 font-light">Nous avons supprimé tout ce qui n'était pas un email. Adieu trackers, publicités et algorithmes intrusifs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-7 w-7 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Sécurité Totale</h3>
              <p className="text-gray-500 leading-relaxed">
                Vos emails sont chiffrés avant même de quitter votre appareil. Nous ne pouvons pas les lire, même si nous le voulions.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Inbox className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Zéro Distraction</h3>
              <p className="text-gray-500 leading-relaxed">
                Une interface Zen qui vous aide à atteindre l'Inbox Zero. Filtres intelligents et tri automatique inclus.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="h-14 w-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Ultra Rapide</h3>
              <p className="text-gray-500 leading-relaxed">
                Construit sur notre infrastructure Edge globale. Vos emails arrivent instantanément, où que vous soyez.
              </p>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MailLanding;