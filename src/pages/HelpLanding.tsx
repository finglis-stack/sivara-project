import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import UserMenu from '@/components/UserMenu';
import { Search, Book, ArrowRight, Shield, Mail, LifeBuoy, Lock, Settings, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const HelpLanding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('help_categories')
        .select('*')
        .order('order', { ascending: true });
      setCategories(data || []);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_staff')
          .eq('id', user.id)
          .single();
        if (profile?.is_staff) setIsStaff(true);
      }
    };
    fetchData();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if(searchQuery.trim()) {
        console.log("Recherche:", searchQuery);
    }
  };

  const handleLogin = () => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    
    // Redirection spécifique demandée vers /profile
    if (isLocal) {
      window.location.href = '/?app=account&path=/profile';
    } else {
      window.location.href = 'https://account.sivara.ca/profile';
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Header */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = 'https://sivara.ca'}>
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">H</div>
            <span className="font-medium text-lg tracking-tight">Sivara Help</span>
          </div>
          <div className="flex items-center gap-4">
            {isStaff && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="text-indigo-600 border-indigo-200 bg-indigo-50">
                <Lock className="w-3 h-3 mr-2" /> Admin Panel
              </Button>
            )}
            {user ? (
              <UserMenu />
            ) : (
              <Button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 transition-all duration-300 text-white shadow-md shadow-indigo-200"
              >
                <User size={18} />
                <span className="text-sm font-medium">Connexion</span>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gray-50 py-20 border-b border-gray-100">
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <h1 className="text-4xl font-bold text-gray-900 mb-6 tracking-tight">Comment pouvons-nous vous aider ?</h1>
          <p className="text-gray-500 mb-8 text-lg font-light">Trouvez des réponses instantanées ou contactez notre équipe.</p>
          
          <form onSubmit={handleSearch} className="relative max-w-xl mx-auto group">
            <div className="absolute -inset-1 bg-indigo-100 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input 
                    className="w-full h-14 pl-12 pr-4 rounded-full border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500/20 text-lg bg-white" 
                    placeholder="Rechercher un article, un tutoriel..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </form>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="container mx-auto px-6 py-16">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-8">Explorer par sujets</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.length > 0 ? (
             categories.map((cat) => (
                <Card key={cat.id} className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer border-gray-100 group bg-white" onClick={() => navigate(`/category/${cat.slug}`)}>
                    <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600 group-hover:scale-110 transition-transform">
                        <Book className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{cat.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{cat.description || "Articles et tutoriels"}</p>
                    <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Explorer <ArrowRight className="ml-2 h-4 w-4" />
                    </div>
                </Card>
             ))
          ) : (
             <div className="col-span-3 text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <LifeBuoy className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Aucune catégorie disponible pour le moment.</p>
             </div>
          )}
        </div>
      </div>

      {/* Common Links / Footer */}
      <div className="border-t border-gray-100 py-16 bg-gray-50">
         <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-full shadow-sm text-green-600"><Shield className="h-6 w-6" /></div>
                <div>
                    <h4 className="font-bold text-gray-900">Confidentialité</h4>
                    <p className="text-sm text-gray-500 mt-1">Comprendre comment vos données sont chiffrées et protégées.</p>
                </div>
            </div>
            <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-full shadow-sm text-blue-600"><Mail className="h-6 w-6" /></div>
                <div>
                    <h4 className="font-bold text-gray-900">Support technique</h4>
                    <p className="text-sm text-gray-500 mt-1">Besoin d'aide supplémentaire ? Contactez notre équipe.</p>
                </div>
            </div>
            <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-full shadow-sm text-purple-600"><Settings className="h-6 w-6" /></div>
                <div>
                    <h4 className="font-bold text-gray-900">État du système</h4>
                    <p className="text-sm text-gray-500 mt-1">Tous les systèmes sont opérationnels.</p>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default HelpLanding;