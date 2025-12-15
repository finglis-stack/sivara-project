import { useState, useEffect, useRef } from 'react';
import SearchBar from '@/components/SearchBar';
import SearchResult from '@/components/SearchResult';
import CrawlManager from '@/components/CrawlManager';
import StatsDisplay from '@/components/StatsDisplay';
import UserMenu from '@/components/UserMenu';
import Footer from '@/components/Footer';
import { showError } from '@/utils/toast';
import { 
  Settings, Globe, Zap, Shield, FileText, ArrowRight, Folder,
  Briefcase, FolderOpen, BookOpen, Lightbulb, Target, TrendingUp, Users as UsersIcon,
  Calendar, CheckSquare, MessageSquare, Mail, Heart, Award, BarChart
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  type: 'file' | 'folder';
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
  Mail, Globe, Settings, Heart, Zap, Award, BarChart, Folder
};

const Index = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResultType[]>([]);
  const [docResults, setDocResults] = useState<DocResultType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [showManage, setShowManage] = useState(false);
  
  const gradientRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!gradientRef.current) return;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      gradientRef.current.style.backgroundPosition = `${x}% ${y}%`;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
      } else {
          // Si c'est un FICHIER -> On va sur le chemin /ID pour ouvrir l'éditeur
          if (isLocal) {
              window.location.href = `/${doc.id}?app=docs`;
          } else {
              window.location.href = `https://docs.sivara.ca/${doc.id}`;
          }
      }
  };

  if (showManage) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] font-sans">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div onClick={() => setShowManage(false)} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
              <span className="text-2xl font-bold text-gray-900 tracking-tight">Sivara</span>
            </div>
            <UserMenu />
          </div>
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 tracking-tight">Centre de contrôle</h1>
            <StatsDisplay />
            <CrawlManager />
          </div>
        </div>
      </div>
    );
  }

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
              }}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold text-gray-900 tracking-tight">Sivara</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setShowManage(true)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-all duration-300" title="Gérer l'indexation">
                <Settings size={20} strokeWidth={1.5} />
              </button>
              <UserMenu />
            </div>
          </div>
        </header>
      )}

      <div className={`flex-1 ${hasSearched ? "pt-24" : ""}`}>
        {!hasSearched ? (
          <div className="relative min-h-screen w-full overflow-hidden flex flex-col bg-[#FAFAFA]">
             <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[15%] left-[5%] w-32 h-32 bg-gradient-to-tr from-yellow-400/40 to-yellow-300/30 rounded-[2rem] rotate-12 animate-float-square blur-[1px]"></div>
                <div className="absolute top-[65%] right-[8%] w-48 h-48 bg-gradient-to-bl from-blue-500/20 to-blue-400/10 rounded-[3rem] -rotate-6 animate-float-square-reverse blur-sm"></div>
                <div className="absolute bottom-[10%] left-[20%] w-20 h-20 bg-yellow-400/30 rounded-2xl rotate-45 animate-float-square animation-delay-2000"></div>
                <div className="absolute top-[30%] right-[25%] w-16 h-16 bg-blue-400/20 rounded-xl rotate-[15deg] animate-float-square-reverse animation-delay-1000"></div>
             </div>
            <nav className="absolute top-0 w-full z-50 bg-[#FAFAFA]/80 backdrop-blur-sm border-b border-transparent">
              <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/sivara-logo.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
                  <span className="font-bold text-xl tracking-tight text-gray-900">Sivara</span>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setShowManage(true)} className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium hidden sm:block">Contribution</button>
                  <UserMenu />
                </div>
              </div>
            </nav>
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full max-w-5xl mx-auto mt-10">
              <div className="w-full max-w-3xl space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1]">
                  Explorez le web <br/>
                  <span 
                    ref={gradientRef} 
                    className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-600 to-yellow-200 bg-[length:200%_auto] bg-center"
                  >
                    autrement.
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-gray-500 font-light max-w-xl mx-auto leading-relaxed mb-8">Un moteur de recherche respectueux, rapide et précis. Trouvez ce qui compte vraiment, sans le bruit.</p>
                <div className="w-full transform transition-all duration-300 hover:scale-[1.01] shadow-xl rounded-full">
                  <SearchBar onSearch={handleSearch} isLoading={isSearching} />
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-4">
                  {['Technologie', 'Science', 'Design', 'Actualités'].map((tag) => (
                    <button key={tag} onClick={() => handleSearch(tag)} className="px-4 py-1.5 rounded-full bg-white hover:bg-gray-100 border border-gray-100 text-gray-600 text-sm transition-all shadow-sm">{tag}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative z-10 w-full py-6 bg-white/50 backdrop-blur-sm">
              <div className="container mx-auto px-6 flex justify-center gap-8 text-xs text-gray-400 font-medium uppercase tracking-widest">
                <span className="flex items-center gap-2 hover:text-gray-600 transition-colors"><Shield className="w-3 h-3" /> Privé</span>
                <span className="flex items-center gap-2 hover:text-gray-600 transition-colors"><Zap className="w-3 h-3" /> Rapide</span>
                <span className="flex items-center gap-2 hover:text-gray-600 transition-colors"><Globe className="w-3 h-3" /> Universel</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 pb-12">
            <div className="max-w-4xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <SearchBar onSearch={handleSearch} isLoading={isSearching} />
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