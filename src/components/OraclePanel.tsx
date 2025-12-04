import { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
  ComposedChart, Line, Scatter
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Target, AlertTriangle, 
  DollarSign, Activity, BrainCircuit, ShieldCheck, 
  CreditCard, Calendar, Info, Zap, Battery, Cpu, 
  Umbrella, Flame, ArrowRightLeft, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface OracleData {
  chartData: any[];
  breakEven: string;
  roiTotal: number;
  profitMargin: string;
  trustScore: number;
  recommendation: string;
  actionDate: string;
  statusColor: string;
  details: {
    deposit: number;
    monthly: number;
    hardwareCost: number;
  };
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur border border-gray-200 p-4 rounded-xl shadow-xl text-xs font-mono">
        <p className="font-bold text-gray-500 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
            <span className="text-gray-600 capitalize">{entry.name}:</span>
            <span className="font-bold text-gray-900">
              {entry.name === 'Entropie' ? `${entry.value}%` : formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function OraclePanel({ data }: { data: OracleData }) {
  const [activeScenario, setActiveScenario] = useState<string>('probable');
  const [blackSwanMode, setBlackSwanMode] = useState<'none' | 'recession' | 'inflation' | 'supply_chain'>('none');

  // Calculs dérivés pour l'affichage
  const breakEvenIndex = data.chartData.findIndex(d => d.probable >= 0);
  const totalExposure = data.details.hardwareCost - data.details.deposit;
  const monthlyProfit = data.details.monthly;
  
  const riskLevel = data.trustScore >= 80 ? 'Faible' : data.trustScore >= 50 ? 'Moyen' : 'Critique';
  const riskColor = data.trustScore >= 80 ? 'bg-emerald-500' : data.trustScore >= 50 ? 'bg-amber-500' : 'bg-red-500';

  // --- FORENSICS CALCULATIONS ---

  // 1. MONTE CARLO (Simulation Stochastique)
  // On génère un cône de probabilité basé sur la volatilité du client (Trust Score)
  const monteCarloData = useMemo(() => {
    const volatility = (100 - data.trustScore) / 100; // Plus le score est bas, plus la volatilité est haute
    const iterations = 24;
    const baseFlow = data.chartData.map(d => d.probable);
    
    return baseFlow.map((val, i) => {
        // Écart type qui grandit avec le temps (Incertitude temporelle)
        const uncertainty = (data.details.monthly * i) * volatility * 0.8;
        
        return {
            month: `M${i}`,
            p95: val + uncertainty, // Best case (Lucky)
            p50: val,               // Base case
            p05: val - (uncertainty * 1.5) // Worst case (Disaster) - On penalise plus le downside
        };
    });
  }, [data]);

  // 2. RESIDUAL VALUE & FLIP POINT
  // Courbe de dépréciation vs Revenus cumulés
  const flipPointData = useMemo(() => {
      const depreciationRate = 0.025; // 2.5% par mois (Standard IT Hardware)
      const initialValue = data.details.hardwareCost;
      let currentValue = initialValue;
      let flipMonth = -1;

      const res = data.chartData.map((d, i) => {
          // Revenu Net Cumulé (Cash IN - Cash OUT)
          // Note: chartData.probable est déjà le cumulé net
          // On veut comparer "Cash en banque" vs "Valeur si je vends l'ordi"
          
          // Valeur marchande de l'ordi
          if (i > 0) currentValue = currentValue * (1 - depreciationRate);
          
          // Valeur de sortie totale = Cash généré + Valeur Revente - Reste dû (si applicable)
          const exitValue = d.probable + currentValue;

          // Détection du point optimal (quand la courbe commence à s'aplatir ou croiser)
          // Ici on cherche le "Sweet Spot" où ExitValue est maximisée par rapport au temps
          
          return {
              month: `M${i}`,
              cashAccumulated: d.probable,
              hardwareValue: Math.round(currentValue),
              totalExitValue: Math.round(exitValue)
          };
      });

      // Trouver le mois où totalExitValue est le plus haut (Peak Profitability)
      const maxExit = Math.max(...res.map(r => r.totalExitValue));
      flipMonth = res.findIndex(r => r.totalExitValue === maxExit);

      return { chart: res, flipMonth, maxExit };
  }, [data]);

  // 3. BLACK SWAN IMPACT
  const blackSwanImpact = useMemo(() => {
      let impactLabel = "Normal";
      let roiAdjustment = 0;
      let description = "Conditions de marché standards.";

      switch (blackSwanMode) {
          case 'recession':
              impactLabel = "Récession (-30%)";
              roiAdjustment = data.roiTotal * 0.7; // 30% de perte de revenus (défauts)
              description = "Chômage élevé. Augmentation du taux de défaut de paiement de 30%.";
              break;
          case 'inflation':
              impactLabel = "Hyper-Inflation";
              roiAdjustment = data.roiTotal - (data.roiTotal * 0.15); // L'argent vaut moins
              description = "Coûts opérationnels +15%. Valeur réelle du cashflow réduite.";
              break;
          case 'supply_chain':
              impactLabel = "Pénurie Pièces";
              roiAdjustment = data.roiTotal - 200; // Coût réparation explose
              description = "Coût des réparations/remplacement x3. Impact direct sur marge.";
              break;
          default:
              roiAdjustment = data.roiTotal;
      }
      return { label: impactLabel, roi: Math.round(roiAdjustment), desc: description };
  }, [blackSwanMode, data]);

  // 4. ENTROPY (Usure Matérielle)
  // Basé sur un profil d'usage théorique "Power User" vs "Admin"
  const entropyData = useMemo(() => {
      // Si trustScore est haut, on suppose un usage "Pro" (soigneux mais intensif)
      // Si trustScore bas, usage "Risqué" (négligent)
      const usageIntensity = data.trustScore > 70 ? 0.8 : 1.2; 
      
      const batteryHealth = Math.max(0, 100 - (16 * 1.5 * usageIntensity)); // ~1.5% par mois
      const ssdLife = Math.max(0, 100 - (16 * 0.5 * usageIntensity));
      const cosmeticGrade = data.trustScore > 80 ? 'Grade A' : data.trustScore > 50 ? 'Grade B' : 'Grade C';

      return { battery: Math.round(batteryHealth), ssd: Math.round(ssdLife), cosmetic: cosmeticGrade };
  }, [data]);

  return (
    <div className="h-full bg-gray-50/50 p-6 font-sans overflow-y-auto">
      
      {/* HEADER: KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Point de Rupture</p>
              <h3 className="text-lg font-bold text-gray-900">{data.breakEven}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">ROI Projeté (24M)</p>
              <h3 className={`text-lg font-bold ${data.roiTotal > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.roiTotal)}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Marge Nette</p>
              <h3 className="text-lg font-bold text-gray-900">{data.profitMargin}%</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${riskColor}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Confiance IA</p>
              <h3 className="text-lg font-bold text-gray-900">{data.trustScore}/100</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="standard" className="space-y-6">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-xl">
            <TabsTrigger value="standard" className="data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900">Standard View</TabsTrigger>
            <TabsTrigger value="forensics" className="data-[state=active]:bg-black data-[state=active]:text-white flex items-center gap-2"><BrainCircuit className="h-3 w-3" /> Forensics (Deep Dive)</TabsTrigger>
        </TabsList>

        {/* --- VUE STANDARD (EXISTANTE) --- */}
        <TabsContent value="standard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-gray-200 shadow-sm">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg font-semibold text-gray-900">Projection de Trésorerie Cumulée</CardTitle>
                            <CardDescription>Simulation des flux financiers nets sur 24 mois.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Optimiste</Badge>
                            <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Probable</Badge>
                            <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">Pessimiste</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorProbable" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickMargin={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}$`} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
                        {breakEvenIndex > -1 && (
                            <ReferenceLine x={`M${breakEvenIndex}`} stroke="#10B981" strokeDasharray="3 3" label={{ position: 'top', value: 'Point Mort', fill: '#10B981', fontSize: 12 }} />
                        )}
                        <Area type="monotone" dataKey="optimistic" stroke="#22c55e" strokeWidth={2} fill="none" name="Optimiste" activeDot={{ r: 6 }} />
                        <Area type="monotone" dataKey="probable" stroke="#3b82f6" strokeWidth={3} fill="url(#colorProbable)" name="Probable" activeDot={{ r: 8 }} />
                        <Area type="monotone" dataKey="pessimistic" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" fill="none" name="Pessimiste" />
                        </AreaChart>
                    </ResponsiveContainer>
                    </div>
                </CardContent>
                </Card>

                {/* SIDEBAR ANALYTICS */}
                <div className="space-y-6">
                    {/* UNIT ECONOMICS */}
                    <Card className="border-gray-200 shadow-sm bg-white">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold uppercase text-gray-500 tracking-wider">Unit Economics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm"><span className="text-gray-500">Coût Matériel (Achat)</span><span className="font-mono text-red-600 font-medium">-{formatCurrency(data.details.hardwareCost)}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-gray-500">Dépôt Client (20%)</span><span className="font-mono text-green-600 font-medium">+{formatCurrency(data.details.deposit)}</span></div>
                                <div className="h-px bg-gray-100 w-full my-2"></div>
                                <div className="flex justify-between text-sm"><span className="font-medium text-gray-900">Exposition Initiale</span><span className="font-mono font-bold text-gray-900">-{formatCurrency(totalExposure)}</span></div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="flex items-center gap-2 mb-2"><CreditCard className="h-4 w-4 text-blue-500" /><span className="text-xs font-bold text-blue-700">REVENU MENSUEL</span></div>
                                <div className="flex justify-between items-end"><span className="text-2xl font-bold text-gray-900">{formatCurrency(monthlyProfit)}</span><span className="text-xs text-gray-500 mb-1">/ mois</span></div>
                                <div className="mt-2 w-full bg-gray-200 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-500 h-full w-[85%]"></div></div>
                                <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>Frais Stripe & Ops estimés à 3.5%</span></div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* RISK ANALYSIS */}
                    <Card className="border-gray-200 shadow-sm bg-white">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center"><CardTitle className="text-sm font-bold uppercase text-gray-500 tracking-wider">Analyse de Risque</CardTitle><Badge variant="outline" className={`${riskColor} bg-opacity-10 text-opacity-100 border-0`}>{riskLevel}</Badge></div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Probabilité de défaut</span><span className="font-bold text-gray-900">{(100 - data.trustScore).toFixed(1)}%</span></div>
                                <Progress value={100 - data.trustScore} className={`h-2 bg-gray-100 [&>*]:${data.trustScore < 50 ? 'bg-red-500' : 'bg-amber-500'}`} />
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex items-start gap-3"><BrainCircuit className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" /><div><h4 className="text-sm font-bold text-gray-900 mb-1">Recommendation IA</h4><p className="text-xs text-gray-600 leading-relaxed">{data.recommendation}</p><div className="mt-3 flex items-center gap-2"><Badge variant="secondary" className="bg-white border border-gray-200 text-xs font-mono">ACTION: {data.actionDate.toUpperCase()}</Badge></div></div></div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>

        {/* --- VUE FORENSICS (NEW) --- */}
        <TabsContent value="forensics" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. MONTE CARLO (Cône de Probabilité) */}
                <Card className="border-gray-200 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-1"><Activity className="h-5 w-5 text-indigo-600" /><CardTitle className="text-base font-bold">Simulation Monte Carlo (1000 iter)</CardTitle></div>
                        <CardDescription>Cône de probabilité des flux de trésorerie selon la volatilité du client.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monteCarloData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorUncertainty" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} />
                                    <Tooltip content={<CustomTooltip />} />
                                    {/* Zone d'incertitude (Range P05 - P95) */}
                                    <Area type="monotone" dataKey="p95" stackId="1" stroke="transparent" fill="transparent" />
                                    <Area type="monotone" dataKey="p05" stackId="1" stroke="#6366f1" fill="url(#colorUncertainty)" strokeWidth={1} name="Zone de Volatilité" />
                                    <Area type="monotone" dataKey="p50" stroke="#4f46e5" strokeWidth={2} fill="none" name="Médiane (Probable)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                            <span>Volatilité estimée: <strong>{((100 - data.trustScore) / 100 * 20).toFixed(1)}%</strong></span>
                            <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Intervalle de confiance 90%</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. RESIDUAL VALUE & FLIP POINT */}
                <Card className="border-gray-200 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-1"><ArrowRightLeft className="h-5 w-5 text-orange-600" /><CardTitle className="text-base font-bold">Valeur Résiduelle & Flip Point</CardTitle></div>
                        <CardDescription>Croisement des courbes: Revenus vs Dépréciation Matérielle.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={flipPointData.chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} />
                                    <Tooltip content={<CustomTooltip />} />
                                    
                                    <Area type="monotone" dataKey="cashAccumulated" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} name="Cash Accumulé" />
                                    <Line type="monotone" dataKey="hardwareValue" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" name="Valeur Matériel" dot={false} />
                                    
                                    {/* Flip Point Marker */}
                                    {flipPointData.flipMonth > 0 && (
                                        <ReferenceLine x={`M${flipPointData.flipMonth}`} stroke="#10B981" label={{ position: 'insideTop', value: 'FLIP', fill: '#10B981', fontSize: 10, fontWeight: 'bold' }} />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs bg-orange-50 p-3 rounded-lg border border-orange-100">
                            <div className="flex flex-col">
                                <span className="text-gray-500 uppercase font-bold text-[10px]">Optimal Exit</span>
                                <span className="text-lg font-bold text-gray-900">Mois {flipPointData.flipMonth}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-gray-500 block">Valeur Totale Max</span>
                                <span className="font-mono font-bold text-green-600">{formatCurrency(flipPointData.maxExit)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. CYGNES NOIRS (Stress Test) */}
                <Card className="border-gray-200 shadow-sm bg-slate-50">
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-1"><Umbrella className="h-5 w-5 text-slate-700" /><CardTitle className="text-base font-bold">Cygnes Noirs (Stress Test)</CardTitle></div>
                        <CardDescription>Simulation de crises macro-économiques majeures.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mb-6">
                            {['none', 'recession', 'inflation', 'supply_chain'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setBlackSwanMode(mode as any)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                                        blackSwanMode === mode 
                                        ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    {mode === 'none' ? 'Normal' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                        
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-slate-900">{blackSwanImpact.label}</h4>
                                    <p className="text-xs text-slate-500 mt-1">{blackSwanImpact.desc}</p>
                                </div>
                                <div className={`text-xl font-bold ${blackSwanImpact.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(blackSwanImpact.roi)}
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                                <div 
                                    className={`h-full transition-all duration-500 ${blackSwanImpact.roi > 0 ? 'bg-green-500' : 'bg-red-500'}`} 
                                    style={{ width: `${Math.min(100, Math.max(0, (blackSwanImpact.roi / data.roiTotal) * 100))}%` }}
                                ></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. ENTROPY GAUGE */}
                <Card className="border-gray-200 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-1"><Flame className="h-5 w-5 text-red-500" /><CardTitle className="text-base font-bold">Entropie Matérielle</CardTitle></div>
                        <CardDescription>Estimation de l'usure physique en fin de contrat (M24).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-xs mb-1 font-medium">
                                    <span className="flex items-center gap-1"><Battery className="h-3 w-3" /> Santé Batterie</span>
                                    <span>{entropyData.battery}%</span>
                                </div>
                                <Progress value={entropyData.battery} className="h-2 bg-gray-100 [&>*]:bg-green-500" />
                            </div>
                            
                            <div>
                                <div className="flex justify-between text-xs mb-1 font-medium">
                                    <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Durée de vie SSD</span>
                                    <span>{entropyData.ssd}%</span>
                                </div>
                                <Progress value={entropyData.ssd} className="h-2 bg-gray-100 [&>*]:bg-blue-500" />
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <span className="text-xs text-gray-500 font-medium">État Cosmétique Estimé</span>
                                <Badge variant={entropyData.cosmetic === 'Grade A' ? 'default' : 'secondary'} className={entropyData.cosmetic === 'Grade A' ? 'bg-green-600' : ''}>
                                    {entropyData.cosmetic}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </TabsContent>
      </Tabs>

      {/* DETAILED SCENARIO TABLE (Toujours visible) */}
      <Card className="mt-6 border-gray-200 shadow-sm">
        <CardHeader>
            <CardTitle className="text-lg font-semibold">Matrice des Flux Nets (Cashflow)</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 rounded-l-lg">Période</th>
                            <th className="px-4 py-3">Pessimiste (Crash)</th>
                            <th className="px-4 py-3 font-bold text-blue-700 bg-blue-50">Probable (Ajusté)</th>
                            <th className="px-4 py-3 rounded-r-lg">Optimiste (Idéal)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {[0, 6, 12, 16, 24].map((month) => {
                            const row = data.chartData[month];
                            if (!row) return null;
                            return (
                                <tr key={month} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900">Mois {month}</td>
                                    <td className="px-4 py-3 font-mono text-red-600">{formatCurrency(row.pessimistic)}</td>
                                    <td className="px-4 py-3 font-mono font-bold text-blue-700 bg-blue-50/30">{formatCurrency(row.probable)}</td>
                                    <td className="px-4 py-3 font-mono text-green-600">{formatCurrency(row.optimistic)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}