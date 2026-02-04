import { useState, useEffect } from 'react';
import SearchBar from '@/components/SearchBar';
import SearchResult from '@/components/SearchResult';
import CrawlManager from '@/components/CrawlManager';
import StatsDisplay from '@/components/StatsDisplay';
import SearchManagement from '@/components/SearchManagement';
import AdminLayout from '@/components/AdminLayout';
import UserMenu from '@/components/UserMenu';
import Footer from '@/components/Footer';
import CategoryImageButton from '@/components/CategoryImageButton';
import { showError } from '@/utils/toast';
import { 
  Settings, Globe, Zap, Shield, FileText, ArrowRight, Folder,
  Briefcase, FolderOpen, BookOpen, Lightbulb, Target, TrendingUp, Users as UsersIcon,
  Calendar, CheckSquare, MessageSquare, Mail, Heart, Award, BarChart, Activity,
  Presentation
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResultType {
  id: string;
  url: string;
  title: string;
  description: string;
  content: string;
  domain: string;
  crawled_at: string;
  rank: number;
}

interface DocResultType {
  id: string;
  title: string;
  snippet: string;
  type: 'file' | 'folder' | 'point';
  updated_at: string;
  icon?: string;
  color?: string;
  cover_url?: string;
}

interface GroupedResult {
  mainResult: SearchResultType;
  relatedResults: SearchResultType[];
  isMainDomain: boolean;
}

// Mapping des icônes disponibles (doit correspondre à Docs.tsx)
const ICON_MAP: any = {
  FileText, Briefcase, FolderOpen, BookOpen, Lightbulb, Target,
  TrendingUp, UsersIcon, Calendar, CheckSquare, MessageSquare, 
  Mail, Globe, Settings, Heart, Zap, Award, BarChart, Folder,
  Presentation
};

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResultType[]>([]);
  const [docResults, setDocResults] = useState<DocResultType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [showManage, setShowManage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [adminPage, setAdminPage] = useState('dashboard');
  
  // Vérifier si l'utilisateur est staff
  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('is_staff').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.is_staff) setIsStaff(true);
        });
    } else {
      setIsStaff(false);
    }
  }, [user]);

  const groupResultsByDomain = (results: SearchResultType[]): GroupedResult[] => {
    if (results.length === 0) return [];
    const grouped: { [key: string]: SearchResultType[] } = {};
    const mainDomain = results[0]?.domain;
    results.forEach(result => {
      const baseDomain = extractBaseDomain(result.domain);
      if (!grouped[baseDomain]) grouped[baseDomain] = [];
      grouped[baseDomain].push(result);
    });
    const groupedResults: GroupedResult[] = [];
    Object.entries(grouped).forEach(([domain, domainResults]) => {
      const [mainResult, ...relatedResults] = domainResults;
      groupedResults.push({ mainResult, relatedResults, isMainDomain: extractBaseDomain(mainDomain) === domain });
    });
    return groupedResults.sort((a, b) => {
      if (a.isMainDomain && !b.isMainDomain) return -1;
      if (!a.isMainDomain && b.isMainDomain) return 1;
      return b.mainResult.rank - a.mainResult.rank;
    });
  };

  const extractBaseDomain = (domain: string): string => {
    const parts = domain.split('.');
    if (parts.length > 2) return parts.slice(-2).join('.');
    return domain;
  };

  const handleSearch = async (query: string) => {
    try {
      setIsSearching(true);
      setHasSearched(true);
      setSearchQuery(query);
      setDocResults([]);

      console.log('Searching for:', query);

      const webSearchPromise = fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({ query, page: 1, limit: 50 }),
      });

      const { data: { session } } = await supabase.auth.getSession();
      
      let docSearchPromise = Promise.resolve(null);
      
      if (session?.access_token) {
          // Check Profile Preference first
          const { data: profile } = await supabase
            .from('profiles')
            .select('search_documents_enabled')
            .eq('id', session.user.id)
            .single();

          if (profile?.search_documents_enabled !== false) {
              docSearchPromise = fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/search-docs', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ query }),
              })
              .then(res => {
                  if (!res.ok) throw new Error("Doc search failed");
                  return res.json();
              })
              .catch(err => {
                  console.warn("Erreur recherche docs:", err);
                  return null;
              });
          }
      }

      const [webResponse, docData] = await Promise.all([webSearchPromise, docSearchPromise]);
      const webData = await webResponse.json();
      
      if (!webResponse.ok) {
        showError(webData.details || 'Erreur lors de la recherche web');
        setResults([]);
        setTotalResults(0);
      } else {
        setResults(webData.results || []);
        setTotalResults(webData.total || 0);
      }

      if (docData && docData.results && docData.results.length > 0) {
          // Soft limit of 5 (Frontend enforcement)
          setDocResults(docData.results.slice(0, 5));
      }

    } catch (error) {
      console.error('Search error:', error);
      showError('Erreur de connexion');
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  };

  const groupedResults = groupResultsByDomain(results);

  const openDoc = (doc: DocResultType) => {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      // LOGIQUE DE REDIRECTION INTELLIGENTE
      if (doc.type === 'folder') {
          // Si c'est un DOSSIER -> On va sur l'index de Docs avec le paramètre ?folder=
          // Cela permet à Docs.tsx d'ouvrir le dossier au lieu d'essayer d'éditer le fichier
          if (isLocal) {
              window.location.href = `/?app=docs&folder=${doc.id}`;
          } else {
              window.location.href = `https://docs.sivara.ca/?folder=${doc.id}`;
          }
      } else if (doc.type === 'point') {
          if (isLocal) {
              window.location.href = `/point/${doc.id}?app=docs`;
          } else {
              window.location.href = `https://docs.sivara.ca/point/${doc.id}`;
          }
      } else {
          // Si c'est un FICHIER -> On va sur le chemin /ID pour ouvrir l'éditeur
          if (isLocal) {
              window.location.href = `/${doc.id}?app=docs`;
          } else {
              window.location.href = `https://docs.sivara.ca/${doc.id}`;
          }
      }
  };

  // Rendu du contenu du centre de contrôle
  const renderAdminContent = () => {
    switch (adminPage) {
      case 'dashboard':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tableau de bord</h1>
            <StatsDisplay />
            <CrawlManager />
          </div>
        );
      case 'search':
        return <SearchManagement />;
      case 'crawl':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Crawling</h1>
            <CrawlManager />
          </div>
        );
      case 'monitor':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Monitoring</h1>
            </div>
            <Card className="p-8 text-center">
              <p className="text-gray-500">Le monitoring est disponible via la page dédiée.</p>
              <button 
                onClick={() => navigate('/monitor')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ouvrir le Monitoring
              </button>
            </Card>
          </div>
        );
      case 'stats':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Statistiques</h1>
            <StatsDisplay />
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Paramètres</h1>
            <Card>
              <CardHeader>
                <CardTitle>Paramètres du système</CardTitle>
                <CardDescription>Configurez les paramètres globaux du système</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">Les paramètres seront bientôt disponibles.</p>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  if (showManage) {
    return (
      <AdminLayout currentPage={adminPage} onPageChange={setAdminPage}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div 
              onClick={() => setShowManage(false)} 
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
              <span className="text-2xl font-bold text-gray-900 tracking-tight">Sivara</span>
            </div>
            <UserMenu />
          </div>
          {renderAdminContent()}
        </div>
      </AdminLayout>
    );
  }

  const quickCategories = [
    {
      label: 'Technologie',
      imageSrc: '/landing-tags/valencia-2154438_1280.jpg',
      query: 'Technologie',
    },
    {
      label: 'Science',
      imageSrc: '/landing-tags/landscape-10071292_1280.jpg',
      query: 'Science',
    },
    {
      label: 'Design',
      imageSrc: '/landing-tags/tulip-3502171_1920.jpg',
      query: 'Design',
    },
    {
      label: 'Actualité',
      imageSrc: '/landing-tags/ganges-10021683_1280.jpg',
      query: 'Actualité',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-yellow-400 selection:text-black flex flex-col">
      {hasSearched && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div 
              onClick={() => {
                setHasSearched(false);
                setResults([]);
                setTotalResults(0);
                setDocResults([]);
                setSearchQuery('');
              }}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold text-gray-900 tracking-tight">Sivara</span>
            </div>
            <div className="flex items-center gap-4">
              {isStaff && (
                <button onClick={() => setShowManage(true)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-all duration-300" title="Gérer l'indexation">
                  <Settings size={20} strokeWidth={1.5} />
                </button>
              )}
              <UserMenu />
            </div>
          </div>
        </header>
      )}

      <div className={`flex-1 ${hasSearched ? "pt-24" : ""}`}>
        {!hasSearched ? (
          <div className="relative min-h-screen w-full overflow-hidden flex flex-col bg-black">
            {/* VIDEO BACKGROUND */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-0">
                {/* Cover technique for 16:9 video */}
                <iframe
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-[177.78vh] h-[56.25vw]"
                  src="https://www.youtube-nocookie.com/embed/wQ7grPng_EI?autoplay=1&mute=1&controls=0&rel=0&loop=1&playlist=wQ7grPng_EI&modestbranding=1&playsinline=1&iv_load_policy=3&disablekb=1"
                  title="Sivara background"
                  frameBorder="0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              {/* Overlay for readability */}
              <div className="absolute inset-0 bg-black/55" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/70" />
            </div>

            <nav className="absolute top-0 w-full z-50 bg-transparent">
              <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/sivara-logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
                  <span className="font-bold text-xl tracking-tight text-white">Sivara</span>
                </div>
                <div className="flex items-center gap-4">
                  {isStaff && (
                    <button onClick={() => setShowManage(true)} className="text-white/80 hover:text-white transition-colors text-sm font-medium hidden sm:block">Contribution</button>
                  )}
                  <UserMenu />
                </div>
              </div>
            </nav>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full max-w-5xl mx-auto mt-10">
              <div className="w-full max-w-3xl space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1] drop-shadow-[0_8px_30px_rgba(0,0,0,0.65)]">
                  Recherchez le{' '}
                  <span className="relative inline-block">
                    web
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 rotate-[-7deg] px-3 py-1 rounded-full bg-white/15 border border-white/25 text-white/90 text-[11px] sm:text-xs backdrop-blur-sm shadow-lg max-w-[85vw] whitespace-normal">
                      Conceptualisé par Félix I. et Léa C., École secondaire Marie-Anne
                    </span>
                  </span>
                  .
                  <br />
                  Sans surveillance.
                  <span className="text-white/70 font-medium text-xl md:text-2xl">{' '}(promis)</span>
                </h1>
                <p className="text-base md:text-xl text-white/80 font-light max-w-xl mx-auto leading-relaxed">
                  Sivara vous aide à trouver l'information rapidement, dans une expérience claire et immersive.
                </p>

                <div className="w-full transform transition-all duration-300 hover:scale-[1.01] shadow-2xl rounded-full">
                  <SearchBar onSearch={handleSearch} isLoading={isSearching} value={searchQuery} onChange={setSearchQuery} />
                </div>

                <div className="flex flex-wrap justify-center gap-3 pt-4">
                  {quickCategories.map((c) => (
                    <CategoryImageButton
                      key={c.label}
                      label={c.label}
                      imageSrc={c.imageSrc}
                      onClick={() => handleSearch(c.query)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="relative z-10 w-full py-6 bg-black/30 backdrop-blur-sm border-t border-white/10">
              <div className="container mx-auto px-6 flex justify-center gap-8 text-xs text-white/70 font-medium uppercase tracking-widest">
                <span className="flex items-center gap-2 hover:text-white transition-colors"><Shield className="w-3 h-3" /> Privé</span>
                <span className="flex items-center gap-2 hover:text-white transition-colors"><Zap className="w-3 h-3" /> Rapide</span>
                <span className="flex items-center gap-2 hover:text-white transition-colors"><Globe className="w-3 h-3" /> Universel</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 pb-12">
            <div className="max-w-4xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <SearchBar onSearch={handleSearch} isLoading={isSearching} value={searchQuery} onChange={setSearchQuery} />
            </div>

            <div className="max-w-5xl mx-auto">
              
              {/* --- SECTION DOCUMENTS (Affichée UNIQUEMENT si résultats) --- */}
              {docResults.length > 0 && (
                  <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex items-center justify-between mb-4 px-2">
                          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                              <FileText className="h-4 w-4" /> Vos Documents
                          </h2>
                      </div>
                      
                      <div className="grid gap-3">
                          {docResults.map((doc) => {
                              // Résolution dynamique de l'icône
                              const IconComponent = ICON_MAP[doc.icon || ''] || (doc.type === 'folder' ? Folder : FileText);
                              
                              if (doc.type === 'folder') {
                                return (
                                  <Card 
                                      key={doc.id} 
                                      className="group hover:scale-[1.01] transition-all cursor-pointer shadow-lg hover:shadow-xl relative overflow-hidden border-0"
                                      onClick={() => openDoc(doc)}
                                  >
                                      {/* BACKGROUND IMAGE & OVERLAY */}
                                      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" 
                                           style={{ backgroundImage: `url(${doc.cover_url || '/default-cover.jpg'})` }}>
                                      </div>
                                      <div className="absolute inset-0 bg-black/70 group-hover:bg-black/60 transition-colors"></div>
                                      
                                      <div className="p-5 flex items-center justify-between relative z-10">
                                          <div className="flex items-center gap-4">
                                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20">
                                                  <Folder className="h-5 w-5 text-white" />
                                              </div>
                                              <div>
                                                  <h3 className="font-thin text-lg text-white group-hover:underline decoration-white/50 underline-offset-4 transition-all">{doc.title}</h3>
                                                  <p className="text-xs text-white/60 mt-0.5 font-light">Dossier sécurisé</p>
                                              </div>
                                          </div>
                                          <ArrowRight className="h-4 w-4 text-white/50 group-hover:text-white transform group-hover:translate-x-1 transition-all" />
                                      </div>
                                  </Card>
                                );
                              } else {
                                return (
                                  <Card 
                                      key={doc.id} 
                                      className="group hover:border-blue-400 transition-all cursor-pointer border-l-4 shadow-sm hover:shadow-md"
                                      style={{ borderLeftColor: doc.color || '#3B82F6' }}
                                      onClick={() => openDoc(doc)}
                                  >
                                      <div className="p-4 flex items-center justify-between">
                                          <div className="flex items-center gap-4">
                                              <div 
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm"
                                                style={{ backgroundColor: doc.color || '#3B82F6' }}
                                              >
                                                  <IconComponent className="h-5 w-5" />
                                              </div>
                                              <div className="overflow-hidden">
                                                  <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{doc.title}</h3>
                                                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{doc.snippet}</p>
                                              </div>
                                          </div>
                                          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-600 transform group-hover:translate-x-1 transition-all shrink-0" />
                                      </div>
                                  </Card>
                                );
                              }
                          })}
                      </div>
                  </div>
              )}

              {isSearching ? (
                <div className="text-center py-20 animate-in fade-in duration-500">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
                  <p className="mt-6 text-lg text-gray-500 font-light">Exploration en cours...</p>
                </div>
              ) : groupedResults.length > 0 ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <p className="text-sm text-gray-400 mb-6 px-2 font-medium tracking-wide uppercase">
                    {totalResults} résultat{totalResults > 1 ? 's' : ''} trouvé{totalResults > 1 ? 's' : ''}
                  </p>
                  <div className="space-y-6">
                    {groupedResults.map((group, index) => (
                      <div 
                        key={group.mainResult.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <SearchResult
                          url={group.mainResult.url}
                          title={group.mainResult.title}
                          description={group.mainResult.description}
                          content={group.mainResult.content}
                          domain={group.mainResult.domain}
                          crawledAt={group.mainResult.crawled_at}
                          isMainDomain={group.isMainDomain}
                          relatedResults={group.relatedResults}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 animate-in fade-in duration-500">
                  <div className="h-24 w-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Globe className="h-10 w-10 text-gray-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Aucun résultat web</h3>
                  <p className="text-gray-500 max-w-md mx-auto">Nous n'avons rien trouvé sur le web public. Essayez d'autres mots-clés.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* FOOTER GLOBAL */}
      <Footer />
    </div>
  );
};

export default Index;