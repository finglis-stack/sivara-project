import { Button } from '@/components/ui/button';
import { 
  ArrowRight, Cpu, Wifi, Fingerprint, HardDrive, 
  Monitor, Battery, Layers, ShieldCheck, ChevronRight, Laptop, Package, Check, X, Loader2,
  Filter, Search, ArrowLeft, Shuffle, Database
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserMenu from '@/components/UserMenu';
import { useNavigate } from 'react-router-dom';
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
  const [isVendor, setIsVendor] = useState(false);
  
  // --- CONFIGURATOR STATE ---
  const [showConfig, setShowConfig] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  
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

  // --- ALGORITHMES & LOGIQUE ---

  // Mélange de Fisher-Yates pour la randomisation réelle
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
          
          // Extraire les produits uniques (Catégories)
          const uniqueProducts = new Map();
          data.forEach((unit: any) => {
              if (unit.product && !uniqueProducts.has(unit.product.id)) {
                  uniqueProducts.set(unit.product.id, unit.product);
              }
          });
          setProducts(Array.from(uniqueProducts.values()));

          // Si un seul produit, on saute direct à la sélection
          if (uniqueProducts.size === 1) {
              const prodId = Array.from(uniqueProducts.keys())[0];
              setSelectedProductId(prodId);
              setStep('selection');
          }
      }
      setLoadingInventory(false);
  };

  // Algorithme de "Smart Diversity" pour les 5 unités
  const getSmartUnits = useMemo(() => {
      if (!selectedProductId) return [];
      
      // 1. Filtrer par produit
      const productUnits = allUnits.filter(u => u.product.id === selectedProductId);
      
      // 2. Mélanger pour éviter que ce soit toujours les mêmes (si configs identiques)
      const shuffled = shuffleArray(productUnits);

      // 3. Sélectionner pour la diversité (Unique Specs)
      const selected: RawUnit[] = [];
      const seenSpecs = new Set<string>();

      // Passe 1 : Essayer de trouver des configs différentes (RAM/Storage/Condition)
      for (const unit of shuffled) {
          if (selected.length >= 5) break;
          const specKey = `${unit.specific_specs.ram_size}-${unit.specific_specs.storage}-${unit.condition}`;
          
          if (!seenSpecs.has(specKey)) {
              selected.push(unit);
              seenSpecs.add(specKey);
          }
      }

      // Passe 2 : Si on a moins de 5 unités, on comble avec le reste (même si specs identiques)
      if (selected.length < 5) {
          for (const unit of shuffled) {
              if (selected.length >= 5) break;
              if (!selected.find(s => s.id === unit.id)) {
                  selected.push(unit);
              }
          }
      }

      return selected;
  }, [allUnits, selectedProductId, showConfig]); // Dépend de showConfig pour re-shuffle à chaque ouverture

  // Filtrage pour la vue "Recherche Avancée"
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

  const handleProceedToCheckout = () => {
      if (!selectedUnitId) return;
      navigate(`/checkout?unit_id=${selectedUnitId}`);
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

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-900 selection:text-white overflow-x-hidden">
      {/* ... (Navbar & Hero kept same as before) ... */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/5 backdrop-blur-md border-b border-white/5 text-white">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
            <div className="h-9 w-9 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
              <span className="font-bold text-lg text-white">S</span>
            </div>
            <span className="font-medium text-lg tracking-wide drop-shadow-md">Sivara Book</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="#specs" className="text-sm font-medium text-white/80 hover:text-white transition-colors hidden sm:block shadow-sm">Spécifications</a>
            
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
                <div className="text-white">
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

      <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-[#080808]">
        <div className="container mx-auto px-6 relative z-10 py-12">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">
                <div className="flex-1 text-center lg:text-left space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000 relative">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/90 text-sm font-medium shadow-2xl">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                        Design Industriel
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1] drop-shadow-2xl">
                        Sivara Book. <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500">L'Art de la Puissance.</span>
                    </h1>
                    
                    <p className="text-xl text-white/70 font-light max-w-2xl mx-auto lg:mx-0 leading-relaxed drop-shadow-md">
                        Ryzen 7 AI. Écran tactile 2.5K. Zorin OS. <br/>
                        Disponible en abonnement tout inclus.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                        <Button 
                            onClick={handleOpenConfig}
                            className="h-14 px-10 bg-white text-black hover:bg-gray-200 text-lg rounded-full transition-all hover:scale-105 font-bold shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                        >
                            Choisir mon modèle
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        <Button 
                            variant="outline"
                            className="h-14 px-10 text-white border-white/20 bg-transparent hover:bg-white/5 text-lg rounded-full backdrop-blur-sm"
                            onClick={() => document.getElementById('specs')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            Détails
                        </Button>
                    </div>
                </div>

                <div className="flex-1 relative w-full max-w-lg lg:max-w-xl animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
                    <img 
                        src="/sivara-book.png" 
                        alt="Sivara Book" 
                        className="relative w-full h-auto object-contain drop-shadow-2xl transform hover:scale-[1.02] transition-transform duration-700"
                    />
                </div>
            </div>
        </div>
      </div>

      {/* --- SPECS & OS Sections omitted for brevity (same as previous) --- */}
      <div id="specs" className="py-24 bg-white relative z-20">
         <div className="container mx-auto px-6">
             {/* ... Specs Content ... */}
         </div>
      </div>

      {/* --- MODAL CONFIGURATEUR INTELLIGENT --- */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-3xl min-h-[500px] flex flex-col">
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
                                                            {/* Prix total caché/supprimé comme demandé */}
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
                        disabled={!selectedUnitId}
                        className="w-full sm:w-auto h-12 px-8 text-lg rounded-full bg-black hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                    >
                        Continuer
                    </Button>
                </DialogFooter>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceLanding;