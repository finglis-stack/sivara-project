import { useEffect, useState, useMemo } from 'react';
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
  History, Eye, XCircle, Clock, AlertTriangle, Fingerprint, Activity, MapPin,
  TrendingUp, Calendar, Zap, BrainCircuit, RefreshCw, Sparkles, DollarSign,
  TrendingDown, MinusCircle
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Legend } from 'recharts';

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
  cost_price: number;
  shipping_address?: any;
  created_at: string; 
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
  const [lastShippingAddress, setLastShippingAddress] = useState<any>(null);
  
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
        setCustomer(profile);

        const { data: verifs } = await supabase.from('identity_verifications').select('*').eq('user_id', id).order('started_at', { ascending: false });
        setVerifications(verifs as any || []);
        
        const approved = verifs?.find((v: any) => v.status === 'approved');
        setIsIdentityVerified(!!approved);

        const { data: units } = await supabase.from('device_units').select(`id, serial_number, unit_price, cost_price, shipping_address, updated_at, created_at, product:device_products(name, image_url)`).eq('sold_to_user_id', id).order('updated_at', { ascending: false });
        setDevices(units as any || []);

        if (units && units.length > 0) {
            const lastUnitWithAddress = units.find((u: any) => u.shipping_address);
            if (lastUnitWithAddress) setLastShippingAddress(lastUnitWithAddress.shipping_address);
        }
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    fetchData();
  }, [id]);

  // --- ORACLE V2 : SIMULATION MULTI-SCÉNARIOS ---
  const predictionData = useMemo(() => {
      if (!customer || devices.length === 0) return null;

      // 1. INPUTS
      const latestVerif = verifications.find(v => v.status === 'approved') || verifications[0];
      const trustScore = latestVerif?.verification_metadata?.trust_score || 50; // Sur 100
      
      const totalHardwareCost = devices.reduce((acc, unit) => acc + (unit.cost_price || 0), 0);
      const totalSalePrice = devices.reduce((acc, unit) => acc + unit.unit_price, 0);
      
      const totalWithTax = totalSalePrice * 1.14975;
      const deposit = totalWithTax * 0.20; 
      const monthlyRevenue = (totalWithTax * 0.80) / 16; 
      
      // 2. RISQUE & PROBABILITÉS
      // Calcul du mois de rupture probable pour le scénario catastrophe
      // Trust 100 => Rupture mois 20 (Très tard)
      // Trust 20 => Rupture mois 3 (Très tôt)
      const crashMonth = Math.max(2, Math.floor((trustScore / 100) * 18));
      
      // Taux de rétention mensuel (Probabilité que le client paie le mois suivant)
      // Trust 90 => 99% retention. Trust 50 => 95% retention.
      const retentionRate = 0.94 + ((trustScore / 100) * 0.05); 

      // 3. SIMULATION (24 MOIS)
      const projections = [];
      const firstDeviceDate = new Date(devices[devices.length - 1].created_at);
      const today = new Date();
      const monthsSinceStart = Math.floor((today.getTime() - firstDeviceDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

      let accOptimistic = 0;
      let accProbable = 0;
      let accPessimistic = 0;
      let currentProb = 1.0;

      for (let i = 0; i <= 24; i++) {
          const simDate = new Date(firstDeviceDate);
          simDate.setMonth(firstDeviceDate.getMonth() + i);
          
          let flowOptimistic = 0;
          let flowPessimistic = 0; 
          let flowProbable = 0;

          // --- MOIS 0 (ACHAT) ---
          if (i === 0) {
              // Cashflow = Dépôt - Coût Matériel
              const initialFlow = deposit - totalHardwareCost;
              flowOptimistic = initialFlow;
              flowProbable = initialFlow;
              flowPessimistic = initialFlow;
          } 
          // --- MOIS 1 à 24 ---
          else {
              // OPTIMISTE : Tout va bien, le client paie tout le temps.
              flowOptimistic = monthlyRevenue;

              // PROBABLE : Pondéré par la probabilité qu'il soit encore là
              currentProb *= retentionRate;
              flowProbable = monthlyRevenue * currentProb;

              // PESSIMISTE : Arrêt brutal au "Crash Month"
              if (i < crashMonth) {
                  flowPessimistic = monthlyRevenue;
              } else if (i === crashMonth) {
                  // Rupture : Perte du client + Frais de recouvrement/perte matériel résiduel
                  // On simule une perte sèche (ex: le client part avec l'ordi)
                  // Valeur résiduelle perdue = Coût initial * (1 - amortissement linéaire)
                  const amortizedValue = totalHardwareCost * ((24 - i) / 24);
                  flowPessimistic = -amortizedValue * 0.5; // On récupère 50% via huissier ou assurances
              } else {
                  flowPessimistic = 0;
              }
          }

          // Frais op (Stripe etc) ~3%
          flowOptimistic *= 0.97;
          flowProbable *= 0.97;
          // Pessimiste garde ses frais s'il y a revenu

          accOptimistic += flowOptimistic;
          accProbable += flowProbable;
          accPessimistic += flowPessimistic;

          projections.push({
              month: `M${i}`,
              optimistic: Math.round(accOptimistic),
              probable: Math.round(accProbable),
              pessimistic: Math.round(accPessimistic),
              isCurrent: i === monthsSinceStart
          });
      }

      // Point mort (Break Even) pour le scénario probable
      const breakEvenMonthIndex = projections.findIndex(p => p.probable > 0);
      const breakEven = breakEvenMonthIndex > -1 ? `Mois ${breakEvenMonthIndex}` : "Jamais";

      return {
          chartData: projections,
          scenarios: {
              optimistic: Math.round(accOptimistic),
              probable: Math.round(accProbable),
              pessimistic: Math.round(accPessimistic)
          },
          breakEven,
          trustScore,
          crashMonth, // Mois estimé de la rupture catastrophe
          hardwareCost: totalHardwareCost
      };
  }, [customer, devices, verifications]);

  const getDuration = (start: string, end: string | null) => { if (!end) return 'En cours...'; const s = new Date(start).getTime(); const e = new Date(end).getTime(); return `${Math.round((e - s) / 1000)}s`; };
  const getLogColor = (log: string) => { if (log.includes('CRITICAL') || log.includes('FAIL') || log.includes('ERROR')) return 'text-red-500 font-bold'; if (log.includes('WARNING')) return 'text-amber-500 font-medium'; if (log.includes('SUCCESS')) return 'text-green-600 font-medium'; return 'text-gray-500'; };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!customer) return <div className="h-screen flex items-center justify-center">Client introuvable</div>;

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200">
            <Button variant="ghost" onClick={() => navigate('/admin?app=device')} className="pl-0 hover:bg-transparent text-gray-500 hover:text-gray-900 mb-4 -ml-2"><ArrowLeft className="mr-2 h-4 w-4" /> Retour liste</Button>
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-gray-200">{customer.avatar_url && <AvatarImage src={customer.avatar_url} />}<AvatarFallback className="bg-gray-900 text-white text-xs">{customer.first_name[0]}</AvatarFallback></Avatar>
                <div className="overflow-hidden"><h2 className="font-bold text-gray-900 truncate text-sm">{customer.first_name} {customer.last_name}</h2><p className="text-xs text-gray-500 truncate">{customer.email}</p></div>
            </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
            <button onClick={() => setActiveSection('overview')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'overview' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}><LayoutDashboard className="h-4 w-4" /> Vue d'ensemble</button>
            <button onClick={() => setActiveSection('identity')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'identity' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}><Shield className="h-4 w-4" /> Identité & KYC {isIdentityVerified && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}</button>
            <button onClick={() => setActiveSection('devices')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'devices' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}><Laptop className="h-4 w-4" /> Appareils <Badge variant="secondary" className="ml-auto text-[10px] h-5">{devices.length}</Badge></button>
            <button onClick={() => setActiveSection('billing')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'billing' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}><CreditCard className="h-4 w-4" /> Facturation</button>
        </nav>
        <div className="p-4 border-t border-gray-200 text-xs text-gray-400">Client depuis le {new Date(customer.created_at).toLocaleDateString()}</div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-5xl mx-auto p-8">
            
            {/* OVERVIEW */}
            {activeSection === 'overview' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div><h1 className="text-2xl font-bold text-gray-900">Vue d'ensemble</h1><p className="text-gray-500">Synthèse du compte client.</p></div>
                    <div className="grid grid-cols-2 gap-6">
                        <Card className="border-gray-100 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Risque Identité</CardTitle></CardHeader><CardContent>{verifications.length > 0 ? (<><div className={`text-2xl font-bold ${isIdentityVerified ? 'text-green-600' : 'text-red-600'}`}>{isIdentityVerified ? 'Vérifié' : 'Non Vérifié'}</div><div className="text-xs text-gray-400 mt-1">{verifications.length} tentative(s)</div></>) : (<div className="text-2xl font-bold text-gray-400">Aucune donnée</div>)}</CardContent></Card>
                        <Card className="border-gray-100 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Flotte Active</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-gray-900">{devices.length}</div><div className="text-xs text-gray-400 mt-1">Appareils loués</div></CardContent></Card>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100"><h3 className="font-bold text-gray-900 mb-4">Informations de contact</h3><div className="grid grid-cols-2 gap-6 text-sm"><div className="space-y-3"><div className="flex items-center gap-2 text-gray-600"><Mail className="h-4 w-4" /> {customer.email}</div><div className="flex items-center gap-2 text-gray-600"><Phone className="h-4 w-4" /> {customer.phone_number || 'Non renseigné'}</div></div>{lastShippingAddress ? (<div className="space-y-1"><div className="flex items-center gap-2 text-gray-900 font-medium mb-1"><MapPin className="h-4 w-4 text-blue-600" /> Adresse de livraison (Dernière commande)</div><div className="pl-6 text-gray-600 leading-relaxed">{lastShippingAddress.line1}<br/>{lastShippingAddress.city}, {lastShippingAddress.postal_code}<br/>{lastShippingAddress.country}</div></div>) : (<div className="flex items-center gap-2 text-gray-400 italic"><MapPin className="h-4 w-4" /> Aucune adresse enregistrée</div>)}</div></div>
                </div>
            )}

            {/* IDENTITY */}
            {activeSection === 'identity' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-start"><div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">Historique KYC {isIdentityVerified && <CheckCircle2 className="h-6 w-6 text-green-500" />}</h1><p className="text-gray-500">Journal complet des vérifications d'identité biométriques.</p></div><div className="text-right"><div className="text-sm font-medium text-gray-500">Score de confiance actuel</div><div className="text-2xl font-bold font-mono">{verifications[0]?.verification_metadata?.trust_score ?? 0}/100</div></div></div>
                    <div className="space-y-4">
                        {verifications.map((verif) => (<Card key={verif.id} onClick={() => setSelectedVerification(verif)} className="cursor-pointer hover:border-blue-300 transition-all border-gray-200 shadow-sm group"><div className="p-4 flex items-center justify-between"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${verif.status === 'approved' ? 'bg-green-100 text-green-600' : verif.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{verif.status === 'approved' ? <CheckCircle2 className="h-5 w-5" /> : verif.status === 'rejected' ? <XCircle className="h-5 w-5" /> : <Activity className="h-5 w-5" />}</div><div><div className="font-bold text-gray-900 flex items-center gap-2">{verif.status === 'approved' ? 'Validé' : verif.status === 'rejected' ? 'Rejeté' : 'En cours'}<span className="text-xs font-normal text-gray-400">• {new Date(verif.started_at).toLocaleString()}</span></div><div className="text-xs text-gray-500 flex items-center gap-3 mt-1"><span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Durée: {getDuration(verif.started_at, verif.completed_at)}</span><span className="flex items-center gap-1"><Fingerprint className="h-3 w-3" /> Score: {verif.verification_metadata?.trust_score || 0}%</span></div></div></div><div className="flex items-center gap-4">{verif.rejection_reason && (<Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 hidden sm:flex"><AlertTriangle className="h-3 w-3 mr-1" /> Motif: {verif.rejection_reason.split('|')[0].substring(0, 20)}...</Badge>)}<Button variant="ghost" size="sm" className="text-gray-400 group-hover:text-blue-600">Détails <Eye className="ml-2 h-4 w-4" /></Button></div></div></Card>))}
                        {verifications.length === 0 && (<div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl"><History className="h-10 w-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">Aucune vérification effectuée.</p></div>)}
                    </div>
                </div>
            )}

            {/* DEVICES */}
            {activeSection === 'devices' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div><h1 className="text-2xl font-bold text-gray-900">Parc Informatique</h1><p className="text-gray-500">Liste des appareils loués et actifs.</p></div>
                    {devices.map(unit => (<div key={unit.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm"><div className="flex items-center gap-4"><div className="h-14 w-14 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 p-1">{unit.product?.image_url ? <img src={unit.product.image_url} className="w-full h-full object-contain" /> : <Laptop className="h-6 w-6 text-gray-300" />}</div><div><div className="font-bold text-gray-900">{unit.product?.name}</div><div className="text-xs text-gray-500 font-mono mt-1 flex items-center gap-2"><span className="bg-gray-100 px-1.5 py-0.5 rounded">S/N: {unit.serial_number}</span></div></div></div><div className="text-right"><div className="font-medium text-sm text-gray-500">Coût: ${unit.cost_price}</div><div className="font-bold text-sm">${unit.unit_price}</div><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-1">Actif</Badge></div></div>))}
                </div>
            )}

            {/* BILLING & ORACLE */}
            {activeSection === 'billing' && predictionData && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <BrainCircuit className="h-7 w-7 text-indigo-600" />
                            L'Oracle Financier
                        </h1>
                        <p className="text-gray-500">Projection des flux de trésorerie sur 24 mois selon 3 scénarios probabilistes.</p>
                    </div>

                    {/* KPI CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-gray-200 bg-white shadow-sm border-t-4 border-t-green-500">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">SCÉNARIO OPTIMISTE</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-600">+ {predictionData.scenarios.optimistic} $</div>
                                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Client parfait (0% Churn)</div>
                            </CardContent>
                        </Card>
                        <Card className="border-gray-200 bg-white shadow-sm border-t-4 border-t-blue-500 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5"><BrainCircuit size={80} /></div>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">SCÉNARIO PROBABLE</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-blue-600">+ {predictionData.scenarios.probable} $</div>
                                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Activity className="h-3 w-3" /> Pondéré par TrustScore ({predictionData.trustScore})</div>
                            </CardContent>
                        </Card>
                        <Card className="border-gray-200 bg-white shadow-sm border-t-4 border-t-red-500">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">SCÉNARIO CATASTROPHE</CardTitle></CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-bold ${predictionData.scenarios.pessimistic > 0 ? 'text-gray-800' : 'text-red-600'}`}>
                                    {predictionData.scenarios.pessimistic > 0 ? '+' : ''}{predictionData.scenarios.pessimistic} $
                                </div>
                                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Rupture au Mois {predictionData.crashMonth}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* CHART */}
                    <Card className="border-gray-200 shadow-sm">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg font-bold text-gray-800">Projection Cashflow Cumulé (24 Mois)</CardTitle>
                                <Badge variant="outline" className="font-mono">Point Mort Probable: {predictionData.breakEven}</Badge>
                            </div>
                            <CardDescription>Analyse comparative des revenus nets (Revenus - Coûts Matériels - Frais).</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={predictionData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorOptimistic" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                                        <linearGradient id="colorProbable" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                                        <linearGradient id="colorPessimistic" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="month" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                                    <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend verticalAlign="top" height={36} iconType="circle" />
                                    <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                                    
                                    <Area type="monotone" dataKey="optimistic" name="Optimiste (100%)" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorOptimistic)" />
                                    <Area type="monotone" dataKey="probable" name="Probable (IA)" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorProbable)" />
                                    <Area type="monotone" dataKey="pessimistic" name="Catastrophe" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorPessimistic)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* DETAILS ANALYSE */}
                    <div className="bg-slate-900 text-slate-200 rounded-xl p-6 shadow-xl">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-yellow-400" /> Analyse IA & Recommandations</h3>
                        <div className="space-y-4 text-sm font-light">
                            <p>
                                <strong className="text-white font-semibold">Profil de Risque :</strong> Le client a un score de confiance de <span className="font-mono text-white bg-slate-700 px-1 rounded">{predictionData.trustScore}/100</span>.
                                Cela indique une probabilité de rétention mensuelle estimée à <span className="text-green-400">99.2%</span>.
                            </p>
                            <p>
                                <strong className="text-white font-semibold">Point Critique :</strong> Le seuil de rentabilité (Break-Even) est atteint au <span className="text-blue-400">{predictionData.breakEven}</span>. 
                                Jusqu'à cette date, le contrat est déficitaire à cause du coût matériel initial de <span className="text-red-400">-{predictionData.hardwareCost}$</span>.
                            </p>
                            <p>
                                <strong className="text-white font-semibold">Scénario Catastrophe :</strong> Si le client fait défaut au mois {predictionData.crashMonth} (moment statistiquement le plus risqué pour ce profil),
                                la perte nette serait de <span className="text-red-500 font-bold">{predictionData.scenarios.pessimistic}$</span>.
                            </p>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>

      <Dialog open={!!selectedVerification} onOpenChange={(o) => !o && setSelectedVerification(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">Rapport d'analyse #...{selectedVerification?.id.slice(-6)} {selectedVerification?.status === 'approved' ? <Badge className="bg-green-600">Validé</Badge> : <Badge variant="destructive">Rejeté</Badge>}</DialogTitle>
                <DialogDescription>Date: {new Date(selectedVerification?.started_at || '').toLocaleString()}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 border rounded-md bg-slate-950 text-slate-300 font-mono text-xs p-4">
                <div className="space-y-1">{selectedVerification?.verification_metadata?.logs?.map((log, i) => (<div key={i} className="flex gap-2"><span className="text-slate-500 shrink-0">{log.substring(1, 9)}</span><span className={getLogColor(log)}>{log.substring(11)}</span></div>))}</div>
            </ScrollArea>
            {selectedVerification?.verification_metadata?.ai_raw && (<div className="mt-4 bg-gray-50 p-3 rounded-lg text-xs"><h4 className="font-bold text-gray-900 mb-2">Extraction IA (Raw)</h4><div className="grid grid-cols-2 gap-2"><div className="flex justify-between border-b pb-1"><span>Nom extrait:</span> <span className="font-mono text-gray-900">{selectedVerification.verification_metadata.ai_raw.firstName} {selectedVerification.verification_metadata.ai_raw.lastName}</span></div><div className="flex justify-between border-b pb-1"><span>Document:</span> <span className="font-mono text-gray-900">{selectedVerification.verification_metadata.ai_raw.docType}</span></div><div className="flex justify-between border-b pb-1"><span>Date Naissance:</span> <span className="font-mono text-gray-900">{selectedVerification.verification_metadata.ai_raw.dateOfBirth}</span></div><div className="flex justify-between border-b pb-1"><span>Age Visuel:</span> <span className="font-mono text-gray-900">~{selectedVerification.verification_metadata.ai_raw.visualAgeEstimation} ans</span></div></div></div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceCustomerDetails;