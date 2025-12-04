import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
  OrbitControls, 
  Html, 
  Float, 
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

// --- 3D COMPONENTS ROBUSTES ---

// Utilisation de TubeGeometry (Mesh solide) au lieu de Line pour éviter les crashs de Shaders
const DataCurve = ({ data, dataKey, color, thickness = 0.05, opacity = 1 }: any) => {
  const curve = useMemo(() => {
    // Création des points
    const points = data.map((d: any, i: number) => {
      const x = (i / 24) * 20 - 10;
      const y = (d[dataKey] / 2000) * 3; 
      // Petit décalage Z pour éviter le z-fighting
      return new THREE.Vector3(x, y, 0);
    });
    
    // Création d'une courbe lisse
    return new THREE.CatmullRomCurve3(points);
  }, [data, dataKey]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 64, thickness, 8, false]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
};

const FloatingPanel = ({ position, children, rotation = [0, 0, 0] }: any) => {
  return (
    <Float speed={2} rotationIntensity={0.1} floatIntensity={0.3}>
      <group position={position} rotation={rotation}>
        <Html transform occlude distanceFactor={1.5} style={{ pointerEvents: 'none' }}>
          <div className="w-[300px] bg-white/95 border border-gray-200 p-6 rounded-3xl shadow-xl select-none text-left backdrop-blur-sm">
            {children}
          </div>
        </Html>
      </group>
    </Float>
  );
};

const BreakEvenMarker = ({ data }: { data: OracleData }) => {
  const breakEvenIndex = data.chartData.findIndex((d: any) => d.probable > 0);
  if (breakEvenIndex === -1) return null;

  const x = (breakEvenIndex / 24) * 20 - 10;
  
  return (
    <group position={[x, 0, 0]}>
      <Html position={[0, 1.5, 0]} center>
        <div className="bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-lg flex items-center gap-2 border-2 border-white">
          <Target className="w-3 h-3" />
          {data.breakEven}
        </div>
      </Html>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#10B981" />
      </mesh>
      <mesh position={[0, -2.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 5]} />
        <meshStandardMaterial color="#10B981" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

const MoneyFlowVisualizer = ({ data }: { data: OracleData }) => {
  const costHeight = Math.abs((data.details.hardwareCost / 2000) * 3);
  const depositHeight = Math.abs((data.details.deposit / 2000) * 3);

  return (
    <group position={[-10, 0, 0]}>
      {/* COUT MATERIEL */}
      <mesh position={[0, -costHeight/2, 0.5]}>
        <boxGeometry args={[0.8, costHeight, 0.8]} />
        <meshStandardMaterial color="#ef4444" transparent opacity={0.8} />
      </mesh>
      <Html position={[0, -costHeight - 0.5, 0.5]} center>
        <div className="text-red-500 font-bold text-xs text-center bg-white px-2 py-1 rounded border border-red-100 shadow-sm whitespace-nowrap">
          -{data.details.hardwareCost.toFixed(0)}$
        </div>
      </Html>

      {/* DEPOT */}
      <mesh position={[0, depositHeight/2, 0.5]}>
        <boxGeometry args={[0.8, depositHeight, 0.8]} />
        <meshStandardMaterial color="#10b981" transparent opacity={0.8} />
      </mesh>
      <Html position={[0, depositHeight + 0.5, 0.5]} center>
        <div className="text-emerald-600 font-bold text-xs text-center bg-white px-2 py-1 rounded border border-emerald-100 shadow-sm whitespace-nowrap">
          +{data.details.deposit.toFixed(0)}$
        </div>
      </Html>
    </group>
  );
};

const GridFloor = () => {
  return (
    <group position={[0, -2, 0]}>
      {/* Grille standard Three.js - très stable */}
      <gridHelper args={[30, 30, 0xe5e7eb, 0xf9fafb]} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
    </group>
  );
};

const SceneContent = ({ data }: { data: OracleData }) => {
  return (
    <group position={[0, 0, 0]}>
      {/* COURBES (Tubes) */}
      <DataCurve data={data.chartData} dataKey="optimistic" color="#22c55e" thickness={0.05} opacity={0.3} />
      <DataCurve data={data.chartData} dataKey="pessimistic" color="#ef4444" thickness={0.05} opacity={0.3} />
      <DataCurve data={data.chartData} dataKey="probable" color="#3b82f6" thickness={0.15} opacity={1} /> 

      <BreakEvenMarker data={data} />
      <MoneyFlowVisualizer data={data} />
      <GridFloor />

      {/* PANNEAUX INFO (HTML Overlays) */}
      <FloatingPanel position={[-7, 4, -2]} rotation={[0, 0.2, 0]}>
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

      <FloatingPanel position={[8, 5, -2]} rotation={[0, -0.2, 0]}>
          <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-2">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <TrendingUp size={20} />
              </div>
              <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase">Projection</h3>
                  <p className="text-[10px] text-gray-500">Mois 24</p>
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

      <FloatingPanel position={[0, -3, 3]} rotation={[-0.5, 0, 0]}>
           <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-gray-500 uppercase">Risque</span>
           </div>
           <div className="space-y-2 text-xs">
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400" style={{ width: `${100 - data.trustScore}%` }}></div>
              </div>
              <p className="text-[10px] text-gray-400 text-center">Probabilité défaut: {(100 - data.trustScore).toFixed(0)}%</p>
           </div>
      </FloatingPanel>
    </group>
  );
};

export default function Oracle3D({ data }: { data: OracleData }) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-white to-gray-50 relative rounded-3xl overflow-hidden shadow-inner border border-white/50">
      <div className="absolute top-6 left-8 z-10 pointer-events-none">
         <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Oracle 3D</h1>
         <p className="text-sm text-gray-500">Simulation Financière Temps Réel</p>
      </div>
      
      <Canvas 
        shadows={false} 
        camera={{ position: [0, 2, 18], fov: 45 }}
        dpr={[1, 2]} // Optimisation performance
        gl={{ antialias: true, alpha: true }}
      >
        {/* ECLAIRAGE STANDARD (Pas de Environment map qui peut fail) */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
        <pointLight position={[-10, 5, 0]} intensity={0.5} />
        
        <SceneContent data={data} />
        
        <OrbitControls 
            enablePan={false} 
            minPolarAngle={Math.PI / 6} 
            maxPolarAngle={Math.PI / 2.5}
            minDistance={10}
            maxDistance={30}
        />
      </Canvas>
    </div>
  );
}