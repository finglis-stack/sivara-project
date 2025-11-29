import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Truck, Zap, AlertCircle, RefreshCw, ShieldCheck, HelpCircle, Loader2, CheckCircle2 
} from 'lucide-react';
import { Card } from '@/components/ui/card';

// Types
declare global {
  interface Window {
    google: any;
  }
}

interface ProductData {
  id: string;
  name: string;
  base_price: number;
  image_url: string;
  specs: any;
}

// Constantes
const MTL_CENTER = { lat: 45.501689, lng: -73.567256 };
const RADIUS_KM = 35;
const TAX_RATE = 0.14975; // TPS + TVQ
const INSTALLMENTS = 16;
const UPFRONT_PERCENTAGE = 0.20;

// Utils
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

const loadGoogleMapsScript = (apiKey: string, callback: () => void) => {
  const existingScript = document.getElementById('googleMapsScript');
  if (existingScript) { callback(); return; }
  const script = document.createElement('script');
  script.id = 'googleMapsScript';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
  script.async = true;
  script.defer = true;
  script.onload = () => callback();
  document.head.appendChild(script);
};

const DeviceCheckout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  
  // Logic State
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryOption, setDeliveryOption] = useState('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const autoCompleteRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Product & User Data
  useEffect(() => {
    const initData = async () => {
      // User info
      if (user) {
        setEmail(user.email || '');
        const { data } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single();
        if (data) {
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
        }
      }

      // Product Fetch
      try {
        const { data, error } = await supabase
            .from('device_products')
            .select('*')
            .order('base_price', { ascending: false })
            .limit(1)
            .single();
        
        if (error) throw error;
        setProduct(data);
      } catch (e) {
        console.error("Erreur produit", e);
        showError("Impossible de charger le produit");
      } finally {
        setLoadingProduct(false);
      }
    };
    initData();
  }, [user]);

  // 2. Init Google Maps
  useEffect(() => {
    const initMaps = async () => {
        try {
            const { data } = await supabase.functions.invoke('get-maps-key');
            if (data?.key) loadGoogleMapsScript(data.key, () => setIsScriptLoaded(true));
        } catch (e) { console.error("Maps error", e); }
    };
    initMaps();
  }, []);

  // 3. Autocomplete Setup
  useEffect(() => {
    if (isScriptLoaded && autoCompleteRef.current && window.google) {
      const autocomplete = new window.google.maps.places.Autocomplete(autoCompleteRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'ca' },
        fields: ['address_components', 'geometry', 'formatted_address']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) return;

        setAddress(place.formatted_address || '');
        place.address_components?.forEach((component: any) => {
            if (component.types.includes('locality')) setCity(component.long_name);
            if (component.types.includes('postal_code')) setPostalCode(component.long_name);
        });

        const dist = getDistanceFromLatLonInKm(MTL_CENTER.lat, MTL_CENTER.lng, place.geometry.location.lat(), place.geometry.location.lng());
        setDistance(dist);
        setDeliveryOption(dist <= RADIUS_KM ? 'express' : 'standard');
      });
    }
  }, [isScriptLoaded]);

  // --- CALCULS FINANCIERS ---
  const calculateTotals = () => {
      if (!product) return { total: 0, tax: 0, upfront: 0, monthly: 0, shipping: 0 };

      const basePrice = product.base_price;
      const shippingPrice = deliveryOption === 'express' ? 36.00 : 0;
      
      const subTotal = basePrice + shippingPrice;
      const taxes = subTotal * TAX_RATE;
      const grandTotal = subTotal + taxes;
      const upfront = grandTotal * UPFRONT_PERCENTAGE;
      const remainder = grandTotal - upfront;
      const monthly = remainder / INSTALLMENTS;

      return {
          base: basePrice,
          shipping: shippingPrice,
          subTotal,
          taxes,
          grandTotal,
          upfront,
          monthly
      };
  };

  const totals = calculateTotals();

  const handleLoginRedirect = () => {
      window.location.href = `https://account.sivara.ca/login?returnTo=${encodeURIComponent(window.location.href)}`;
  };

  const handleSubmit = async () => {
      setIsProcessing(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      showSuccess("Abonnement initialisé. Redirection paiement...");
      setIsProcessing(false);
  };

  if (loadingProduct) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans">
      
      {/* ----------------- GAUCHE : RÉSUMÉ ----------------- */}
      <div className="lg:w-5/12 bg-gray-50 p-8 lg:p-12 border-r border-gray-200 order-last lg:order-first flex flex-col justify-between h-auto lg:min-h-screen">
         <div>
            <div className="flex items-center gap-3 mb-12 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={() => navigate('/?app=device')}>
                <div className="h-8 w-8 bg-black text-white rounded-lg flex items-center justify-center shadow-sm">
                    <span className="font-bold font-serif">S</span>
                </div>
                <span className="font-medium tracking-wide text-gray-900">Sivara Book</span>
            </div>

            <div className="mb-10">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Votre abonnement</p>
                <h1 className="text-3xl lg:text-4xl font-light text-gray-900 leading-tight mb-2">
                    {product?.name || "Sivara Book Pro"}
                </h1>
                <p className="text-gray-500 font-light">Location longue durée (16 mois) • Renouvelable</p>
            </div>

            <div className="space-y-6 mb-10">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4 items-start">
                    <div className="h-20 w-20 bg-gray-50 rounded-lg shrink-0 flex items-center justify-center overflow-hidden">
                        {product?.image_url && <img src={product.image_url} className="w-full h-full object-contain mix-blend-multiply p-2" />}
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">Configuration sélectionnée</h4>
                        <ul className="text-xs text-gray-500 mt-1 space-y-1">
                            <li>• AMD Ryzen™ 7 8845HS</li>
                            <li>• 32 Go RAM DDR5</li>
                            <li>• 512 Go SSD NVMe</li>
                        </ul>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Livraison {deliveryOption === 'express' ? '(Express)' : '(Standard)'}</span>
                        <span>{totals.shipping > 0 ? `${totals.shipping.toFixed(2)} $` : 'Gratuit'}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        <span className="flex items-center gap-1">Taxes incluses <HelpCircle className="h-3 w-3 text-gray-300" /></span>
                        <span>{totals.taxes.toFixed(2)} $</span>
                    </div>
                </div>
            </div>
         </div>

         {/* TOTALS BAS DE PAGE GAUCHE */}
         <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
            <div className="flex justify-between items-end mb-2">
               <div>
                   <p className="text-sm font-bold text-blue-900">Apport initial (20%)</p>
                   <p className="text-xs text-blue-600/80">Payable aujourd'hui</p>
               </div>
               <span className="text-3xl font-thin tracking-tighter text-blue-900">
                   {totals.upfront.toFixed(2)} $
               </span>
            </div>
            
            <div className="h-px bg-blue-200/50 w-full my-3"></div>
            
            <div className="flex justify-between items-center">
               <div className="flex items-center gap-2">
                   <RefreshCw className="h-4 w-4 text-blue-600" />
                   <span className="text-sm font-medium text-blue-900">Mensualité (16 mois)</span>
               </div>
               <span className="text-lg font-bold text-blue-900">{totals.monthly.toFixed(2)} $/mois</span>
            </div>
         </div>
      </div>

      {/* ----------------- DROITE : FORMULAIRE ----------------- */}
      <div className="lg:w-7/12 p-8 lg:p-20 flex flex-col">
         
         {!user && (
            <div className="mb-8 bg-black text-white p-4 rounded-xl flex items-center justify-between shadow-lg transform -translate-y-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-full"><AlertCircle className="h-4 w-4" /></div>
                    <div className="text-sm font-medium">Connectez-vous pour suivre votre commande</div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleLoginRedirect} className="text-xs h-8">Connexion</Button>
            </div>
         )}

         <div className="max-w-xl mx-auto w-full space-y-10">
            
            {/* ETAPE 1 */}
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black text-white text-sm font-bold">1</div>
                    <h2 className="text-xl font-bold text-gray-900">Vos coordonnées</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 pl-12">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-gray-500 uppercase font-bold">Prénom</Label>
                        <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-gray-50 border-gray-100 focus:bg-white transition-colors h-12" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-gray-500 uppercase font-bold">Nom</Label>
                        <Input value={lastName} onChange={e => setLastName(e.target.value)} className="bg-gray-50 border-gray-100 focus:bg-white transition-colors h-12" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs text-gray-500 uppercase font-bold">Email</Label>
                        <Input value={email} onChange={e => setEmail(e.target.value)} className="bg-gray-50 border-gray-100 focus:bg-white transition-colors h-12" />
                    </div>
                </div>
            </section>

            {/* ETAPE 2 */}
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black text-white text-sm font-bold">2</div>
                    <h2 className="text-xl font-bold text-gray-900">Livraison</h2>
                </div>
                
                <div className="pl-12 space-y-6">
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 text-gray-400 h-5 w-5" />
                        <Input 
                            ref={autoCompleteRef}
                            placeholder="Commencez à taper votre adresse..." 
                            className="pl-10 h-12 text-base bg-gray-50 border-gray-100 focus:bg-white transition-colors shadow-sm"
                        />
                    </div>
                    
                    {(address || distance !== null) && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ville" className="bg-gray-50 border-gray-100 h-11" />
                            <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Code Postal" className="bg-gray-50 border-gray-100 h-11" />
                        </div>
                    )}

                    {distance !== null && (
                        <div className="animate-in fade-in slide-in-from-top-4">
                            <Label className="mb-3 block text-gray-600">Options disponibles pour votre zone</Label>
                            <RadioGroup value={deliveryOption} onValueChange={setDeliveryOption} className="gap-3">
                                
                                {/* Option Grand Montréal */}
                                {distance <= RADIUS_KM && (
                                    <Label 
                                        htmlFor="express" 
                                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${deliveryOption === 'express' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <RadioGroupItem value="express" id="express" className="border-blue-600 text-blue-600" />
                                            <div>
                                                <div className="font-bold text-gray-900 flex items-center gap-2">
                                                    <Zap className="h-4 w-4 text-orange-500 fill-current" />
                                                    Livraison Flash (Aujourd'hui)
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">Entre 18h00 et 21h00 ce soir.</div>
                                            </div>
                                        </div>
                                        <div className="font-bold text-gray-900">$36.00</div>
                                    </Label>
                                )}

                                {/* Option Standard */}
                                <Label 
                                    htmlFor="standard" 
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${deliveryOption === 'standard' ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <RadioGroupItem value="standard" id="standard" className="text-black" />
                                        <div>
                                            <div className="font-bold text-gray-900 flex items-center gap-2">
                                                <Truck className="h-4 w-4 text-gray-600" />
                                                Postes Canada Express
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">2 à 3 jours ouvrables. Signature requise.</div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-green-600 uppercase text-sm">Gratuit</div>
                                </Label>
                            </RadioGroup>
                        </div>
                    )}
                </div>
            </section>

            {/* TERMS & VALIDATION */}
            <div className="pl-12 pt-4">
                <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 mb-6 leading-relaxed flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-gray-400 shrink-0" />
                    <p>
                        En confirmant, vous acceptez les conditions de l'abonnement "Device-as-a-Service". 
                        Vous pouvez retourner l'appareil à tout moment après 12 mois sans frais, ou le conserver en continuant l'abonnement. 
                        Ceci n'est pas un crédit.
                    </p>
                </div>

                <Button 
                    size="lg" 
                    className="w-full h-14 text-lg bg-black hover:bg-gray-900 text-white rounded-xl shadow-xl transition-all hover:scale-[1.01]"
                    disabled={!address || !firstName || !lastName || !email || isProcessing}
                    onClick={handleSubmit}
                >
                    {isProcessing ? <Loader2 className="animate-spin mr-2" /> : "Payer l'apport initial"} 
                    {!isProcessing && ` • ${totals.upfront.toFixed(2)} $`}
                </Button>
                
                <div className="text-center mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <CheckCircle2 className="h-3 w-3" /> Paiement sécurisé SSL 256-bit
                </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default DeviceCheckout;