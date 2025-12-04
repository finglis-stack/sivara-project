import { useEffect, useState, useMemo, useRef } from 'react';
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
  TrendingDown, MinusCircle, Target, ArrowUpRight, Lock, MousePointer2
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Legend, Line } from 'recharts';

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
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [devices, setDevices] = useState<Unit[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [lastShippingAddress, setLastShippingAddress] = useState<any>(null);
  
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 3D Tilt State
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { width, height, left, top } = containerRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    const xPct = x / width;
    const yPct = y / height;
    // Rotation légère (max 5 deg)
    const rotateX = (0.5 - yPct) * 10;
    const rotateY = (xPct - 0.5) * 10;
    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
      setRotation({ x: 0, y: 0 });
  };

  // --- ORACLE V3 : MOTEUR FINANCIER 3D ---
  const oracle = useMemo(() => {
      if (!customer || devices.length === 0) return null;

      // 1. CONSTANTES & INPUTS
      const TAX_RATE = 1.14975; // Québec
      const DEPOSIT_RATE = 0.20; // 20%
      const TERM_MONTHS = 16;
      
      const latestVerif = verifications.find(v => v.status === 'approved') || verifications[0];
      const trustScore = latestVerif?.verification_metadata?.trust_score || 50; 
      
      const totalHardwareCost = devices.reduce((acc, unit) => acc + (unit.cost_price || 0), 0);
      const totalSalePrice = devices.reduce((acc, unit) => acc + unit.unit_price, 0);
      const totalWithTax = totalSalePrice * TAX_RATE;
      
      // Flux de Trésorerie
      const depositAmount = totalWithTax * DEPOSIT_RATE;
      const amountToFinance = totalWithTax - depositAmount;
      const monthlyPayment = amountToFinance / TERM_MONTHS;
      const monthlyFees = (monthlyPayment * 0.035) + 0.30;
      const netMonthly = monthlyPayment - monthlyFees;

      // 2. SCÉNARIOS
      const projections = [];
      let accOptimistic = 0;
      let accProbable = 0;
      let accPessimistic = 0;
      
      const crashMonth = Math.max(2, Math.floor((trustScore / 100) * 12));
      const retentionRate = 0.95 + ((trustScore / 100) * 0.049); 

      let currentRetentionProb = 1.0;
      let breakEvenMonth = -1;

      for (let i = 0; i <= 24; i++) {
          let flowOptimistic = 0;
          let flowProbable = 0;
          let flowPessimistic = 0;

          // MOIS 0 : LE CREUX INITIAL
          if (i === 0) {
              // Cashflow = Dépôt Client (IN) - Achat Matériel (OUT)
              // C'est ici qu'on "perd" de l'argent initialement
              const initialFlow = depositAmount - totalHardwareCost;
              flowOptimistic = initialFlow;
              flowProbable = initialFlow;
              flowPessimistic = initialFlow;
          } 
          else {
              // OPTIMISTE
              flowOptimistic = netMonthly;

              // PROBABLE
              currentRetentionProb *= retentionRate;
              flowProbable = netMonthly * currentRetentionProb;

              // CATASTROPHE
              if (i < crashMonth) {
                  flowPessimistic = netMonthly;
              } else if (i === crashMonth) {
                  // Perte de la valeur résiduelle du matériel
                  const residualValue = totalHardwareCost * ((36 - i) / 36);
                  flowPessimistic = -(residualValue * 0.6); 
              } else {
                  flowPessimistic = 0; 
              }
          }

          accOptimistic += flowOptimistic;
          accProbable += flowProbable;
          accPessimistic += flowPessimistic;

          if (breakEvenMonth === -1 && accProbable > 0) {
              breakEvenMonth = i;
          }

          projections.push({
              month: `M${i}`,
              Optimiste: Math.round(accOptimistic),
              Probable: Math.round(accProbable),
              Catastrophe: Math.round(accPessimistic),
          });
      }

      // Recommandations
      let recommendation = "";
      let actionDate = "";
      
      if (trustScore >= 80) {
          recommendation = "Profil Elite. Proposer renouvellement anticipé au mois 14.";
          actionDate = "Mois 14";
      } else if (trustScore >= 50) {
          recommendation = "Profil Standard. Laisser courir jusqu'au terme.";
          actionDate = "Mois 16";
      } else {
          recommendation = "Profil Risqué. Surveillance active requise.";
          actionDate = "Immédiat";
      }

      return {
          chartData: projections,
          breakEven: breakEvenMonth > -1 ? `Mois ${breakEvenMonth}` : "> 24 mois",
          roiTotal: Math.round(accProbable),
          profitMargin: ((accProbable / totalHardwareCost) * 100).toFixed(1),
          trustScore,
          recommendation,
          actionDate,
          details: {
              deposit: depositAmount,
              monthly: monthlyPayment,
              hardwareCost: totalHardwareCost
          }
      };
  }, [customer, devices, verifications]);

  const getDuration = (start: string, end: string | null) => { if (!end) return '...'; const s = new Date(start).getTime(); const e = new Date(end).getTime(); return `${Math.round((e - s) / 1000)}s`; };
  
  if (isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!customer) return <div className="h-screen flex items-center justify-center">Client introuvable</div>;

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 z-30">
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
            <button onClick={() => setActiveSection('billing')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'billing' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`}><BrainCircuit className="h-4 w-4" /> L'Oracle</button>
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className={`h-full ${activeSection === 'billing' ? 'p-0 overflow-hidden' : 'p-8 max-w-5xl mx-auto'}`}>
            
            {/* OVERVIEW SECTION (Standard UI) */}
            {activeSection === 'overview' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div><h1 className="text-2xl font-bold text-gray-900">Vue d'ensemble</h1><p className="text-gray-500">Synthèse du compte client.</p></div>
                    <div className="grid grid-cols-2 gap-6">
                        <Card className="border-gray-100 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Risque Identité</CardTitle></CardHeader><CardContent>{verifications.length > 0 ? (<><div className={`text-2xl font-bold ${isIdentityVerified ? 'text-green-600' : 'text-red-600'}`}>{isIdentityVerified ? 'Vérifié' : 'Non Vérifié'}</div><div className="text-xs text-gray-400 mt-1">{verifications.length} tentative(s)</div></>) : (<div className="text-2xl font-bold text-gray-400">Aucune donnée</div>)}</CardContent></Card>
                        <Card className="border-gray-100 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Flotte Active</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-gray-900">{devices.length}</div><div className="text-xs text-gray-400 mt-1">Appareils loués</div></CardContent></Card>
                    </div>
                </div>
            )}

            {/* DEVICES SECTION (Standard UI) */}
            {activeSection === 'devices' && (
                <div className="space-y-6 p-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                    {devices.map(unit => (<div key={unit.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm"><div className="flex items-center gap-4"><div className="h-14 w-14 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 p-1">{unit.product?.image_url ? <img src={unit.product.image_url} className="w-full h-full object-contain" /> : <Laptop className="h-6 w-6 text-gray-300" />}</div><div><div className="font-bold text-gray-900">{unit.product?.name}</div><div className="text-xs text-gray-500 font-mono mt-1 flex items-center gap-2"><span className="bg-gray-100 px-1.5 py-0.5 rounded">S/N: {unit.serial_number}</span></div></div></div><div className="text-right"><div className="font-medium text-sm text-gray-500">Coût: ${unit.cost_price}</div><div className="font-bold text-sm">${unit.unit_price}</div><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mt-1">Actif</Badge></div></div>))}
                </div>
            )}

            {/* IDENTITY SECTION (Standard UI) */}
            {activeSection === 'identity' && (
                <div className="space-y-6 p-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-start"><div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">Historique KYC {isIdentityVerified && <CheckCircle2 className="h-6 w-6 text-green-500" />}</h1><p className="text-gray-500">Journal complet des vérifications d'identité biométriques.</p></div></div>
                    <div className="space-y-4">
                        {verifications.map((verif) => (<Card key={verif.id} onClick={() => setSelectedVerification(verif)} className="cursor-pointer hover:border-blue-300 transition-all border-gray-200 shadow-sm group"><div className="p-4 flex items-center justify-between"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${verif.status === 'approved' ? 'bg-green-100 text-green-600' : verif.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{verif.status === 'approved' ? <CheckCircle2 className="h-5 w-5" /> : verif.status === 'rejected' ? <XCircle className="h-5 w-5" /> : <Activity className="h-5 w-5" />}</div><div><div className="font-bold text-gray-900 flex items-center gap-2">{verif.status === 'approved' ? 'Validé' : verif.status === 'rejected' ? 'Rejeté' : 'En cours'}<span className="text-xs font-normal text-gray-400">• {new Date(verif.started_at).toLocaleString()}</span></div><div className="text-xs text-gray-500 flex items-center gap-3 mt-1"><span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Durée: {getDuration(verif.started_at, verif.completed_at)}</span><span className="flex items-center gap-1"><Fingerprint className="h-3 w-3" /> Score: {verif.verification_metadata?.trust_score || 0}%</span></div></div></div><div className="flex items-center gap-4">{verif.rejection_reason && (<Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 hidden sm:flex"><AlertTriangle className="h-3 w-3 mr-1" /> Motif: {verif.rejection_reason.split('|')[0].substring(0, 20)}...</Badge>)}<Button variant="ghost" size="sm" className="text-gray-400 group-hover:text-blue-600">Détails <Eye className="ml-2 h-4 w-4" /></Button></div></div></Card>))}
                    </div>
                </div>
            )}

            {/* --- ORACLE 3D SPATIAL UI (WHITE MODE) --- */}
            {activeSection === 'billing' && oracle && (
                <div 
                    className="relative w-full h-full flex items-center justify-center bg-gray-50 perspective-[2000px] overflow-hidden"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Background Gradients (Light) */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-100/50 rounded-full blur-[120px] mix-blend-multiply"></div>
                        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-100/50 rounded-full blur-[120px] mix-blend-multiply"></div>
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                    </div>

                    {/* 3D TILT CONTAINER */}
                    <div 
                        ref={containerRef}
                        className="relative w-[90%] max-w-6xl h-[85%] transition-transform duration-100 ease-out preserve-3d"
                        style={{ 
                            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                            transformStyle: 'preserve-3d'
                        }}
                    >
                        {/* --- FLOATING CARDS (KPIs) --- */}
                        <div className="absolute top-0 left-0 right-0 flex justify-between items-start translate-z-10 gap-6">
                            <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] w-1/3 transform hover:translate-y-[-10px] transition-transform duration-300">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Confiance (IA)</h3>
                                    <BrainCircuit className="h-5 w-5 text-indigo-500" />
                                </div>
                                <div className="text-4xl font-bold text-gray-900 mb-1">{oracle.trustScore}<span className="text-lg text-gray-400">/100</span></div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                                    <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500" style={{ width: `${oracle.trustScore}%` }}></div>
                                </div>
                            </div>

                            <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] w-1/3 transform hover:translate-y-[-10px] transition-transform duration-300 delay-75">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">ROI Net (24 Mois)</h3>
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div className="text-4xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                    {oracle.roiTotal > 0 ? '+' : ''}{oracle.roiTotal} $
                                </div>
                                <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md inline-block">
                                    Rentabilité : {oracle.profitMargin}%
                                </div>
                            </div>

                            <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] w-1/3 transform hover:translate-y-[-10px] transition-transform duration-300 delay-150">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Point de Rupture</h3>
                                    <Target className="h-5 w-5 text-orange-500" />
                                </div>
                                <div className="text-4xl font-bold text-gray-900 mb-1">{oracle.breakEven}</div>
                                <p className="text-xs text-gray-500">Zone de profitabilité atteinte.</p>
                            </div>
                        </div>

                        {/* --- MAIN CHART (FLOATING) --- */}
                        <div className="absolute top-[200px] bottom-[140px] left-0 right-0 bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] p-6 translate-z-20">
                            <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-blue-600" /> 
                                PROJECTION CASHFLOW (3 SCÉNARIOS)
                            </h3>
                            <ResponsiveContainer width="100%" height="85%">
                                <AreaChart data={oracle.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradOptimistic" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                                        <linearGradient id="gradProbable" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                                        <linearGradient id="gradPessimistic" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="month" tick={{fontSize: 12, fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                                    <YAxis tick={{fontSize: 12, fill: '#94a3b8'}} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}$`} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                                    <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                                    <ReferenceLine y={0} stroke="#cbd5e1" />
                                    
                                    <Area type="monotone" dataKey="Optimiste" stroke="#22c55e" strokeWidth={2} fill="url(#gradOptimistic)" name="Optimiste" />
                                    <Area type="monotone" dataKey="Probable" stroke="#3b82f6" strokeWidth={4} fill="url(#gradProbable)" name="Probable (IA)" />
                                    <Area type="monotone" dataKey="Catastrophe" stroke="#ef4444" strokeWidth={2} fill="url(#gradPessimistic)" name="Catastrophe" strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* --- BOTTOM CARDS (RECOMMENDATIONS & STRUCTURE) --- */}
                        <div className="absolute bottom-0 left-0 right-0 h-[120px] flex gap-6 translate-z-30">
                            
                            {/* RECOMMENDATION AI */}
                            <div className="flex-1 bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl p-5 shadow-lg flex items-center gap-4 hover:bg-white transition-colors">
                                <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                                    <Sparkles className="h-6 w-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Stratégie Recommandée</h4>
                                    <p className="text-sm font-medium text-gray-800">{oracle.recommendation}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px]">
                                            Action: {oracle.actionDate}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* STRUCTURE FINANCIERE (PREUVE 20%) */}
                            <div className="flex-1 bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl p-5 shadow-lg flex items-center justify-between hover:bg-white transition-colors">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Structure Capital</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                            <span className="text-gray-500">Coût Matériel:</span>
                                            <span className="font-mono font-bold">-${oracle.details.hardwareCost.toFixed(0)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                            <span className="text-gray-500">Dépôt (20%):</span>
                                            <span className="font-mono font-bold text-green-600">+{oracle.details.deposit.toFixed(0)}$</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 mb-1">Mensualité</div>
                                    <div className="text-2xl font-bold text-gray-900">{oracle.details.monthly.toFixed(2)}$</div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>

      <Dialog open={!!selectedVerification} onOpenChange={(o) => !o && setSelectedVerification(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">Rapport #...{selectedVerification?.id.slice(-6)} {selectedVerification?.status === 'approved' ? <Badge className="bg-green-600">Validé</Badge> : <Badge variant="destructive">Rejeté</Badge>}</DialogTitle>
                <DialogDescription>Date: {new Date(selectedVerification?.started_at || '').toLocaleString()}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 border rounded-md bg-slate-950 text-slate-300 font-mono text-xs p-4">
                <div className="space-y-1">{selectedVerification?.verification_metadata?.logs?.map((log, i) => (<div key={i} className="flex gap-2"><span className="text-slate-500 shrink-0">{log.substring(1, 9)}</span><span className={log.includes('FAIL') ? 'text-red-500 font-bold' : 'text-gray-500'}>{log.substring(11)}</span></div>))}</div>
            </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceCustomerDetails;