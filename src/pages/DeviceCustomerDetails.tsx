import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Loader2, ArrowLeft, Mail, Phone, Laptop, Package, CreditCard, 
  CheckCircle2, AlertCircle, Shield, LayoutDashboard, FileText, 
  History, Eye, XCircle, Clock, AlertTriangle, Fingerprint, Activity
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  avatar_url: string | null;
  is_pro: boolean;
  subscription_status: string;
  created_at: string;
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

interface Verification {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'approved' | 'rejected' | 'processing' | 'error';
  risk_score: number;
  rejection_reason: string | null;
  verification_metadata: {
    logs: string[];
    trust_score: number;
    ai_raw?: any;
  };
  client_ip: string;
}

const DeviceCustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'overview' | 'identity' | 'devices' | 'billing'>('overview');
  
  // Data
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [devices, setDevices] = useState<Unit[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  
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

        // 2. Fetch Identity Verifications (ALL)
        const { data: verifs } = await supabase
            .from('identity_verifications')
            .select('*')
            .eq('user_id', id)
            .order('started_at', { ascending: false });
        
        setVerifications(verifs as any || []);
        
        // Check current status
        const approved = verifs?.find((v: any) => v.status === 'approved');
        setIsIdentityVerified(!!approved);

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

  const getDuration = (start: string, end: string | null) => {
      if (!end) return 'En cours...';
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      const seconds = Math.round((e - s) / 1000);
      return `${seconds}s`;
  };

  const getLogColor = (log: string) => {
      if (log.includes('CRITICAL') || log.includes('FAIL') || log.includes('ERROR')) return 'text-red-500 font-bold';
      if (log.includes('WARNING')) return 'text-amber-500 font-medium';
      if (log.includes('SUCCESS')) return 'text-green-600 font-medium';
      return 'text-gray-500';
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!customer) return <div className="h-screen flex items-center justify-center">Client introuvable</div>;

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200">
            <Button variant="ghost" onClick={() => navigate('/admin?app=device')} className="pl-0 hover:bg-transparent text-gray-500 hover:text-gray-900 mb-4 -ml-2">
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour liste
            </Button>
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-gray-200">
                    {customer.avatar_url && <AvatarImage src={customer.avatar_url} />}
                    <AvatarFallback className="bg-gray-900 text-white text-xs">{customer.first_name[0]}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                    <h2 className="font-bold text-gray-900 truncate text-sm">{customer.first_name} {customer.last_name}</h2>
                    <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                </div>
            </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
            <button 
                onClick={() => setActiveSection('overview')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'overview' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <LayoutDashboard className="h-4 w-4" /> Vue d'ensemble
            </button>
            <button 
                onClick={() => setActiveSection('identity')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'identity' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <Shield className="h-4 w-4" /> Identité & KYC
                {isIdentityVerified && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
            </button>
            <button 
                onClick={() => setActiveSection('devices')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'devices' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <Laptop className="h-4 w-4" /> Appareils
                <Badge variant="secondary" className="ml-auto text-[10px] h-5">{devices.length}</Badge>
            </button>
            <button 
                onClick={() => setActiveSection('billing')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'billing' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <CreditCard className="h-4 w-4" /> Facturation
            </button>
        </nav>

        <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
            Client depuis le {new Date(customer.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-5xl mx-auto p-8">
            
            {/* SECTION: OVERVIEW */}
            {activeSection === 'overview' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Vue d'ensemble</h1>
                        <p className="text-gray-500">Synthèse du compte client.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        <Card className="border-gray-100 shadow-sm bg-blue-50/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Statut Compte</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-700 capitalize">{customer.subscription_status || 'Inactif'}</div>
                                {customer.is_pro && <Badge className="mt-2 bg-blue-600">Sivara Pro</Badge>}
                            </CardContent>
                        </Card>
                        <Card className="border-gray-100 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Risque Identité</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {verifications.length > 0 ? (
                                    <>
                                        <div className={`text-2xl font-bold ${isIdentityVerified ? 'text-green-600' : 'text-red-600'}`}>
                                            {isIdentityVerified ? 'Vérifié' : 'Non Vérifié'}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">{verifications.length} tentative(s)</div>
                                    </>
                                ) : (
                                    <div className="text-2xl font-bold text-gray-400">Aucune donnée</div>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="border-gray-100 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500">Flotte Active</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-gray-900">{devices.length}</div>
                                <div className="text-xs text-gray-400 mt-1">Appareils loués</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-4">Informations de contact</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Mail className="h-4 w-4" /> {customer.email}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <Phone className="h-4 w-4" /> {customer.phone_number || 'Non renseigné'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION: IDENTITY (KYC) */}
            {activeSection === 'identity' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                Historique KYC
                                {isIdentityVerified && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                            </h1>
                            <p className="text-gray-500">Journal complet des vérifications d'identité biométriques.</p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-medium text-gray-500">Score de confiance actuel</div>
                            <div className="text-2xl font-bold font-mono">
                                {verifications[0]?.verification_metadata?.trust_score ?? 0}/100
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {verifications.map((verif) => (
                            <Card 
                                key={verif.id} 
                                onClick={() => setSelectedVerification(verif)}
                                className="cursor-pointer hover:border-blue-300 transition-all border-gray-200 shadow-sm group"
                            >
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            verif.status === 'approved' ? 'bg-green-100 text-green-600' :
                                            verif.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                            'bg-gray-100 text-gray-500'
                                        }`}>
                                            {verif.status === 'approved' ? <CheckCircle2 className="h-5 w-5" /> : 
                                             verif.status === 'rejected' ? <XCircle className="h-5 w-5" /> : 
                                             <Activity className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 flex items-center gap-2">
                                                {verif.status === 'approved' ? 'Validé' : verif.status === 'rejected' ? 'Rejeté' : 'En cours'}
                                                <span className="text-xs font-normal text-gray-400">• {new Date(verif.started_at).toLocaleString()}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Durée: {getDuration(verif.started_at, verif.completed_at)}</span>
                                                <span className="flex items-center gap-1"><Fingerprint className="h-3 w-3" /> Score: {verif.verification_metadata?.trust_score || 0}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {verif.rejection_reason && (
                                            <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 hidden sm:flex">
                                                <AlertTriangle className="h-3 w-3 mr-1" /> Motif: {verif.rejection_reason.split('|')[0].substring(0, 20)}...
                                            </Badge>
                                        )}
                                        <Button variant="ghost" size="sm" className="text-gray-400 group-hover:text-blue-600">
                                            Détails <Eye className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {verifications.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                                <History className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500">Aucune vérification effectuée.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SECTION: DEVICES */}
            {activeSection === 'devices' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Parc Informatique</h1>
                        <p className="text-gray-500">Liste des appareils loués et actifs.</p>
                    </div>
                    {devices.map(unit => (
                        <div key={unit.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 p-1">
                                    {unit.product?.image_url ? <img src={unit.product.image_url} className="w-full h-full object-contain" /> : <Laptop className="h-6 w-6 text-gray-300" />}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{unit.product?.name}</div>
                                    <div className="text-xs text-gray-500 font-mono mt-1 flex items-center gap-2">
                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">S/N: {unit.serial_number}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-medium text-sm">${unit.unit_price}</div>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-1">Actif</Badge>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SECTION: BILLING */}
            {activeSection === 'billing' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
                        <p className="text-gray-500">Estimation des revenus récurrents.</p>
                    </div>
                    <Card className="border-gray-200 bg-gray-900 text-white">
                        <CardHeader><CardTitle>Revenu Mensuel (MRR)</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold">${devices.reduce((acc, unit) => acc + (unit.unit_price * 1.14975 * 0.8 / 16), 0).toFixed(2)}</div>
                            <p className="text-gray-400 text-xs mt-2">Calculé sur la base des contrats de location actifs.</p>
                        </CardContent>
                    </Card>
                </div>
            )}

        </div>
      </div>

      {/* --- LOG DETAILS DIALOG --- */}
      <Dialog open={!!selectedVerification} onOpenChange={(o) => !o && setSelectedVerification(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    Rapport d'analyse #...{selectedVerification?.id.slice(-6)}
                    {selectedVerification?.status === 'approved' 
                        ? <Badge className="bg-green-600">Validé</Badge> 
                        : <Badge variant="destructive">Rejeté</Badge>
                    }
                </DialogTitle>
                <DialogDescription>
                    Date: {new Date(selectedVerification?.started_at || '').toLocaleString()}
                </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-1 border rounded-md bg-slate-950 text-slate-300 font-mono text-xs p-4">
                <div className="space-y-1">
                    {selectedVerification?.verification_metadata?.logs?.map((log, i) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-slate-500 shrink-0">{log.substring(1, 9)}</span>
                            <span className={getLogColor(log)}>{log.substring(11)}</span>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {selectedVerification?.verification_metadata?.ai_raw && (
                <div className="mt-4 bg-gray-50 p-3 rounded-lg text-xs">
                    <h4 className="font-bold text-gray-900 mb-2">Extraction IA (Raw)</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between border-b pb-1"><span>Nom extrait:</span> <span className="font-mono text-gray-900">{selectedVerification.verification_metadata.ai_raw.firstName} {selectedVerification.verification_metadata.ai_raw.lastName}</span></div>
                        <div className="flex justify-between border-b pb-1"><span>Document:</span> <span className="font-mono text-gray-900">{selectedVerification.verification_metadata.ai_raw.docType}</span></div>
                        <div className="flex justify-between border-b pb-1"><span>Date Naissance:</span> <span className="font-mono text-gray-900">{selectedVerification.verification_metadata.ai_raw.dateOfBirth}</span></div>
                        <div className="flex justify-between border-b pb-1"><span>Age Visuel:</span> <span className="font-mono text-gray-900">~{selectedVerification.verification_metadata.ai_raw.visualAgeEstimation} ans</span></div>
                        <div className="flex justify-between border-b pb-1"><span>Expiration:</span> <span className={`font-mono ${selectedVerification.verification_metadata.ai_raw.isExpired ? 'text-red-600 font-bold' : 'text-green-600'}`}>{selectedVerification.verification_metadata.ai_raw.expirationDate}</span></div>
                        <div className="flex justify-between border-b pb-1"><span>Écran détecté:</span> <span className={`font-mono ${selectedVerification.verification_metadata.ai_raw.isScreen ? 'text-red-600 font-bold' : 'text-green-600'}`}>{selectedVerification.verification_metadata.ai_raw.isScreen ? 'OUI' : 'NON'}</span></div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DeviceCustomerDetails;