import { useMemo, useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
  ComposedChart, Line, Scatter, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Target, AlertTriangle, 
  DollarSign, Activity, BrainCircuit, ShieldCheck, 
  CreditCard, Calendar, Info, Zap, Battery, Cpu, 
  Umbrella, Flame, ArrowRightLeft, Layers, Sliders, RefreshCw, Terminal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
      <div className="bg-white/95 backdrop-blur border border-gray-200 p-4 rounded-xl shadow-xl text-xs font-mono z-50">
        <p className="font-bold text-gray-500 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
            <span className="text-gray-600 capitalize">{entry.name}:</span>
            <span className={`font-bold ${entry.value < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {entry.name === 'Entropie' || entry.name === 'Santé' ? `${entry.value}%` : formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Composant Slider Custom pour éviter les dépendances manquantes
const RangeSlider = ({ value, min, max, onChange, label, unit }: any) => (
    <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium text-gray-600">
            <span>{label}</span>
            <span className="font-mono text-blue-600">{value}{unit}</span>
        </div>
        <input 
            type="range" 
            min={min} 
            max={max} 
            value={value} 
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
    </div>
);

export default function OraclePanel({ data }: { data: OracleData }) {
  // --- ÉTAT DU CHAOS ENGINE (PARAMÈTRES DYNAMIQUES) ---
  const [marketVolatility, setMarketVolatility] = useState(15); // %
  const [inflationRate, setInflationRate] = useState(3); // %
  const [usageIntensity, setUsageIntensity] = useState(1.0); // Multiplicateur
  const [depreciationModel, setDepreciationModel] = useState<'linear' | 'accelerated' | 'crash'>('linear');
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Générateur de logs "Matrix"
  useEffect(() => {
      const actions = ["Recalculating vectors...", "Adjusting depreciation curve...", "Fetching market rates...", "Analyzing risk delta...", "Updating Monte Carlo seed..."];
      const interval = setInterval(() => {
          if (Math.random() > 0.7) {
              const newLog = `[${new Date().toLocaleTimeString()}] ${actions[Math.floor(Math.random() * actions.length)]}`;
              setSimulationLogs(prev => [...prev.slice(-4), newLog]);
          }
      }, 2000);
      return () => clearInterval(interval);
  }, [marketVolatility, inflationRate]);

  // Calculs dérivés STATIQUES (Base)
  const breakEvenIndex = data.chartData.findIndex(d => d.probable >= 0);
  const totalExposure = data.details.hardwareCost - data.details.deposit;
  
  const riskLevel = data.trustScore >= 80 ? 'Faible' : data.trustScore >= 50 ? 'Moyen' : 'Critique';
  const riskColor = data.trustScore >= 80 ? 'bg-emerald-500' : data.trustScore >= 50 ? 'bg-amber-500' : 'bg-red-500';

  // --- DYNAMIC ENGINE (LE COEUR DU RÉACTEUR) ---
  
  // 1. DYNAMIC MONTE CARLO
  const dynamicMonteCarlo = useMemo(() => {
    // Le TrustScore influence la volatilité de base
    const baseVolatility = (100 - data.trustScore) / 100; 
    // Le Slider ajoute du chaos externe
    const totalVolatility = baseVolatility + (marketVolatility / 100);
    
    // Impact de l'inflation sur la valeur réelle de l'argent (Cashflow actualisé)
    const inflationFactor = 1 - (inflationRate / 100);

    return data.chartData.map((d, i) => {
        const uncertainty = (data.details.monthly * i) * totalVolatility;
        // Application de l'inflation composée
        const realValueProbable = d.probable * Math.pow(inflationFactor, i/12);
        
        return {
            month: d.month,
            p95: realValueProbable + (uncertainty * 1.2), // Bull case
            p50: realValueProbable, // Base case actualisé
            p05: realValueProbable - (uncertainty * 1.8), // Bear case (Risque asymétrique)
            rawProbable: d.probable // Pour comparaison
        };
    });
  }, [data, marketVolatility, inflationRate]);

  // 2. DYNAMIC RESIDUAL VALUE
  const dynamicFlipData = useMemo(() => {
      const initialValue = data.details.hardwareCost;
      let monthlyDepreciation = 0;

      // Choix du modèle mathématique
      if (depreciationModel === 'linear') monthlyDepreciation = 0.025; // 2.5% standard
      else if (depreciationModel === 'accelerated') monthlyDepreciation = 0.045; // 4.5% heavy usage
      else monthlyDepreciation = 0.08; // 8% Market Crash

      // Ajustement par l'intensité d'usage (Le slider "Usure")
      const effectiveDepreciation = monthlyDepreciation * usageIntensity;

      let currentValue = initialValue;
      
      const res = dynamicMonteCarlo.map((d, i) => {
          if (i > 0) currentValue = currentValue * (1 - effectiveDepreciation);
          
          // La valeur résiduelle ne peut pas être négative
          currentValue = Math.max(100, currentValue);

          return {
              month: d.month,
              cashAccumulated: Math.round(d.p50), // On utilise le probable actualisé
              hardwareValue: Math.round(currentValue),
              totalExitValue: Math.round(d.p50 + currentValue)
          };
      });

      const maxExit = Math.max(...res.map(r => r.totalExitValue));
      const flipMonth = res.findIndex(r => r.totalExitValue === maxExit);

      return { chart: res, flipMonth, maxExit, endValue: Math.round(currentValue) };
  }, [data, dynamicMonteCarlo, depreciationModel, usageIntensity]);

  // 3. RADAR DE RISQUE (MULTIDIMENSIONNEL)
  const radarData = useMemo(() => {
      // Normalisation des métriques sur 100
      const liquidity = Math.min(100, (data.details.deposit / data.details.hardwareCost) * 300); // Couverture du dépôt
      const solvency = data.trustScore; // Score IA
      const profitability = Math.min(100, parseFloat(data.profitMargin) * 2); // Marge boostée
      const resilience = 100 - marketVolatility; // Inverse de la volatilité choisie
      const hardwareHealth = Math.max(0, 100 - (usageIntensity * 20)); // Impact usage

      return [
          { subject: 'Solvabilité', A: solvency, fullMark: 100 },
          { subject: 'Liquidité', A: liquidity, fullMark: 100 },
          { subject: 'Marge', A: profitability, fullMark: 100 },
          { subject: 'Hardware', A: hardwareHealth, fullMark: 100 },
          { subject: 'Marché', A: resilience, fullMark: 100 },
          { subject: 'Stabilité', A: Math.max(0, 100 - (inflationRate * 5)), fullMark: 100 },
      ];
  }, [data, marketVolatility, usageIntensity, inflationRate]);

  return (
    <div className="h-full bg-[#F8F9FA] p-6 font-sans overflow-y-auto">
      
      {/* TOP HEADER : KPIs DYNAMIQUES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white border-blue-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10"><Target size={60} /></div>
            <CardContent className="p-4">
                <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-1">Point de Sortie Optimal</p>
                <h3 className="text-2xl font-bold text-gray-900">Mois {dynamicFlipData.flipMonth}</h3>
                <div className="flex items-center gap-1 text-xs text-green-600 font-medium mt-1">
                    <TrendingUp size={12} /> Max Value: {formatCurrency(dynamicFlipData.maxExit)}
                </div>
            </CardContent>
        </Card>

        <Card className="bg-white border-green-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10"><DollarSign size={60} /></div>
            <CardContent className="p-4">
                <p className="text-xs text-green-600 font-bold uppercase tracking-wider mb-1">Valeur Matériel (M24)</p>
                <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(dynamicFlipData.endValue)}</h3>
                <p className="text-xs text-gray-400 mt-1">Après dépréciation {usageIntensity}x</p>
            </CardContent>
        </Card>

        <Card className="bg-white border-purple-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10"><Activity size={60} /></div>
            <CardContent className="p-4">
                <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">Volatilité Simulée</p>
                <h3 className="text-2xl font-bold text-gray-900">± {marketVolatility}%</h3>
                <div className="w-full bg-gray-100 h-1 mt-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${marketVolatility}%` }}></div>
                </div>
            </CardContent>
        </Card>

        <Card className="bg-black text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-20"><BrainCircuit size={60} /></div>
            <CardContent className="p-4">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Trust Score IA</p>
                <h3 className="text-2xl font-bold">{data.trustScore}/100</h3>
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><ShieldCheck size={12} /> {riskLevel}</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SIMULATION CONTROLS (THE CHAOS ENGINE) */}
        <div className="lg:col-span-3 space-y-6">
            <Card className="border-gray-200 shadow-sm bg-white">
                <CardHeader className="pb-3 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-gray-900" />
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Chaos Engine</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <RangeSlider 
                        label="Volatilité Marché" 
                        value={marketVolatility} 
                        min={0} max={50} 
                        unit="%"
                        onChange={setMarketVolatility} 
                    />
                    <RangeSlider 
                        label="Inflation" 
                        value={inflationRate} 
                        min={0} max={20} 
                        unit="%"
                        onChange={setInflationRate} 
                    />
                    <RangeSlider 
                        label="Intensité Usage" 
                        value={usageIntensity} 
                        min={0.5} max={3.0} 
                        unit="x"
                        onChange={setUsageIntensity} 
                    />
                    
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        <Label className="text-xs font-medium text-gray-600">Modèle de Dépréciation</Label>
                        <div className="grid grid-cols-3 gap-1">
                            <button onClick={() => setDepreciationModel('linear')} className={`text-[10px] py-1 px-2 rounded border transition-all ${depreciationModel === 'linear' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>Linéaire</button>
                            <button onClick={() => setDepreciationModel('accelerated')} className={`text-[10px] py-1 px-2 rounded border transition-all ${depreciationModel === 'accelerated' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-gray-200 text-gray-500'}`}>Accéléré</button>
                            <button onClick={() => setDepreciationModel('crash')} className={`text-[10px] py-1 px-2 rounded border transition-all ${depreciationModel === 'crash' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-500'}`}>Crash</button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* LIVE TERMINAL */}
            <Card className="bg-slate-950 border-slate-900 shadow-md text-green-500 font-mono text-[10px] overflow-hidden">
                <div className="p-2 border-b border-slate-800 flex items-center gap-2">
                    <Terminal className="h-3 w-3" />
                    <span className="text-slate-400">oracle_v3.exe - --live</span>
                </div>
                <div className="p-3 h-32 flex flex-col justify-end space-y-1 opacity-90">
                    {simulationLogs.map((log, i) => (
                        <div key={i} className="truncate animate-in slide-in-from-left-2 fade-in duration-300">
                            <span className="mr-2 text-slate-600">{`>`}</span>
                            {log}
                        </div>
                    ))}
                </div>
            </Card>
        </div>

        {/* CENTER COLUMN: MAIN CHARTS */}
        <div className="lg:col-span-6 space-y-6">
            <Tabs defaultValue="cashflow">
                <div className="flex justify-between items-center mb-4">
                    <TabsList className="bg-white border border-gray-200 h-9">
                        <TabsTrigger value="cashflow" className="text-xs">Flux de Trésorerie</TabsTrigger>
                        <TabsTrigger value="valuation" className="text-xs">Valuation Actif</TabsTrigger>
                    </TabsList>
                    <Badge variant="outline" className="font-mono text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        {simulationLogs.length % 2 === 0 ? 'SYNC' : 'UPDATING...'}
                    </Badge>
                </div>

                <TabsContent value="cashflow" className="mt-0">
                    <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-4">
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dynamicMonteCarlo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val/1000}k`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <ReferenceLine y={0} stroke="#9CA3AF" />
                                        
                                        {/* Cône de probabilité */}
                                        <Area type="monotone" dataKey="p95" stackId="1" stroke="transparent" fill="transparent" />
                                        <Area type="monotone" dataKey="p05" stackId="1" stroke="#818cf8" fill="#e0e7ff" strokeWidth={1} name="Volatilité (Cygne Noir)" />
                                        <Area type="monotone" dataKey="p50" stroke="#4f46e5" strokeWidth={3} fill="url(#colorP50)" name="Probable" activeDot={{ r: 6 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="valuation" className="mt-0">
                    <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-4">
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={dynamicFlipData.chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} />
                                        <Tooltip content={<CustomTooltip />} />
                                        
                                        <Area type="monotone" dataKey="cashAccumulated" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} name="Cash Net" />
                                        <Line type="monotone" dataKey="hardwareValue" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" name="Valeur Matériel" dot={false} />
                                        <Line type="monotone" dataKey="totalExitValue" stroke="#10b981" strokeWidth={2} name="Valeur Sortie Totale" dot={false} />
                                        
                                        {dynamicFlipData.flipMonth > 0 && (
                                            <ReferenceLine x={`M${dynamicFlipData.flipMonth}`} stroke="#10B981" label={{ position: 'insideTop', value: 'FLIP', fill: '#10B981', fontSize: 10, fontWeight: 'bold' }} />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>

        {/* RIGHT COLUMN: RADAR & METRICS */}
        <div className="lg:col-span-3 space-y-6">
            <Card className="border-gray-200 shadow-sm bg-white h-[300px]">
                <CardHeader className="pb-0">
                    <CardTitle className="text-sm font-bold uppercase text-gray-500 tracking-wider text-center">Radar de Risque</CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-full">
                    <ResponsiveContainer width="100%" height="90%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <PolarGrid stroke="#e5e7eb" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Client" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.3} />
                        </RadarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Flame size={18} /></div>
                        <div><p className="text-xs text-gray-500 font-bold uppercase">Entropie (Usure)</p><p className="text-sm font-bold text-gray-900">{(usageIntensity * 100).toFixed(0)}% / an</p></div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Umbrella size={18} /></div>
                        <div><p className="text-xs text-gray-500 font-bold uppercase">Résistance Crise</p><p className="text-sm font-bold text-gray-900">{marketVolatility > 20 ? 'Faible' : 'Forte'}</p></div>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}