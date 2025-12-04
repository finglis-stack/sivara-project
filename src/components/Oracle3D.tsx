import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  Html, 
  Float, 
  Environment, 
  Line
} from '@react-three/drei';
import * as THREE from 'three';
import { BrainCircuit, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// --- TYPES ---
interface OracleData {
  chartData: any[];
  breakEven: string;
  roiTotal: number;
  profitMargin: string;
  trustScore: number;
  recommendation: string;
  actionDate: string;
  details: {
    deposit: number;
    monthly: number;
    hardwareCost: number;
  };
}

// --- 3D COMPONENTS ---

const DataCurve = ({ data, dataKey, color, thickness = 0.1, opacity = 1 }: any) => {
  const points = useMemo(() => {
    // Normalisation des données pour l'espace 3D
    // X = Mois (0 à 24) -> mappé sur -10 à 10
    // Y = Argent -> mappé sur -5 à 5
    // Z = Profondeur (pour séparer les courbes)
    return data.map((d: any, i: number) => {
      const x = (i / 24) * 20 - 10;
      const y = (d[dataKey] / 2000) * 3; // Scale factor arbitraire pour la vue
      return [x, y, 0];
    }).map((p: any) => new THREE.Vector3(...p));
  }, [data, dataKey]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={thickness}
      transparent
      opacity={opacity}
    />
  );
};

const FloatingPanel = ({ position, children, rotation = [0, 0, 0] }: any) => {
  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group position={position} rotation={rotation}>
        <Html transform occlude distanceFactor={1.5}>
          <div className="w-[300px] bg-white/90 backdrop-blur-xl border border-white/50 p-6 rounded-3xl shadow-2xl select-none text-left">
            {children}
          </div>
        </Html>
      </group>
    </Float>
  );
};

const BreakEvenMarker = ({ data }: { data: OracleData }) => {
  // Trouver la position 3D du break-even sur la courbe probable
  const breakEvenIndex = data.chartData.findIndex((d: any) => d.probable > 0);
  if (breakEvenIndex === -1) return null;

  const x = (breakEvenIndex / 24) * 20 - 10;
  const y = 0; // Y=0 est le point mort

  return (
    <group position={[x, y, 0]}>
      <Html position={[0, 1, 0]} center>
        <div className="bg-black text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-lg flex items-center gap-2">
          <Target className="w-3 h-3" />
          {data.breakEven}
        </div>
      </Html>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 10]} />
        <meshStandardMaterial color="#10B981" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

const MoneyFlowVisualizer = ({ data }: { data: OracleData }) => {
  // Visualisation du "Trou" initial (Dépôt vs Coût)
  // On place ça au début du graph (x = -10)
  
  // Bar Rouge (Coût Matériel) qui descend
  const costHeight = (data.details.hardwareCost / 2000) * 3;
  // Bar Verte (Dépôt) qui monte (un peu)
  const depositHeight = (data.details.deposit / 2000) * 3;

  return (
    <group position={[-10, 0, 0]}>
      {/* COUT MATERIEL (Barre Rouge vers le bas) */}
      <mesh position={[0, -costHeight/2, 0.5]}>
        <boxGeometry args={[0.8, costHeight, 0.8]} />
        {/* Standard material for better compatibility */}
        <meshPhysicalMaterial 
            color="#ef4444"
            transmission={0.6}
            opacity={1}
            metalness={0}
            roughness={0}
            ior={1.5}
            thickness={0.5}
        />
      </mesh>
      <Html position={[0, -costHeight - 0.5, 0.5]} center>
        <div className="text-red-500 font-bold text-xs text-center bg-white/80 px-2 py-1 rounded backdrop-blur whitespace-nowrap">
          Coût Matériel<br/>-{data.details.hardwareCost.toFixed(0)}$
        </div>
      </Html>

      {/* DEPOT (Barre Verte qui compense un peu) */}
      <mesh position={[0, depositHeight/2, 0.5]}>
        <boxGeometry args={[0.8, depositHeight, 0.8]} />
        <meshPhysicalMaterial 
            color="#10b981"
            transmission={0.6}
            opacity={1}
            metalness={0}
            roughness={0}
            ior={1.5}
            thickness={0.5}
        />
      </mesh>
      <Html position={[0, depositHeight + 0.5, 0.5]} center>
        <div className="text-green-600 font-bold text-xs text-center bg-white/80 px-2 py-1 rounded backdrop-blur whitespace-nowrap">
          Dépôt (20%)<br/>+{data.details.deposit.toFixed(0)}$
        </div>
      </Html>
    </group>
  );
};

