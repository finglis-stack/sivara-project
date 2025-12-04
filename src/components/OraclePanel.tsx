import { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  ComposedChart, Line, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  Target, DollarSign, Activity, ShieldCheck, 
  CreditCard, TrendingUp, TrendingDown, AlertTriangle, 
  Settings2, Calculator, BarChart3, PieChart, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

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
      <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-lg text-xs">
        <p className="font-bold text-gray-700 mb-2 border-b pb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-1">
            <span className="text-gray-600 capitalize flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
              {entry.name}:
            </span>
            <span className={`font-mono font-bold ${entry.value < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {entry.name.includes('%') ? `${entry.value}%` : formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const MetricCard = ({ title, value, icon: Icon, subtext, trend }: any) => (
  <Card className="border-gray-200 shadow-sm">
    <CardContent className="p-5">
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
        <div className={`p-1.5 rounded-md ${trend === 'positive' ? 'bg-green-50 text-green-600' : trend === 'negative' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
          <Icon size={16} />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
      {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
    </CardContent>
  </Card>
);

const RangeInput = ({ label, value, min, max, unit, onChange }: any) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      <Badge variant="outline" className="font-mono text-xs bg-white text-gray-900 border-gray-300">
        {value}{unit}
      </Badge>
    </div>
    <input 
      type="range" min={min} max={max} step={unit === 'x' ? 0.1 : 1} value={value} 
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
    />
  </div>
);

export default function OraclePanel({ data }: { data: OracleData }) {
  // Paramètres de simulation (Défaut = Marché actuel)
  const [volatility, setVolatility] = useState(5); // 5% Standard deviation
  const [inflation, setInflation] = useState(2); // 2% Inflation cible
  const [depreciationMode, setDepreciationMode] = useState<'standard' | 'accelerated'>('standard');

  // 1. PROJECTION FINANCIÈRE (AJUSTÉE)
  const financialProjection = useMemo(() => {
    // Facteur d'actualisation (Discounted Cash Flow)
    const discountRate = (inflation / 100) / 12; 
    
    // Impact du risque client sur la variance
    const clientRiskPremium = (100 - data.trustScore) / 1000; 
    
    return data.chartData.map((d, i) => {
      // Valeur Actuelle Nette (VAN)
      const npv = d.probable / Math.pow(1 + discountRate, i);
      
      // Écart-type (Risque)
      const sigma = (data.details.monthly * Math.sqrt(i)) * ((volatility / 100) + clientRiskPremium);

      return {
        month: d.month,
        optimistic: Math.round(npv + sigma),
        base: Math.round(npv),
        pessimistic: Math.round(npv - (sigma * 1.5)), // Risque asymétrique
        raw: d.probable
      };
    });
  }, [data, volatility, inflation]);

  // 2. VALORISATION DES ACTIFS (ASSET VALUATION)
  const assetValuation = useMemo(() => {
    const initialVal = data.details.hardwareCost;
    // Taux d'amortissement mensuel
    const deprRate = depreciationMode === 'standard' ? 0.025 : 0.045; // 2.5% vs 4.5%
    
    let currentVal = initialVal;
    let flipMonth = -1;
    let maxTotalValue = -Infinity;

    const chart = financialProjection.map((d, i) => {
      if (i > 0) currentVal = currentVal * (1 - deprRate);
      
      // Valeur de Liquidation = Cash généré + Valeur Revente Matériel
      const liquidationValue = d.base + currentVal;
      
      if (liquidationValue > maxTotalValue) {
        maxTotalValue = liquidationValue;
        flipMonth = i;
      }

      return {
        month: d.month,
        cash: d.base,
        asset: Math.round(currentVal),
        total: Math.round(liquidationValue)
      };
    });

    return { chart, flipMonth, maxTotalValue, endAssetValue: Math.round(currentVal) };
  }, [data, financialProjection, depreciationMode]);

  // 3. SCORING RISQUE (RADAR)
  const riskRadar = useMemo(() => [
    { metric: 'Solvabilité', value: data.trustScore, full: 100 },
    { metric: 'Liquidité', value: Math.min(100, (data.details.deposit / data.details.hardwareCost) * 400), full: 100 }, // Ratio couverture
    { metric: 'Rentabilité', value: Math.min(100, parseFloat(data.profitMargin) * 2), full: 100 },
    { metric: 'Stabilité Marché', value: 100 - volatility, full: 100 },
    { metric: 'Val. Résiduelle', value: Math.min(100, (assetValuation.endAssetValue / data.details.hardwareCost) * 200), full: 100 },
  ], [data, volatility, assetValuation]);

  return (
    <div className="h-full bg-gray-50/50 p-6 font-sans overflow-y-auto">
      
      {/* SECTION 1: KPIs FINANCIERS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard 
          title="Rentabilité Nette (24M)" 
          value={formatCurrency(data.roiTotal)} 
          icon={DollarSign} 
          trend={data.roiTotal > 0 ? 'positive' : 'negative'}
          subtext={`Marge brute: ${data.profitMargin}%`}
        />
        <MetricCard 
          title="Point Mort (BEP)" 
          value={data.breakEven} 
          icon={Target} 
          subtext="Retour sur investissement"
        />
        <MetricCard 
          title="Valeur de Sortie Max" 
          value={formatCurrency(assetValuation.maxTotalValue)} 
          icon={TrendingUp} 
          trend="positive"
          subtext={`Optimale au mois ${assetValuation.flipMonth}`}
        />
        <MetricCard 
          title="Score de Confiance" 
          value={`${data.trustScore}/100`} 
          icon={ShieldCheck} 
          trend={data.trustScore > 75 ? 'positive' : data.trustScore < 50 ? 'negative' : 'neutral'}
          subtext={data.trustScore > 75 ? 'Risque Faible' : 'Surveillance Requise'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLONNE GAUCHE : CONTRÔLES DE SIMULATION */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-gray-700" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-600">Paramètres de Simulation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <RangeInput 
                label="Volatilité Marché" 
                value={volatility} 
                min={0} max={30} unit="%" 
                onChange={setVolatility} 
              />
              <RangeInput 
                label="Inflation (IPC)" 
                value={inflation} 
                min={0} max={15} unit="%" 
                onChange={setInflation} 
              />
              
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <Label className="text-xs font-medium text-gray-700">Modèle d'Amortissement</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setDepreciationMode('standard')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${depreciationMode === 'standard' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    Standard (2.5%)
                  </button>
                  <button 
                    onClick={() => setDepreciationMode('accelerated')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${depreciationMode === 'accelerated' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    Accéléré (4.5%)
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 leading-relaxed flex gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Les projections incluent les frais de plateforme (2.9%) et une provision pour risque de {((100-data.trustScore)/1000 * 100).toFixed(1)}%.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm overflow-hidden">
             <CardHeader className="pb-2 bg-gray-50 border-b border-gray-100">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">Analyse de Solvabilité</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="h-[250px] w-full bg-white relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={riskRadar}>
                            <PolarGrid stroke="#e5e7eb" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 600 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Client" dataKey="value" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.2} />
                        </RadarChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 font-mono">Scoring v3.1</div>
                </div>
             </CardContent>
          </Card>
        </div>

        {/* COLONNE CENTRALE : GRAPHIQUES */}
        <div className="lg:col-span-9 space-y-6">
          <Tabs defaultValue="cashflow">
            <div className="flex justify-between items-center mb-4">
               <TabsList className="bg-white border border-gray-200">
                  <TabsTrigger value="cashflow" className="text-xs data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900">Flux de Trésorerie</TabsTrigger>
                  <TabsTrigger value="valuation" className="text-xs data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900">Valorisation Actif</TabsTrigger>
               </TabsList>
               <Badge variant="outline" className="bg-white text-gray-500 font-mono text-xs border-gray-300">
                  VAN ACTUALISÉE @ {inflation}%
               </Badge>
            </div>

            <TabsContent value="cashflow" className="mt-0">
               <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-6">
                     <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={financialProjection} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <defs>
                                 <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                 </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 11}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 11}} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val/1000}k`} />
                              <Tooltip content={<CustomTooltip />} />
                              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                              
                              <Area type="monotone" dataKey="optimistic" stackId="1" stroke="transparent" fill="transparent" />
                              <Area type="monotone" dataKey="pessimistic" stackId="1" stroke="#ef4444" fill="#fee2e2" strokeOpacity={0.5} strokeDasharray="4 4" name="Zone de Risque (VaR)" />
                              <Area type="monotone" dataKey="base" stroke="#2563eb" strokeWidth={3} fill="url(#colorBase)" name="Scénario Central" activeDot={{ r: 6, strokeWidth: 0 }} />
                           </AreaChart>
                        </ResponsiveContainer>
                     </div>
                  </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value="valuation" className="mt-0">
               <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-6">
                     <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={assetValuation.chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 11}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 11}} />
                              <Tooltip content={<CustomTooltip />} />
                              
                              <Area type="monotone" dataKey="cash" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} name="Cash Accumulé" />
                              <Line type="monotone" dataKey="asset" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Valeur Matériel" dot={false} />
                              <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} name="Valeur Liquidation" dot={false} />
                              
                              {assetValuation.flipMonth > 0 && (
                                 <ReferenceLine x={`M${assetValuation.flipMonth}`} stroke="#10b981" label={{ position: 'insideTop', value: 'OPTIMAL EXIT', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                              )}
                           </ComposedChart>
                        </ResponsiveContainer>
                     </div>
                  </CardContent>
               </Card>
            </TabsContent>
          </Tabs>

          {/* TABLEAU RÉCAPITULATIF */}
          <Card className="border-gray-200 shadow-sm">
             <CardHeader className="pb-0 border-b border-gray-50">
                <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2"><Calculator className="h-4 w-4" /> Tableau d'Amortissement Prévisionnel</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
                         <tr>
                            <th className="px-6 py-3">Période</th>
                            <th className="px-6 py-3 text-right">Cash Net</th>
                            <th className="px-6 py-3 text-right">Valeur Matériel</th>
                            <th className="px-6 py-3 text-right font-bold text-gray-900">Valeur Totale</th>
                            <th className="px-6 py-3 text-right">Var. (MoM)</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                         {[0, 6, 12, 16, 24].map((m, idx, arr) => {
                            const row = assetValuation.chart[m];
                            const prev = idx > 0 ? assetValuation.chart[arr[idx-1]] : null;
                            const growth = prev ? ((row.total - prev.total) / Math.abs(prev.total)) * 100 : 0;
                            
                            if (!row) return null;
                            return (
                               <tr key={m} className="hover:bg-gray-50/50">
                                  <td className="px-6 py-3 font-medium text-gray-900">Mois {m}</td>
                                  <td className="px-6 py-3 text-right font-mono text-gray-600">{formatCurrency(row.cash)}</td>
                                  <td className="px-6 py-3 text-right font-mono text-amber-600">{formatCurrency(row.asset)}</td>
                                  <td className="px-6 py-3 text-right font-mono font-bold text-blue-700 bg-blue-50/20">{formatCurrency(row.total)}</td>
                                  <td className={`px-6 py-3 text-right font-mono text-xs ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                     {m === 0 ? '-' : `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`}
                                  </td>
                               </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
             </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}