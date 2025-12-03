import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowLeft, Mail, Phone, Laptop, Package, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  avatar_url: string | null;
  is_pro: boolean;
  subscription_status: string;
}

interface Unit {
  id: string;
  serial_number: string;
  unit_price: number;
  product: {
    name: string;
    image_url: string;
  };
}

const DeviceCustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [devices, setDevices] = useState<Unit[]>([]);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      
      try {
        // 1. Fetch Customer Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();
        
        setCustomer(profile);

        // 2. Fetch Identity Verification Status
        // On cherche s'il existe une vérification approuvée pour cet utilisateur
        const { data: verification } = await supabase
            .from('identity_verifications')
            .select('status')
            .eq('user_id', id)
            .eq('status', 'approved')
            .limit(1)
            .maybeSingle();
        
        setIsIdentityVerified(!!verification);

        // 3. Fetch Customer Devices
        const { data: units } = await supabase
            .from('device_units')
            .select(`
                id,
                serial_number,
                unit_price,
                product:device_products(name, image_url)
            `)
            .eq('sold_to_user_id', id);
            
        setDevices(units as any || []);
      } catch (error) {
        console.error("Erreur chargement client", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!customer) return <div className="h-screen flex items-center justify-center">Client introuvable</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin?app=device')} className="pl-0 hover:bg-transparent text-gray-500 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour à l'admin
        </Button>

        {/* HEADER CLIENT */}
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8">
            <Avatar className="h-24 w-24 border-4 border-gray-50 shadow-lg">
                {customer.avatar_url && <AvatarImage src={customer.avatar_url} />}
                <AvatarFallback className="bg-gray-900 text-white text-2xl">{customer.first_name[0]}</AvatarFallback>
            </Avatar>
            <div className="text-center md:text-left flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{customer.first_name} {customer.last_name}</h1>
                <div className="flex flex-col md:flex-row gap-4 text-sm text-gray-500 justify-center md:justify-start">
                    <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> {customer.email}</span>
                    {customer.phone_number && <span className="flex items-center gap-2"><Phone className="h-4 w-4" /> {customer.phone_number}</span>}
                </div>
                <div className="mt-4 flex gap-2 justify-center md:justify-start">
                    {customer.is_pro ? <Badge className="bg-green-600 text-white border-0">Abonné Pro</Badge> : <Badge variant="outline">Gratuit</Badge>}
                    <Badge variant="secondary" className="uppercase">{customer.subscription_status || 'Inactif'}</Badge>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* GAUCHE : APPAREILS */}
            <div className="lg:col-span-2 space-y-6">
                <Card className="border-gray-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><Laptop className="h-5 w-5 text-gray-500" /> Parc Informatique</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {devices.length > 0 ? (
                            <div className="space-y-4">
                                {devices.map(unit => (
                                    <div key={unit.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-4">
                                            <div className="h-14 w-14 bg-white rounded-lg flex items-center justify-center border border-gray-200 p-1">
                                                {unit.product?.image_url ? <img src={unit.product.image_url} className="w-full h-full object-contain" /> : <Laptop className="h-6 w-6 text-gray-300" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{unit.product?.name}</div>
                                                <div className="text-xs text-gray-500 font-mono mt-1">S/N: {unit.serial_number}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-sm">${unit.unit_price}</div>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 mt-1">Location Active</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-xl">
                                <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500">Aucun appareil associé</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* DROITE : INFO COMPTE */}
            <div className="space-y-6">
                <Card className="border-gray-200 shadow-sm bg-gray-900 text-white border-0">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5" /> Facturation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6">
                            <p className="text-gray-400 text-sm mb-1">Revenu Mensuel Récurrent</p>
                            <p className="text-4xl font-bold">${devices.reduce((acc, unit) => acc + (unit.unit_price * 1.14975 * 0.8 / 16), 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                            <span className="text-sm font-medium">Paiements à jour</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5 text-gray-500" /> Statut du compte</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-3">
                                <span className="text-gray-500">Identité vérifiée</span>
                                {isIdentityVerified ? (
                                    <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Oui</span>
                                ) : (
                                    <span className="text-orange-500 font-medium flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Non</span>
                                )}
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-3">
                                <span className="text-gray-500">Contrats signés</span>
                                <span className="text-gray-900 font-medium">{devices.length}/{devices.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Incidents ouverts</span>
                                <span className="text-gray-900 font-medium">0</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceCustomerDetails;