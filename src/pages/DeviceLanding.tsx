import { Button } from '@/components/ui/button';
import { 
  ArrowRight, Cpu, Wifi, Fingerprint, HardDrive, 
  Monitor, Battery, Layers, ShieldCheck, ChevronRight, Laptop
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserMenu from '@/components/UserMenu';
import { useNavigate } from 'react-router-dom';

const DeviceLanding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const navigateToAuth = (path: string) => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const returnUrl = isLocal ? 'http://localhost:8080/?app=device' : 'https://device.sivara.ca';
    
    if (isLocal) {
      window.location.href = `/?app=account&path=${path}&returnTo=${encodeURIComponent(returnUrl)}`;
    } else {
      window.location.href = `https://account.sivara.ca${path}?returnTo=${encodeURIComponent(returnUrl)}`;
    }
  };

  const handleBuy = () => {
      if (user) {
          navigate('/checkout?product=sivara_book');
      } else {
          navigateToAuth('/login');
      }
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-900 selection:text-white overflow-x-hidden">
      {/* Navbar Transparente */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/10 backdrop-blur-md border-b border-white/10 text-white">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
            <div className="h-9 w-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <span className="font-bold text-lg text-white">S</span>
            </div>
            <span className="font-medium text-lg tracking-wide drop-shadow-md">Sivara Book</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="#specs" className="text-sm font-medium text-white/80 hover:text-white transition-colors hidden sm:block shadow-sm">Spécifications</a>
            
            {user ? (
                <div className="text-black">
                    <UserMenu />
                </div>
            ) : (
                <div className="flex items-center gap-4">
                    <Button 
                    variant="ghost" 
                    onClick={() => navigateToAuth('/login')}
                    className="text-white hover:bg-white/20 font-medium"
                    >
                    Connexion
                    </Button>
                    <Button 
                    onClick={() => navigateToAuth('/onboarding')}
                    className="bg-white text-black hover:bg-gray-100 rounded-full px-6 border-2 border-transparent hover:border-white/50 transition-all"
                    >
                    Précommander
                    </Button>
                </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col justify-center pt-28 pb-20 overflow-hidden">
        {/* Background Image */}
        <div 
            className="absolute inset-0 bg-cover bg-center z-0"
            style={{ backgroundImage: 'url(/device-hero.jpg)' }}
        >
            <div className="absolute inset-0 bg-black/20"></div>
            {/* Gradient plus prononcé vers le blanc pour que le texte du bas soit lisible si besoin */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white/90"></div>
        </div>

        {/* Laptop Image - En PREMIER et PLUS PETIT */}
        <div className="relative z-10 w-full max-w-3xl mx-auto px-6 mb-8 animate-in fade-in slide-in-from-top-8 duration-1000">
            <img 
                src="/sivara-book.png" 
                alt="Sivara Book" 
                className="w-full h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700"
            />
        </div>

        {/* Text Content - En DESSOUS */}
        <div className="container mx-auto px-6 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white text-sm font-medium shadow-lg mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Disponible en précommande
            </div>
            
            {/* Texte sombre car sur fond devenant blanc, ou texte blanc avec ombre forte */}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
                La puissance brute. <br/>
                <span className="font-light text-gray-700">Sans compromis.</span>
            </h1>
            
            <p className="text-lg text-gray-600 font-medium max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-400">
                Ryzen 7 AI. Écran tactile 2.5K. Zorin OS. <br/>
                Le tout dans un châssis aluminium ultra-fin.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
                <Button 
                    onClick={handleBuy}
                    className="h-14 px-10 bg-black text-white hover:bg-gray-800 text-lg rounded-full shadow-lg transition-all hover:scale-105 font-bold"
                >
                    Commander
                    <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </div>
        </div>
      </div>

      {/* Specs Grid */}
      <div id="specs" className="py-24 bg-white relative z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
        <div className="container mx-auto px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">Ingénierie de précision.</h2>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto font-light">
                    Le Sivara Book intègre les technologies les plus avancées pour offrir une expérience fluide, sécurisée et durable.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                
                {/* CPU Card */}
                <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 space-y-4">
                        <div className="inline-flex p-3 bg-red-100 text-red-600 rounded-2xl"><Cpu className="h-8 w-8" /></div>
                        <h3 className="text-2xl font-bold text-gray-900">AMD Ryzen™ 7 8845HS</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Processeur haute performance avec moteur IA dédié (Ryzen AI). 8 Cœurs, 16 Threads, jusqu'à 5.1GHz pour le multitâche lourd et la compilation.
                        </p>
                    </div>
                    <div className="w-full md:w-1/3 bg-white rounded-2xl p-6 shadow-inner text-center border border-gray-100">
                        <div className="text-5xl font-black text-gray-900 mb-2">4<span className="text-2xl text-gray-400">nm</span></div>
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-widest">Gravure Zen 4</div>
                    </div>
                </div>

                {/* RAM/Storage Stack */}
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all h-full flex flex-col justify-center">
                        <div className="flex items-center gap-4 mb-4">
                            <Layers className="h-6 w-6 text-blue-600" />
                            <h3 className="text-lg font-bold text-gray-900">32 Go RAM</h3>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-2">DDR5 5200MHz</div>
                        <p className="text-sm text-gray-500">Bande passante ultra-large pour la virtualisation et le montage.</p>
                    </div>
                    
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all h-full flex flex-col justify-center">
                        <div className="flex items-center gap-4 mb-4">
                            <HardDrive className="h-6 w-6 text-purple-600" />
                            <h3 className="text-lg font-bold text-gray-900">512 Go SSD</h3>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-2">NVMe Gen 4</div>
                        <p className="text-sm text-gray-500">Démarrage instantané et chargement des apps en un clin d'œil.</p>
                    </div>
                </div>

                {/* Display */}
                <div className="col-span-1 lg:col-span-3 bg-black text-white p-10 rounded-3xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 to-purple-900/30 group-hover:opacity-75 transition-opacity"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="space-y-6 max-w-xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-wider">
                                <Monitor className="w-3 h-3" /> Immersion Totale
                            </div>
                            <h3 className="text-3xl md:text-5xl font-bold">16" Retina Tactile</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <div className="text-2xl font-bold mb-1">2560 x 1600</div>
                                    <div className="text-sm text-gray-400">Résolution 2.5K</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold mb-1">16:10</div>
                                    <div className="text-sm text-gray-400">Ratio Productivité</div>
                                </div>
                            </div>
                            <p className="text-gray-300 leading-relaxed">
                                Une dalle IPS lumineuse et précise, compatible tactile multipoint pour une navigation intuitive sous Zorin OS.
                            </p>
                        </div>
                        <div className="hidden md:block">
                            <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 blur-3xl opacity-50 animate-pulse"></div>
                        </div>
                    </div>
                </div>

                {/* Features Row */}
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-4 text-green-600"><Wifi className="h-6 w-6" /></div>
                    <h4 className="font-bold text-gray-900 mb-1">WIFI 6 + BT 5.2</h4>
                    <p className="text-xs text-gray-500">Connexion stable et rapide (802.11ax)</p>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-4 text-indigo-600"><Fingerprint className="h-6 w-6" /></div>
                    <h4 className="font-bold text-gray-900 mb-1">Fingerprint Unlock</h4>
                    <p className="text-xs text-gray-500">Sécurité biométrique intégrée</p>
                </div>

                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-4 text-blue-600"><ShieldCheck className="h-6 w-6" /></div>
                    <h4 className="font-bold text-gray-900 mb-1">Zorin OS</h4>
                    <p className="text-xs text-gray-500">L'élégance de Linux, la simplicité en plus</p>
                </div>
            </div>
        </div>
      </div>

      {/* OS Section */}
      <div id="os" className="py-24 bg-gray-50 relative overflow-hidden">
         <div className="container mx-auto px-6 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" /> Système d'exploitation
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                    Propulsé par <br/>
                    <span className="text-blue-600">Zorin OS.</span>
                </h2>
                <p className="text-lg text-gray-500 leading-relaxed">
                    Une alternative respectueuse de la vie privée à Windows et macOS. Rapide, puissant et sécurisé par conception. Vous gardez le contrôle total de votre machine.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200">
                        <ShieldCheck className="w-4 h-4 text-green-600" /> Open Source
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200">
                        <Battery className="w-4 h-4 text-green-600" /> Autonomie optimisée
                    </div>
                </div>
            </div>
            <div className="flex-1 w-full relative">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 aspect-video bg-gray-900 flex items-center justify-center group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#0cc0df] to-[#1e3b5a] opacity-80"></div>
                    <div className="relative z-10 text-white text-center">
                        <div className="text-6xl font-bold mb-2">Z</div>
                        <div className="text-xl tracking-widest font-light uppercase">Zorin OS</div>
                    </div>
                </div>
            </div>
         </div>
      </div>

      {/* CTA Footer */}
      <div className="py-20 bg-black text-white text-center">
        <div className="container mx-auto px-6">
            <h2 className="text-3xl md:text-5xl font-bold mb-8">Reprenez le contrôle.</h2>
            <Button 
                onClick={handleBuy}
                className="h-16 px-12 bg-white text-black hover:bg-gray-100 text-lg rounded-full shadow-lg transition-all hover:scale-105 font-bold"
            >
                Commander le Sivara Book
            </Button>
            <p className="mt-6 text-sm text-gray-500">Expédition sous 48h. Garantie 2 ans.</p>
        </div>
      </div>
    </div>
  );
};

export default DeviceLanding;