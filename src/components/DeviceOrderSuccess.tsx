import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, CheckCircle2, Package, Calendar, Truck, ShieldCheck, Cpu, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface OrderDetails {
  id: string;
  serial_number: string;
  unit_price: number;
  condition: string;
  specific_specs: {
    ram_size: string;
    storage: string;
    [key: string]: any;
  };
  product: {
    name: string;
    image_url: string;
    warranty_type: string;
  };
  shipping_address: {
    first_name: string;
    last_name: string;
    line1: string;
    city: string;
    postal_code: string;
    country: string;
    delivery_method: 'express' | 'standard';
  };
  updated_at: string;
}

const DeviceOrderSuccess = ({ orderId, onBack }: { orderId: string, onBack: () => void }) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!user) return;
      
      // On récupère la dernière unité vendue à l'utilisateur (la plus récente)
      const { data, error } = await supabase
        .from('device_units')
        .select(`
          *,
          product:device_products (*)
        `)
        .eq('sold_to_user_id', user.id)
        .eq('status', 'sold') // Important: seulement ceux vendus
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.error("Order fetch error", error);
      } else {
        setOrder(data as any);
        
        // Calcul date de livraison
        const method = data.shipping_address?.delivery_method || 'standard';
        const date = new Date();
        // Express = Aujourd'hui (si avant cutoff) ou Demain. Disons Demain pour être safe.
        // Standard = +3 jours
        const daysToAdd = method === 'express' ? 1 : 3;
        date.setDate(date.getDate() + daysToAdd);
        
        // Skip weekend simple logic
        if (date.getDay() === 0) date.setDate(date.getDate() + 1); // Dimanche -> Lundi
        if (date.getDay() === 6) date.setDate(date.getDate() + 2); // Samedi -> Lundi
        
        setDeliveryDate(date);
      }
      setLoading(false);
    };

    fetchOrder();
  }, [user]);

  const handlePrint = () => {
    window.print();
  };

  const formatDateFrench = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Calculs financiers pour la facture
  const getFinancials = () => {
      if (!order) return { monthly: 0, tax: 0, totalMonthly: 0 };
      const price = order.unit_price;
      const taxRate = 0.14975;
      const totalUnit = price * (1 + taxRate);
      const upfront = totalUnit * 0.20;
      const remainder = totalUnit - upfront;
      const monthly = remainder / 16;
      return {
          monthly: monthly.toFixed(2),
          deposit: upfront.toFixed(2)
      };
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-black"><Loader2 className="h-10 w-10 animate-spin text-white" /></div>;
  if (!order) return <div className="h-screen flex flex-col items-center justify-center bg-black text-white"><p>Commande introuvable.</p><Button onClick={onBack} variant="outline" className="mt-4">Retour</Button></div>;

  const financials = getFinancials();

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
      
      {/* HEADER HERO */}
      <div className="relative h-[40vh] w-full overflow-hidden flex items-end pb-12 print:hidden">
         <div 
            className="absolute inset-0 bg-cover bg-center z-0 scale-105 blur-sm brightness-[0.4]"
            style={{ backgroundImage: 'url(/order-success-hero.jpg)' }}
         />
         <div className="container mx-auto px-6 relative z-10 text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-medium mb-4 backdrop-blur-md">
                <CheckCircle2 className="h-4 w-4" /> Commande Confirmée
            </div>
            <h1 className="text-5xl md:text-7xl font-thin tracking-tight mb-2">Merci, {user?.email?.split('@')[0]}.</h1>
            <p className="text-xl font-light text-white/80">Votre Sivara Book est en route.</p>
         </div>
      </div>

      <div className="container mx-auto px-6 py-12 -mt-20 relative z-20">
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLONNE GAUCHE : PRODUIT & SUIVI */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* CARTE PRINCIPALE */}
                <Card className="border-0 shadow-2xl rounded-2xl overflow-hidden print:shadow-none print:border">
                    <CardContent className="p-0 flex flex-col md:flex-row">
                        <div className="w-full md:w-1/3 bg-gray-50 p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
                            {order.product.image_url ? (
                                <img src={order.product.image_url} alt={order.product.name} className="w-full h-auto object-contain mix-blend-multiply" />
                            ) : (
                                <Package className="h-24 w-24 text-gray-300" />
                            )}
                        </div>
                        <div className="p-8 flex-1">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">{order.product.name}</h2>
                                    <p className="text-slate-500 font-light">Série Pro • Modèle {new Date().getFullYear()}</p>
                                </div>
                                <Badge variant="outline" className="font-mono text-xs border-slate-200">S/N: {order.serial_number}</Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-y-4 gap-x-8 mb-8">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Cpu className="h-3 w-3" /> Mémoire</span>
                                    <p className="font-medium text-slate-900">{order.specific_specs.ram_size} Go Unifiée</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Package className="h-3 w-3" /> Stockage</span>
                                    <p className="font-medium text-slate-900">{order.specific_specs.storage} Go NVMe SSD</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Garantie</span>
                                    <p className="font-medium text-slate-900 capitalize">{order.product.warranty_type || 'Standard 2 ans'}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> État</span>
                                    <p className="font-medium text-slate-900 capitalize">{order.condition === 'new' ? 'Neuf (Scellé)' : 'Reconditionné Certifié'}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-start gap-4">
                                <div className="bg-white p-2 rounded-full shadow-sm text-blue-600">
                                    <Truck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 mb-0.5">Livraison Estimée</p>
                                    <p className="text-lg font-light text-blue-700 capitalize">
                                        {deliveryDate ? formatDateFrench(deliveryDate) : 'Date inconnue'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Via {order.shipping_address?.delivery_method === 'express' ? 'Sivara Flash (Coursier)' : 'Postes Canada Xpresspost'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ADRESSE & CONTACT (Print Only or Detail) */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 print:border print:shadow-none">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Adresse de livraison</h3>
                    <div className="font-light text-slate-900 text-lg">
                        {order.shipping_address ? (
                            <>
                                <p>{order.shipping_address.first_name} {order.shipping_address.last_name}</p>
                                <p>{order.shipping_address.line1}</p>
                                <p>{order.shipping_address.city}, {order.shipping_address.postal_code}</p>
                                <p>{order.shipping_address.country}</p>
                            </>
                        ) : 'Adresse non disponible'}
                    </div>
                </div>

            </div>

            {/* COLONNE DROITE : FACTURE / REÇU */}
            <div className="lg:col-span-1">
                <Card className="border-0 shadow-xl bg-slate-900 text-white rounded-2xl overflow-hidden print:bg-white print:text-black print:shadow-none print:border">
                    <CardContent className="p-8">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold">Reçu de transaction</h3>
                            <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center print:bg-black/10">
                                <span className="font-serif font-bold text-white print:text-black">S</span>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8 text-sm font-light text-white/80 print:text-slate-600">
                            <div className="flex justify-between">
                                <span>Référence</span>
                                <span className="font-mono">{orderId.replace('session_id=', '').slice(0, 10).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Date</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Méthode</span>
                                <span>Carte •••• 4242</span>
                            </div>
                        </div>

                        <div className="space-y-3 py-6 border-y border-white/10 print:border-slate-200 mb-6">
                            <div className="flex justify-between text-sm">
                                <span>Dépôt Initial (Payé)</span>
                                <span>{financials.deposit} $</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Mensualité (À venir)</span>
                                <span>{financials.monthly} $/mois</span>
                            </div>
                            <div className="flex justify-between text-sm text-white/60 print:text-slate-400">
                                <span>Durée du terme</span>
                                <span>16 Mois</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-end mb-8">
                            <span className="text-sm font-medium opacity-80">Total payé aujourd'hui</span>
                            <span className="text-3xl font-bold">{financials.deposit} $</span>
                        </div>

                        <Button onClick={handlePrint} className="w-full bg-white text-black hover:bg-gray-200 font-bold h-12 print:hidden">
                            <Printer className="mr-2 h-4 w-4" /> Imprimer le reçu
                        </Button>
                        
                        <p className="text-[10px] text-center mt-4 text-white/40 print:hidden">
                            Une copie de la facture a été envoyée par email.
                        </p>
                    </CardContent>
                </Card>

                <Button variant="ghost" onClick={onBack} className="w-full mt-6 gap-2 text-slate-500 hover:text-slate-900 print:hidden">
                    <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
                </Button>
            </div>

         </div>
      </div>
    </div>
  );
};

export default DeviceOrderSuccess;