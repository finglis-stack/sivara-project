import { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Target, AlertTriangle, 
  DollarSign, Activity, BrainCircuit, ShieldCheck, 
  CreditCard, Calendar, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

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
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600 capitalize">{entry.name}:</span>
            <span className={`font-bold ${entry.value < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {formatCurrency(entry.value)}
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

  // Calculs dérivés pour l'affichage
  const breakEvenIndex = data.chartData.findIndex(d => d.probable >= 0);
  const totalExposure = data.details.hardwareCost - data.details.deposit;
  const monthlyProfit = data.details.monthly; // Simplifié (brut)
  
  const riskLevel = data.trustScore >= 80 ? 'Faible' : data.trustScore >= 50 ? 'Moyen' : 'Critique';
  const riskColor = data.trustScore >= 80 ? 'bg-emerald-500' : data.trustScore >= 50 ? 'bg-amber-500' : 'bg-red-500';

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MAIN CHART */}
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
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6B7280', fontSize: 12}} 
                    tickMargin={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6B7280', fontSize: 12}} 
                    tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}$`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
                  {breakEvenIndex > -1 && (
                     <ReferenceLine x={`M${breakEvenIndex}`} stroke="#10B981" strokeDasharray="3 3" label={{ position: 'top', value: 'Point Mort', fill: '#10B981', fontSize: 12 }} />
                  )}
                  
                  <Area 
                    type="monotone" 
                    dataKey="optimistic" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    fill="none" 
                    name="Optimiste"
                    activeDot={{ r: 6 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="probable" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fill="url(#colorProbable)" 
                    name="Probable"
                    activeDot={{ r: 8 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pessimistic" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="none" 
                    name="Pessimiste"
                  />
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
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Coût Matériel (Achat)</span>
                            <span className="font-mono text-red-600 font-medium">-{formatCurrency(data.details.hardwareCost)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Dépôt Client (20%)</span>
                            <span className="font-mono text-green-600 font-medium">+{formatCurrency(data.details.deposit)}</span>
                        </div>
                        <div className="h-px bg-gray-100 w-full my-2"></div>
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-900">Exposition Initiale</span>
                            <span className="font-mono font-bold text-gray-900">-{formatCurrency(totalExposure)}</span>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-bold text-blue-700">REVENU MENSUEL</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-2xl font-bold text-gray-900">{formatCurrency(monthlyProfit)}</span>
                            <span className="text-xs text-gray-500 mb-1">/ mois</span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full w-[85%]"></div> {/* Marge fictive */}
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                            <span>Frais Stripe & Ops estimés à 3.5%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* RISK ANALYSIS */}
            <Card className="border-gray-200 shadow-sm bg-white">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-bold uppercase text-gray-500 tracking-wider">Analyse de Risque</CardTitle>
                        <Badge variant="outline" className={`${riskColor} bg-opacity-10 text-opacity-100 border-0`}>{riskLevel}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Probabilité de défaut</span>
                            <span className="font-bold text-gray-900">{(100 - data.trustScore).toFixed(1)}%</span>
                        </div>
                        <Progress 
                            value={100 - data.trustScore} 
                            className={`h-2 bg-gray-100 ${data.trustScore < 50 ? '[&>*]:bg-red-500' : '[&>*]:bg-amber-500'}`} 
                        />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex items-start gap-3">
                            <BrainCircuit className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-1">Recommendation IA</h4>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {data.recommendation}
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-white border border-gray-200 text-xs font-mono">
                                        ACTION: {data.actionDate.toUpperCase()}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
      </div>

      {/* DETAILED SCENARIO TABLE */}
      <Card className="mt-6 border-gray-200 shadow-sm">
        <CardHeader>
            <CardTitle className="text-lg font-semibold">Comparaison des Scénarios (Flux Net)</CardTitle>
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