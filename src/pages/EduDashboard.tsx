import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, Trophy, Target, Zap, Clock, ChevronRight, 
  PlayCircle, BrainCircuit, Atom, LogOut, LayoutDashboard
} from 'lucide-react';
import UserMenu from '@/components/UserMenu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface StudentData {
    subject: string;
    level: number;
    xp: number;
    streak: number;
}

const EduDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
        // 1. Profil
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(prof);

        // 2. Edu Prefs
        const { data: prefs, error } = await supabase.from('edu_preferences').select('*').eq('user_id', user.id).single();
        
        if (error || !prefs) {
            // Pas onboardé ? Redirection
            navigate('/?app=edu&path=/onboarding');
        } else {
            setData(prefs);
        }
        setLoading(false);
    };
    load();
  }, [user, navigate]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#FBFBF8]">Chargement...</div>;

  const xpProgress = (data?.xp || 0) % 1000 / 10; // % vers prochain niveau

  return (
    <div className="min-h-screen bg-[#FBFBF8] font-sans selection:bg-blue-100">
      
      {/* SIDEBAR NAVIGATION (Desktop) */}
      <div className="fixed left-0 top-0 h-full w-20 bg-white border-r border-gray-100 flex-col items-center py-8 hidden md:flex z-50">
         <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold mb-8 cursor-pointer" onClick={() => navigate('/')}>S</div>
         <div className="space-y-4">
             <button className="p-3 bg-blue-50 text-blue-600 rounded-xl"><LayoutDashboard className="h-6 w-6" /></button>
             <button className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"><BookOpen className="h-6 w-6" /></button>
             <button className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"><Trophy className="h-6 w-6" /></button>
         </div>
         <div className="mt-auto">
             <UserMenu />
         </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="md:pl-20">
          
          {/* HEADER MOBILE */}
          <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-100">
              <span className="font-bold text-lg">Sivara Edu</span>
              <UserMenu />
          </div>

          <div className="max-w-6xl mx-auto p-6 lg:p-10 space-y-8">
              
              {/* WELCOME SECTION */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                      <h1 className="text-4xl font-bold text-gray-900 mb-2">Bonjour, {profile?.first_name} 👋</h1>
                      <p className="text-gray-500">Prêt à dominer la <span className="font-semibold text-blue-600">Science et Technologie</span> aujourd'hui ?</p>
                  </div>
                  <div className="flex gap-4">
                      <Card className="border-0 shadow-sm bg-white p-4 flex items-center gap-3 min-w-[140px]">
                          <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Zap className="h-5 w-5" /></div>
                          <div>
                              <div className="text-xs text-gray-400 uppercase font-bold">Série</div>
                              <div className="text-xl font-bold text-gray-900">{data?.streak || 0} Jours</div>
                          </div>
                      </Card>
                      <Card className="border-0 shadow-sm bg-white p-4 flex items-center gap-3 min-w-[140px]">
                          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Target className="h-5 w-5" /></div>
                          <div>
                              <div className="text-xs text-gray-400 uppercase font-bold">Niveau {data?.level}</div>
                              <div className="text-xl font-bold text-gray-900">{data?.xp} XP</div>
                          </div>
                      </Card>
                  </div>
              </div>

              {/* NEXT MISSION (HERO) */}
              <div className="relative overflow-hidden rounded-3xl bg-gray-900 text-white shadow-2xl p-8 md:p-12 group cursor-pointer transition-all hover:scale-[1.01]">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="space-y-4 max-w-xl">
                          <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 px-3 py-1">Recommandé par l'IA</Badge>
                          <h2 className="text-3xl font-bold leading-tight">L'Univers Matériel : Les Propriétés de la matière</h2>
                          <p className="text-gray-400 font-light text-lg">Tu as laissé ce module à 45%. Complète le quiz pour débloquer le badge "Alchimiste".</p>
                          <div className="flex items-center gap-4 pt-2">
                             <Button className="h-12 px-8 bg-white text-black hover:bg-gray-200 font-bold rounded-full">
                                 Reprendre <PlayCircle className="ml-2 h-5 w-5" />
                             </Button>
                             <span className="text-sm text-gray-500 flex items-center gap-2"><Clock className="h-4 w-4" /> ~15 min</span>
                          </div>
                      </div>
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner transform rotate-3 group-hover:rotate-6 transition-transform">
                          <Atom className="h-12 w-12 md:h-16 md:w-16 text-blue-400" />
                      </div>
                  </div>
                  {/* Progress Line */}
                  <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gray-800">
                      <div className="h-full bg-blue-500 w-[45%] shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
                  </div>
              </div>

              {/* MODULES GRID */}
              <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-gray-400" /> Programme
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[
                          { title: "L'Univers Vivant", progress: 80, color: "text-green-500", bg: "bg-green-50" },
                          { title: "La Terre et l'Espace", progress: 20, color: "text-amber-500", bg: "bg-amber-50" },
                          { title: "L'Univers Technologique", progress: 0, color: "text-gray-400", bg: "bg-gray-100" },
                          { title: "Stratégies d'exploration", progress: 0, color: "text-gray-400", bg: "bg-gray-100" },
                          { title: "Techniques instrumentales", progress: 10, color: "text-blue-500", bg: "bg-blue-50" },
                      ].map((mod, i) => (
                          <Card key={i} className="group hover:shadow-lg transition-all border-gray-100 cursor-pointer">
                              <CardContent className="p-6">
                                  <div className="flex justify-between items-start mb-4">
                                      <div className={`p-3 rounded-xl ${mod.bg} ${mod.color}`}>
                                          <BrainCircuit className="h-6 w-6" />
                                      </div>
                                      {mod.progress > 0 && <span className="font-mono text-xs font-bold text-gray-400">{mod.progress}%</span>}
                                  </div>
                                  <h4 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{mod.title}</h4>
                                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-1000 ${mod.color.replace('text', 'bg')}`} style={{ width: `${mod.progress}%` }}></div>
                                  </div>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};

export default EduDashboard;