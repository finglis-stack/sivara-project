import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Truck, Zap, Package, CheckCircle2, 
  Loader2, LogIn, AlertCircle 
} from 'lucide-react';

// Add type definition for google maps on window
declare global {
  interface Window {
    google: any;
  }
}

// Centre de Montréal (Place Ville Marie environ)
const MTL_CENTER = { lat: 45.501689, lng: -73.567256 };
const RADIUS_KM = 35;

// Fonction de calcul de distance (Haversine Formula)
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Rayon de la terre en km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
};

// Chargeur de script Google Maps
const loadGoogleMapsScript = (callback: () => void) => {
  const existingScript = document.getElementById('googleMapsScript');
  if (existingScript) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.id = 'googleMapsScript';
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''; 
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
  script.async = true;
  script.defer = true;
  script.onload = () => callback();
  document.head.appendChild(script);
};

const DeviceCheckout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // États Formulaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  
  // États Logique
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [deliveryOption, setDeliveryOption] = useState('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const autoCompleteRef = useRef<HTMLInputElement>(null);

  // 1. Initialisation Utilisateur
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        if (data) {
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
        }
      };
      fetchProfile();
    }
  }, [user]);

  // 2. Chargement Google Maps
  useEffect(() => {
    loadGoogleMapsScript(() => {
      setIsScriptLoaded(true);
    });
  }, []);

  // 3. Configuration Autocomplete
  useEffect(() => {
    if (isScriptLoaded && autoCompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autoCompleteRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'ca' }, // Restreindre au Canada pour l'instant
        fields: ['address_components', 'geometry', 'formatted_address']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) return;

        // Remplissage automatique
        setAddress(place.formatted_address || '');
        
        // Extraction ville/code postal (approximatif)
        place.address_components?.forEach((component: any) => {
            if (component.types.includes('locality')) setCity(component.long_name);
            if (component.types.includes('postal_code')) setPostalCode(component.long_name);
        });

        // Calcul distance
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const dist = getDistanceFromLatLonInKm(MTL_CENTER.lat, MTL_CENTER.lng, lat, lng);
        
        console.log(`Distance de Montréal: ${dist.toFixed(2)} km`);
        setDistance(dist);
        
        // Reset option par défaut selon la distance
        if (dist <= RADIUS_KM) {
            setDeliveryOption('express'); // Propose express par défaut si dispo
        } else {
            setDeliveryOption('standard');
        }
      });
    }
  }, [isScriptLoaded]);

  const handleLoginRedirect = () => {
      const currentUrl = window.location.href;
      window.location.href = `https://account.sivara.ca/login?returnTo=${encodeURIComponent(currentUrl)}`;
  };

  const handleSubmit = async () => {
      setIsProcessing(true);
      // Simulation de traitement
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ici on créerait la commande dans Stripe/Supabase
      showSuccess("Commande initialisée. Redirection paiement...");
      setIsProcessing(false);
      // Redirection vers paiement réel (étape suivante)
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-black selection:text-white flex flex-col">
      
      {/* Header Minimaliste */}
      <header className="border-b border-gray-100 py-6 sticky top-0 bg-white/80 backdrop-blur-md z-20">
        <div className="container mx-auto px-6 max-w-4xl flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/?app=device')} className="rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="font-bold text-xl tracking-tight">Sivara Checkout</span>
            </div>
            <div className="text-sm text-gray-400 font-medium hidden sm:block">
                Sécurisé par Stripe
            </div>
        </div>
      </header>

      {!user && (
          <div className="bg-black text-white text-center py-3 px-4 text-sm font-medium flex items-center justify-center gap-4 animate-in slide-in-from-top duration-500">
              <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-yellow-400" /> Connectez-vous pour suivre votre commande</span>
              <Button size="sm" variant="secondary" onClick={handleLoginRedirect} className="h-7 text-xs px-3 bg-white text-black hover:bg-gray-200 border-0">
                  Connexion
              </Button>
          </div>
      )}

      <div className="flex-1 container mx-auto px-6 py-12 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            
            {/* GAUCHE : FORMULAIRE */}
            <div className="md:col-span-7 space-y-10">
                
                {/* 1. Identité */}
                <section className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-sm font-bold">1</span>
                        Vos coordonnées
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Prénom</Label>
                            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" className="bg-gray-50 border-0 focus-visible:ring-1 focus-visible:bg-white transition-colors" />
                        </div>
                        <div className="space-y-2">
                            <Label>Nom</Label>
                            <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" className="bg-gray-50 border-0 focus-visible:ring-1 focus-visible:bg-white transition-colors" />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Email</Label>
                            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="jean@exemple.com" className="bg-gray-50 border-0 focus-visible:ring-1 focus-visible:bg-white transition-colors" />
                        </div>
                    </div>
                </section>

                {/* 2. Livraison */}
                <section className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-sm font-bold">2</span>
                        Livraison
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 text-gray-400 h-5 w-5" />
                            <Input 
                                ref={autoCompleteRef}
                                placeholder="Commencez à taper votre adresse..." 
                                className="pl-10 h-12 text-base bg-gray-50 border-0 focus-visible:ring-1 focus-visible:bg-white transition-colors"
                            />
                        </div>
                        
                        {(address || distance !== null) && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ville" className="bg-gray-50 border-0" />
                                <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Code Postal" className="bg-gray-50 border-0" />
                            </div>
                        )}
                    </div>

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

                                {/* Option Standard (Toujours dispo, gratuite) */}
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
                                            <div className="text-xs text-gray-500 mt-1">2 à 3 jours ouvrables. Suivi inclus.</div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-green-600 uppercase text-sm">Gratuit</div>
                                </Label>
                            </RadioGroup>
                        </div>
                    )}
                </section>

                <Button 
                    size="lg" 
                    className="w-full h-14 text-lg bg-black hover:bg-gray-900 text-white rounded-xl shadow-xl transition-all hover:scale-[1.01]"
                    disabled={!address || !firstName || !lastName || !email || isProcessing}
                    onClick={handleSubmit}
                >
                    {isProcessing ? <Loader2 className="animate-spin" /> : "Procéder au paiement"}
                </Button>
            </div>

            {/* DROITE : RÉSUMÉ */}
            <div className="md:col-span-5">
                <div className="sticky top-24">
                    <Card className="border-0 shadow-2xl bg-gray-50 overflow-hidden">
                        <div className="h-48 bg-gray-200 relative overflow-hidden">
                            <img src="/sivara-book.png" className="w-full h-full object-contain p-8 mix-blend-multiply" />
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="font-bold text-2xl text-gray-900">Sivara Book</h3>
                                <p className="text-sm text-gray-500">Configuration Pro - 32GB / 512GB</p>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-gray-200">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Prix de l'appareil</span>
                                    <span className="font-medium">$2,499.00</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Livraison</span>
                                    <span className="font-medium">
                                        {deliveryOption === 'express' ? '$36.00' : 'Gratuit'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Taxes (TPS/TVQ)</span>
                                    <span>$374.22</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-200 bg-blue-50/50 -mx-6 px-6 py-4 mt-2">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-sm font-bold text-blue-900">À payer aujourd'hui (20%)</span>
                                    <span className="text-3xl font-bold text-blue-900">$586.84</span>
                                </div>
                                <p className="text-xs text-blue-700/80 text-right">
                                    Puis $137.45 / mois pendant 16 mois.
                                </p>
                            </div>
                            
                            <div className="flex items-start gap-2 text-xs text-gray-400">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                                <span>Garantie 2 ans incluse. Retour gratuit sous 14 jours.</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default DeviceCheckout;