const GridFloor = () => {
  return (
    <group position={[0, -2, 0]}>
      <gridHelper args={[30, 30, 0xdddddd, 0xf0f0f0]} position={[0, 0, 0]} />
      {/* Ligne Zéro (Axe du temps) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[30, 0.1]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>
    </group>
  );
};

const SceneContent = ({ data }: { data: OracleData }) => {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <spotLight position={[-10, 10, 10]} intensity={0.5} />
      
      <group position={[0, 0, 0]}>
        {/* COURBES */}
        <DataCurve data={data.chartData} dataKey="optimistic" color="#22c55e" thickness={3} opacity={0.3} />
        <DataCurve data={data.chartData} dataKey="pessimistic" color="#ef4444" thickness={3} opacity={0.3} />
        <DataCurve data={data.chartData} dataKey="probable" color="#3b82f6" thickness={8} opacity={1} /> {/* Main Curve */}

        <BreakEvenMarker data={data} />
        <MoneyFlowVisualizer data={data} />
        <GridFloor />

        {/* PANNEAUX D'INFORMATION FLOTTANTS DANS L'ESPACE */}
        
        {/* Panneau IA (Gauche) */}
        <FloatingPanel position={[-7, 4, -2]} rotation={[0, 0.3, 0]}>
            <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <BrainCircuit size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase">Analyse IA</h3>
                    <p className="text-[10px] text-gray-500">Confiance: {data.trustScore}/100</p>
                </div>
            </div>
            <p className="text-sm text-gray-700 font-medium leading-relaxed mb-4">
                "{data.recommendation}"
            </p>
            <div className="flex gap-2">
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100">Action: {data.actionDate}</Badge>
            </div>
        </FloatingPanel>

        {/* Panneau ROI (Droite / Fin de courbe) */}
        <FloatingPanel position={[8, 5, -2]} rotation={[0, -0.3, 0]}>
            <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-2">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                    <TrendingUp size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase">Projection Finale</h3>
                    <p className="text-[10px] text-gray-500">Mois 24 (Probable)</p>
                </div>
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-1 tracking-tighter">
                {data.roiTotal} $
            </div>
            <div className="flex justify-between items-center text-xs mt-2">
                <span className="text-gray-500">Marge Nette</span>
                <span className="font-bold text-green-600">{data.profitMargin}%</span>
            </div>
        </FloatingPanel>

        {/* Panneau Risque (Bas / Milieu) */}
        <FloatingPanel position={[2, -3, 2]} rotation={[-0.2, 0, 0]}>
             <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-bold text-gray-500 uppercase">Risque de Rupture</span>
             </div>
             <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                    <span className="text-gray-500">Scénario Catastrophe</span>
                    <span className="text-red-500 font-mono font-bold">{data.chartData[24].pessimistic} $</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400" style={{ width: `${100 - data.trustScore}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-400 text-center pt-1">Probabilité de défaut calculée sur 24 mois</p>
             </div>
        </FloatingPanel>

      </group>
    </>
  );
};

export default function Oracle3D({ data }: { data: OracleData }) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-white to-blue-50 relative rounded-3xl overflow-hidden shadow-inner border border-white/50">
      <div className="absolute top-4 left-6 z-10 pointer-events-none">
         <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Espace de Simulation 3D</h1>
         <p className="text-sm text-gray-500">Navigation libre (Orbit/Zoom)</p>
      </div>
      
      <Canvas shadows camera={{ position: [0, 5, 20], fov: 45 }}>
        {/* Removed SoftShadows to fix compatibility issues */}
        <SceneContent data={data} />
        <OrbitControls 
            enablePan={false} 
            minPolarAngle={Math.PI / 4} 
            maxPolarAngle={Math.PI / 2.2}
            minDistance={10}
            maxDistance={30}
        />
        <Environment preset="city" blur={1} />
      </Canvas>
    </div>
  );
}