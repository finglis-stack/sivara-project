import { Button } from '@/components/ui/button';
import { 
  ArrowRight, ShieldCheck, ChevronRight, Laptop, Package, Check, X, Loader2,
  Filter, Search, ArrowLeft, Shuffle, Database, Lock, Zap, Layers, Command, CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserMenu from '@/components/UserMenu';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import confetti from 'canvas-confetti';
import DeviceOrderSuccess from '@/components/DeviceOrderSuccess';

// --- TYPES ---
interface RawUnit {
  id: string;
  unit_price: number;
  condition: string;
  serial_number: string;
  specific_specs: {
    ram_size: string;
    storage: string;
    [key: string]: any;
  };
  product: {
    id: string;
    name: string;
    image_url: string;
  };
}

const DeviceLanding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isVendor, setIsVendor] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  
  // --- CONFIGURATOR STATE ---
  const [showConfig, setShowConfig] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  
  // --- SUCCESS STATE (FULL PAGE) ---
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  // Data
  const [allUnits, setAllUnits] = useState<RawUnit[]>([]);
  const [products, setProducts] = useState<{id: string, name: string, image_url: string}[]>([]);
  
  // Navigation State inside Modal
  const [step, setStep] = useState<'category' | 'selection' | 'search'>('category');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Search Filters
  const [filters, setFilters] = useState({
      ram: 'all',
      storage: 'all',
      search: ''
  });

  useEffect(() => {
    if (user) {
        supabase.from('profiles').select('is_vendor').eq('id', user.id).single()
        .then(({ data }) => { if (data?.is_vendor) setIsVendor(true); });
    }
  }, [user]);

  // Handle Stripe Return
  useEffect(() => {
      const successParam = searchParams.get('order_success');
      const sessionId = searchParams.get('session_id');
      
      if (successParam) {
          // Switch to Full Page Success
          setShowOrderSuccess(true);
          setOrderId(sessionId || `SIV-${Date.now().toString().slice(-6)}`);
          
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#000000', '#ffffff', '#3b82f6']
          });
      }
  }, [searchParams]);

  // --- ALGORITHMES & LOGIQUE ---

  const shuffleArray = (array: any[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const fetchInventory = async () => {
      setLoadingInventory(true);
      setStep('category');
      setSelectedProductId(null);
      setSelectedUnitId(null);

      const { data, error } = await supabase
        .from('device_units')
        .select(`
            id, 
            unit_price, 
            condition, 
            serial_number,
            specific_specs,
            product:product_id (id, name, image_url)
        `)
        .eq('status', 'available');

      if (data) {
          setAllUnits(data as any[]);
          
          const uniqueProducts = new Map();
          data.forEach((unit: any) => {
              if (unit.product && !uniqueProducts.has(unit.product.id)) {
                  uniqueProducts.set(unit.product.id, unit.product);
              }
          });
          setProducts(Array.from(uniqueProducts.values()));

          if (uniqueProducts.size === 1) {
              const prodId = Array.from(uniqueProducts.keys())[0];
              setSelectedProductId(prodId);
              setStep('selection');
          }
      }
      setLoadingInventory(false);
  };

  const getSmartUnits = useMemo(() => {
      if (!selectedProductId) return [];
      const productUnits = allUnits.filter(u => u.product.id === selectedProductId);
      const shuffled = shuffleArray(productUnits);
      const selected: RawUnit[] = [];
      const seenSpecs = new Set<string>();

      for (const unit of shuffled) {
          if (selected.length >= 5) break;
          const specKey = `${unit.specific_specs.ram_size}-${unit.specific_specs.storage}-${unit.condition}`;
          if (!seenSpecs.has(specKey)) {
              selected.push(unit);
              seenSpecs.add(specKey);
          }
      }

      if (selected.length < 5) {
          for (const unit of shuffled) {
              if (selected.length >= 5) break;
              if (!selected.find(s => s.id === unit.id)) {
                  selected.push(unit);
              }
          }
      }
      return selected;
  }, [allUnits, selectedProductId, showConfig]);

  const getFilteredUnits = useMemo(() => {
      if (!selectedProductId) return [];
      return allUnits.filter(u => {
          if (u.product.id !== selectedProductId) return false;
          if (filters.ram !== 'all' && u.specific_specs.ram_size !== filters.ram) return false;
          if (filters.storage !== 'all' && u.specific_specs.storage !== filters.storage) return false;
          if (filters.search && !u.serial_number.toLowerCase().includes(filters.search.toLowerCase())) return false;
          return true;
      });
  }, [allUnits, selectedProductId, filters]);

  // --- ACTIONS ---

  const handleOpenConfig = () => {
      setShowConfig(true);
      fetchInventory();
  };

  const handleSelectProduct = (prodId: string) => {
      setSelectedProductId(prodId);
      setStep('selection');
  };

  const handleProceedToCheckout = async () => {
      if (!selectedUnitId) return;
      setIsReserving(true);

      try {
          // --- RESERVATION ATOMIQUE ---
          const { data: success, error } = await supabase.rpc('reserve_device', { unit_uuid: selectedUnitId });
          
          if (error) throw error;

          if (success) {
              showSuccess("Appareil réservé pour 5 minutes");
              navigate(`/checkout?unit_id=${selectedUnitId}`);
          } else {
              showError("Désolé, cet appareil vient d'être pris.");
              fetchInventory(); // Rafraîchir
          }
      } catch (e) {
          console.error(e);
          showError("Erreur de réservation");
      } finally {
          setIsReserving(false);
      }
  };

  const getMonthlyPrice = (price: number) => {
      const taxes = price * 0.14975;
      const total = price + taxes;
      const upfront = total * 0.20;
      const remainder = total - upfront;
      return (remainder / 16).toFixed(2);
  };

  const navigateToAuth = (path: string) => {
    const returnUrl = 'https://device.sivara.ca';
    window.location.href = `https://account.sivara.ca${path}?returnTo=${encodeURIComponent(returnUrl)}`;
  };

  const handleBackFromSuccess = () => {
      // Nettoie l'URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('order_success');
      newParams.delete('session_id');
      setSearchParams(newParams);
      setShowOrderSuccess(false);
      navigate('/?app=device');
  };

  // --- CONDITIONAL RENDER: SUCCESS PAGE ---
  if (showOrderSuccess && orderId) {
      return <DeviceOrderSuccess orderId={orderId} onBack={handleBackFromSuccess} />;
  }

  return (
    <div className="min-h-screen bg-black font-sans selection:bg-white selection:text-black overflow-x-hidden text-white">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
            <div className="h-9 w-9 bg-white rounded-xl flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              <span className="font-bold text-lg text-black">S</span>
            </div>
            <span className="font-medium text-lg tracking-wide">Sivara Book</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            {isVendor && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate('/admin')}
                    className="text-white hover:bg-white/20 hover:text-white transition-colors hidden sm:flex"
                >
                    <Package className="h-4 w-4 mr-2" /> Espace Vendeur
                </Button>
            )}

            {user ? (
                <UserMenu />
            ) : (
                <div className="flex items-center gap-4">
                    <Button 
                    variant="ghost" 
                    onClick={() => navigateToAuth('/login')}
                    className="text-white hover:bg-white/10 font-medium"
                    >
                    Connexion
                    </Button>
                    <Button 
                    onClick={() => navigateToAuth('/onboarding')}
                    className="bg-white text-black hover:bg-gray-200 rounded-full px-6 transition-all font-bold"
                    >
                    Précommander
                    </Button>
                </div>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        
        {/* COURBES ANIMÉES (BACKGROUND) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[40%] -left-[10%] w-[120%] h-[50vh] rounded-[100%] border-t-[2px] border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)] animate-wave-undulate opacity-80"></div>
            <div className="absolute top-[42%] -left-[10%] w-[120%] h-[50vh] rounded-[100%] border-t-[1px] border-cyan-400/30 blur-[2px] animate-wave-undulate-slow opacity-60"></div>
            <div className="absolute top-[38%] -left-[10%] w-[120%] h-[50vh] rounded-[100%] bg-gradient-to-b from-blue-900/10 to-transparent blur-3xl animate-wave-undulate opacity-30"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 py-12">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">
                <div className="flex-1 text-center lg:text-left space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000 relative">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/90 text-sm font-medium shadow-2xl">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                        Design Industriel
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] drop-shadow-2xl">
                        Sivara Book. <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">L'Art de la Puissance.</span>
                    </h1>
                    
                    <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                        Conçu pour ceux qui refusent les compromis. <br/>
                        Disponible en abonnement tout inclus.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                        <Button 
                            onClick={handleOpenConfig}
                            className="h-16 px-12 bg-white text-black hover:bg-gray-200 text-lg rounded-full transition-all hover:scale-105 font-bold shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                        >
                            Choisir mon modèle
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 relative w-full max-w-lg lg:max-w-xl animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] bg-gradient-to-tr from-blue-500/10 to-purple-500/5 blur-[90px] rounded-full pointer-events-none"></div>
                    <img 
                        src="/sivara-book.png" 
                        alt="Sivara Book" 
                        className="relative w-full h-auto object-contain drop-shadow-2xl transform hover:scale-[1.02] transition-transform duration-700"
                    />
                </div>
            </div>
        </div>
      </div>

      {/* ZORIN OS SECTION (DYNAMIQUE & STYLÉ) */}
      <section className="py-32 bg-[#050505] relative overflow-hidden">
         {/* Background Glows */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
             <div className="absolute top-1/4 right-0 w-[800px] h-[800px] bg-[#0cc0df]/10 rounded-full blur-[120px]"></div>
             <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#1e3b5a]/20 rounded-full blur-[100px]"></div>
         </div>

         <div className="container mx-auto px-6 relative z-10">
             
             <div className="text-center max-w-4xl mx-auto mb-24">
                 <div className="inline-block mb-6">
                    <span className="text-[#0cc0df] font-bold tracking-widest uppercase text-sm border border-[#0cc0df]/30 px-4 py-2 rounded-full bg-[#0cc0df]/5">Système d'Exploitation</span>
                 </div>
                 <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight">
                    Libérez votre ordinateur.<br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0cc0df] to-white">Propulsé par Zorin OS.</span>
                 </h2>
                 <p className="text-xl text-gray-400 leading-relaxed font-light">
                    Une alternative puissante, respectueuse de la vie privée et conçue pour la vitesse. 
                    Fini les mises à jour forcées, la télémétrie et les lenteurs inexpliquées.
                 </p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 
                 {/* Card 1 : Privacy */}
                 <div className="group relative bg-white/5 border border-white/10 rounded-[2rem] p-10 overflow-hidden hover:bg-white/10 transition-all duration-500">
                     <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                         <Lock size={120} />
                     </div>
                     <div className="relative z-10 h-full flex flex-col justify-end min-h-[300px]">
                         <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                             <ShieldCheck className="text-white w-7 h-7" />
                         </div>
                         <h3 className="text-3xl font-bold mb-3">Privé par défaut.</h3>
                         <p className="text-gray-400 leading-relaxed">
                             Sivara et Zorin OS ne collectent pas vos données personnelles. Pas de publicité ciblée, pas de mouchards. C'est votre machine.
                         </p>
                     </div>
                 </div>

                 {/* Card 2 : Speed */}
                 <div className="group relative bg-white/5 border border-white/10 rounded-[2rem] p-10 overflow-hidden hover:bg-white/10 transition-all duration-500 md:col-span-2">
                     <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                     <div className="relative z-10 flex flex-col md:flex-row items-end md:items-center justify-between h-full gap-8">
                         <div className="max-w-md">
                             <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                                 <Zap className="text-white w-7 h-7" />
                             </div>
                             <h3 className="text-3xl font-bold mb-3">Vitesse pure.</h3>
                             <p className="text-gray-400 leading-relaxed text-lg">
                                 Oubliez les lenteurs. Zorin OS est optimisé pour exploiter chaque transistor du processeur. 
                                 Vos applications se lancent instantanément, votre batterie dure plus longtemps.
                             </p>
                         </div>
                         <div className="flex-1 w-full bg-black/50 rounded-xl border border-white/10 p-6 backdrop-blur-md">
                             <div className="space-y-4">
                                 <div className="flex justify-between items-center text-sm">
                                     <span className="text-gray-400">Boot Time</span>
                                     <span className="text-[#0cc0df] font-mono">0.8s</span>
                                 </div>
                                 <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                     <div className="h-full w-[95%] bg-[#0cc0df] shadow-[0_0_10px_#0cc0df]"></div>
                                 </div>
                                 <div className="flex justify-between items-center text-sm">
                                     <span className="text-gray-400">App Launch</span>
                                     <span className="text-green-400 font-mono">Instant</span>
                                 </div>
                                 <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                     <div className="h-full w-[98%] bg-green-400 shadow-[0_0_10px_#4ade80]"></div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* Card 3 : Compatibility */}
                 <div className="group relative bg-white/5 border border-white/10 rounded-[2rem] p-10 overflow-hidden hover:bg-white/10 transition-all duration-500 md:col-span-2">
                     <div className="relative z-10 flex flex-col h-full justify-center">
                         <div className="flex items-center gap-4 mb-6">
                             <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                                 <Layers className="text-white w-7 h-7" />
                             </div>
                             <h3 className="text-3xl font-bold">Compatible avec votre vie.</h3>
                         </div>
                         <p className="text-gray-400 leading-relaxed text-lg max-w-2xl">
                             Installez vos applications Windows préférées, utilisez la suite Adobe via le Cloud, ou découvrez des milliers d'alternatives Open Source gratuites. 
                             Compatible avec Steam, Discord, Spotify et plus encore.
                         </p>
                     </div>
                 </div>

                 {/* Card 4 : UI */}
                 <div className="group relative bg-gradient-to-b from-[#0cc0df]/20 to-[#050505] border border-white/10 rounded-[2rem] p-10 overflow-hidden hover:border-[#0cc0df]/50 transition-all duration-500">
                     <div className="relative z-10 h-full flex flex-col justify-end min-h-[300px]">
                         <div className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                             <Command className="w-7 h-7" />
                         </div>
                         <h3 className="text-3xl font-bold mb-3">Élégance.</h3>
                         <p className="text-gray-400 leading-relaxed">
                             Une interface familière qui s'adapte à vous. Passez d'un look Windows à macOS en un clic. 
                             C'est beau, c'est simple, c'est vous.
                         </p>
                     </div>
                 </div>

             </div>
         </div>
      </section>

      {/* Footer */}
      <div className="py-24 bg-black border-t border-white/10 text-center">
        <div className="container mx-auto px-6">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 text-white">Le futur est ouvert.</h2>
            <Button 
                onClick={handleOpenConfig}
                className="h-16 px-12 bg-white text-black hover:bg-gray-200 text-lg rounded-full shadow-[0_0_50px_rgba(255,255,255,0.3)] transition-all hover:scale-105 font-bold"
            >
                Configurer mon Sivara Book
            </Button>
            <p className="mt-8 text-sm text-gray-500">Expédition sous 48h au Canada. Garantie 2 ans incluse.</p>
        </div>
      </div>

      {/* CONFIGURATOR DIALOG (LOGIQUE PRÉSERVÉE) */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-3xl min-h-[500px] flex flex-col bg-white text-black">
            <DialogHeader className="border-b pb-4">
                <div className="flex items-center gap-2">
                    {step !== 'category' && products.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => setStep('category')} className="-ml-2">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div>
                        <DialogTitle className="text-2xl font-bold">
                            {step === 'category' ? 'Choisissez un modèle' : 
                             step === 'search' ? 'Inventaire complet' : 'Unités disponibles'}
                        </DialogTitle>
                        <DialogDescription>
                            {step === 'category' ? 'Sélectionnez la gamme de produit.' : 
                             step === 'search' ? 'Recherchez un appareil spécifique parmis tout le stock.' : 'Sélection rapide parmi les meilleures disponibilités.'}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            
            <div className="flex-1 py-4 overflow-hidden flex flex-col">
                {loadingInventory ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        <p className="text-sm text-gray-500">Synchronisation inventaire...</p>
                    </div>
                ) : (
                    <>
                        {/* ETAPE 1: CATEGORIES */}
                        {step === 'category' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {products.map(prod => (
                                    <div 
                                        key={prod.id} 
                                        onClick={() => handleSelectProduct(prod.id)}
                                        className="border rounded-xl p-4 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-4 group"
                                    >
                                        <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                            {prod.image_url ? <img src={prod.image_url} className="w-full h-full object-cover" /> : <Laptop className="h-8 w-8 text-gray-400" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{prod.name}</h3>
                                            <p className="text-xs text-gray-500">Voir disponibilités <ArrowRight className="inline h-3 w-3" /></p>
                                        </div>
                                    </div>
                                ))}
                                {products.length === 0 && <div className="text-center text-gray-500 col-span-2 py-10">Aucun produit disponible pour le moment.</div>}
                            </div>
                        )}

                        {/* ETAPE 2: TOP 5 SELECTION */}
                        {step === 'selection' && (
                            <div className="flex flex-col h-full">
                                <ScrollArea className="flex-1 pr-4">
                                    <RadioGroup value={selectedUnitId || ''} onValueChange={setSelectedUnitId} className="gap-3">
                                        {getSmartUnits.map((unit) => (
                                            <Label 
                                                key={unit.id}
                                                htmlFor={unit.id} 
                                                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedUnitId === unit.id ? 'border-black bg-gray-50 ring-1 ring-black' : 'border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <RadioGroupItem value={unit.id} id={unit.id} className="sr-only" />
                                                    <div className="flex flex-col gap-1">
                                                        <div className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                                            {unit.specific_specs?.ram_size}GB RAM • {unit.specific_specs?.storage}GB SSD
                                                            {unit.condition === 'new' ? (
                                                                <Badge className="bg-blue-600 hover:bg-blue-600 text-[10px]">Neuf</Badge>
                                                            ) : (
                                                                <Badge variant="secondary" className="text-[10px]">Reconditionné</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                                            <span className="font-mono">S/N: {unit.serial_number}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <div className="font-bold text-lg text-gray-900">{getMonthlyPrice(unit.unit_price)} $/mois</div>
                                                    <div className="text-[10px] text-gray-400">Abonnement</div>
                                                </div>
                                            </Label>
                                        ))}
                                    </RadioGroup>
                                </ScrollArea>
                                
                                <div className="pt-4 mt-2 border-t border-dashed border-gray-200">
                                    <Button 
                                        variant="outline" 
                                        className="w-full h-12 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 border-gray-200 text-gray-700 shadow-sm"
                                        onClick={() => setStep('search')}
                                    >
                                        <Filter className="mr-2 h-4 w-4" />
                                        Je ne trouve pas ma config ? Voir tout le stock ({allUnits.filter(u => u.product.id === selectedProductId).length})
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* ETAPE 3: RECHERCHE AVANCÉE */}
                        {step === 'search' && (
                            <div className="flex flex-col h-full gap-4">
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="Numéro de série..." 
                                        value={filters.search} 
                                        onChange={e => setFilters({...filters, search: e.target.value})} 
                                        className="flex-1"
                                    />
                                    <Select value={filters.ram} onValueChange={v => setFilters({...filters, ram: v})}>
                                        <SelectTrigger className="w-[100px]"><SelectValue placeholder="RAM" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Toutes</SelectItem>
                                            <SelectItem value="16">16 GB</SelectItem>
                                            <SelectItem value="32">32 GB</SelectItem>
                                            <SelectItem value="64">64 GB</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={filters.storage} onValueChange={v => setFilters({...filters, storage: v})}>
                                        <SelectTrigger className="w-[100px]"><SelectValue placeholder="SSD" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tous</SelectItem>
                                            <SelectItem value="256">256 GB</SelectItem>
                                            <SelectItem value="512">512 GB</SelectItem>
                                            <SelectItem value="1024">1 To</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <ScrollArea className="flex-1 pr-4 border rounded-lg bg-gray-50/50 p-2">
                                    <RadioGroup value={selectedUnitId || ''} onValueChange={setSelectedUnitId} className="gap-2">
                                        {getFilteredUnits.length > 0 ? getFilteredUnits.map((unit) => (
                                            <Label 
                                                key={unit.id}
                                                htmlFor={`search-${unit.id}`}
                                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer bg-white transition-all ${selectedUnitId === unit.id ? 'border-black ring-1 ring-black' : 'border-gray-100 hover:border-gray-300'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <RadioGroupItem value={unit.id} id={`search-${unit.id}`} />
                                                    <div className="text-sm">
                                                        <span className="font-bold mr-2">{unit.specific_specs?.ram_size}GB / {unit.specific_specs?.storage}GB</span>
                                                        <span className="font-mono text-xs text-gray-500">{unit.serial_number}</span>
                                                    </div>
                                                </div>
                                                <div className="font-medium text-sm">{getMonthlyPrice(unit.unit_price)} $/m</div>
                                            </Label>
                                        )) : (
                                            <div className="text-center py-8 text-gray-400">Aucun résultat</div>
                                        )}
                                    </RadioGroup>
                                </ScrollArea>
                                <Button variant="ghost" size="sm" onClick={() => setStep('selection')} className="self-start text-xs text-gray-500"><ArrowLeft className="h-3 w-3 mr-1"/> Retour aux suggestions</Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* FOOTER ACTIONS */}
            {step !== 'category' && (
                <DialogFooter className="flex-col sm:flex-row gap-4 items-center border-t pt-6 bg-white z-10">
                    <div className="flex flex-col items-center sm:items-start w-full">
                        {selectedUnitId ? (
                            <>
                                <span className="text-sm text-gray-500">Abonnement estimé</span>
                                <span className="text-3xl font-bold text-gray-900">
                                    {getMonthlyPrice(allUnits.find(u => u.id === selectedUnitId)?.unit_price || 0)} $
                                    <span className="text-base font-medium text-gray-500">/mois</span>
                                </span>
                            </>
                        ) : (
                            <span className="text-sm text-gray-400 italic">Veuillez sélectionner un appareil</span>
                        )}
                    </div>
                    <Button 
                        onClick={handleProceedToCheckout} 
                        disabled={!selectedUnitId || isReserving}
                        className="w-full sm:w-auto h-12 px-8 text-lg rounded-full bg-black hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                    >
                        {isReserving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Réservation...</> : "Continuer"}
                    </Button>
                </DialogFooter>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceLanding;