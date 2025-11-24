import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import UserMenu from '@/components/UserMenu';
import { Search, Book, ArrowRight, Shield, Mail, LifeBuoy, Lock, Settings, User, Loader2, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const HelpLanding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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

  // Recherche dynamique avec debounce manuel (via onSubmit ou useEffect)
  // Ici on utilise onSubmit pour le trigger explicite, mais on peut ajouter un useEffect sur searchQuery
  const performSearch = async () => {
    if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
    }
    
    setIsSearching(true);
    try {
        // Recherche textuelle basique (Améliorable avec Full Text Search postgres)
        const { data, error } = await supabase
            .from('help_articles')
            .select('id, title, slug, content, help_categories(title)')
            .eq('is_published', true)
            .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
            .limit(10);
            
        if (error) throw error;
        setSearchResults(data || []);
    } catch (e) {
        console.error(e);
    } finally {
        setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleLogin = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) window.location.href = '/?app=account&path=/profile';
    else window.location.href = 'https://account.sivara.ca/profile';
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col">
      {/* Header Transparent */}
      <nav className="absolute top-0 w-full z-50 border-b border-white/10 bg-black/10 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = 'https://sivara.ca'}>
            <div className="h-9 w-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <span className="font-medium text-lg tracking-wide text-white drop-shadow-md">Sivara Help</span>
          </div>
          <div className="flex items-center gap-4">
            {isStaff && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-white hover:bg-white/20">
                <Lock className="w-4 h-4 mr-2" /> Admin
              </Button>
            )}
            {user ? (
              <div className="bg-white/10 rounded-full p-1 backdrop-blur-md"><UserMenu /></div>
            ) : (
              <Button 
                onClick={handleLogin}
                className="bg-white text-black hover:bg-gray-100 rounded-full px-6 font-medium shadow-lg border-0"
              >
                Connexion
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero & Search */}
      <div className="relative pt-32 pb-20 overflow-hidden bg-gray-900 min-h-[500px] flex flex-col items-center justify-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
            <img src="/help-hero.jpg" className="w-full h-full object-cover opacity-80" alt="Help Center" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 text-center max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight drop-shadow-xl">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="text-white/90 mb-10 text-xl font-light drop-shadow-md">
            Explorez nos guides ou trouvez une réponse immédiate.
          </p>
          
          <form onSubmit={handleSearchSubmit} className="relative max-w-2xl mx-auto group">
            <div className="absolute -inset-1 bg-white/30 rounded-full blur-md opacity-50 group-hover:opacity-70 transition duration-300"></div>
            <div className="relative flex items-center">
                <Search className="absolute left-5 text-gray-400 h-6 w-6" />
                <Input 
                    className="w-full h-16 pl-14 pr-4 rounded-full border-0 shadow-2xl text-lg bg-white/95 focus:bg-white transition-colors placeholder:text-gray-400" 
                    placeholder="Rechercher un article, un problème..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); if(e.target.value === '') setSearchResults([]); }}
                />
                {isSearching && <Loader2 className="absolute right-5 animate-spin text-indigo-600" />}
            </div>
          </form>
        </div>
      </div>

      {/* Results Overlay or Categories */}
      <div className="flex-1 container mx-auto px-6 py-16 -mt-10 relative z-20">
        {searchResults.length > 0 ? (
            <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-semibold mb-4 px-2">Résultats de recherche ({searchResults.length})</h2>
                {searchResults.map((result) => (
                    <Card key={result.id} className="p-6 hover:shadow-lg transition-all cursor-pointer group border-l-4 border-l-indigo-500" onClick={() => navigate(`/category/article/${result.slug}`)}>
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{result.title}</h3>
                                <p className="text-sm text-gray-500 mb-2">Dans {result.help_categories?.title}</p>
                                <p className="text-gray-600 line-clamp-2 text-sm">{result.content}</p>
                            </div>
                            <ArrowRight className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                        </div>
                    </Card>
                ))}
            </div>
        ) : searchQuery.trim() && !isSearching ? (
            <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
                <p className="text-gray-500">Aucun résultat trouvé pour "{searchQuery}".</p>
            </div>
        ) : (
            /* Categories Grid */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {categories.length > 0 ? (
                categories.map((cat) => (
                    <Card key={cat.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-lg group bg-white flex flex-col h-full" onClick={() => navigate(`/category/${cat.slug}`)}>
                        {cat.image_url ? (
                            <div className="h-40 w-full overflow-hidden relative">
                                <img src={cat.image_url} alt={cat.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                                <div className="absolute bottom-4 left-4 text-white">
                                    <div className="h-10 w-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center mb-2">
                                        <Book className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-2 bg-indigo-500 w-full"></div>
                        )}
                        
                        <div className="p-6 flex-1 flex flex-col">
                            {!cat.image_url && (
                                <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
                                    <Book className="h-6 w-6" />
                                </div>
                            )}
                            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{cat.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed flex-1">{cat.description || "Articles et tutoriels"}</p>
                            <div className="mt-6 flex items-center text-indigo-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                Explorer <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
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
        )}
      </div>

      {/* Footer Links */}
      <div className="border-t border-gray-100 py-12 bg-gray-50 mt-auto">
         <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4 group cursor-pointer">
                <div className="p-3 bg-white rounded-full shadow-sm text-green-600 group-hover:scale-110 transition-transform"><Shield className="h-6 w-6" /></div>
                <div>
                    <h4 className="font-bold text-gray-900">Confidentialité</h4>
                    <p className="text-sm text-gray-500 mt-1">Comprendre comment vos données sont chiffrées et protégées.</p>
                </div>
            </div>
            <div className="flex items-start gap-4 group cursor-pointer">
                <div className="p-3 bg-white rounded-full shadow-sm text-blue-600 group-hover:scale-110 transition-transform"><Mail className="h-6 w-6" /></div>
                <div>
                    <h4 className="font-bold text-gray-900">Support technique</h4>
                    <p className="text-sm text-gray-500 mt-1">Besoin d'aide supplémentaire ? Contactez notre équipe.</p>
                </div>
            </div>
            <div className="flex items-start gap-4 group cursor-pointer">
                <div className="p-3 bg-white rounded-full shadow-sm text-purple-600 group-hover:scale-110 transition-transform"><Settings className="h-6 w-6" /></div>
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