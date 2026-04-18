import { useState, useEffect, useRef } from 'react';
import SearchBar from '@/components/SearchBar';
import SearchResult from '@/components/SearchResult';
import CrawlManager from '@/components/CrawlManager';
import StatsDisplay from '@/components/StatsDisplay';
import SearchManagement from '@/components/SearchManagement';
import EntitiesManager, { SearchEntity } from '@/components/admin/EntitiesManager';
import AdminLayout from '@/components/AdminLayout';
import KnowledgePanel from '@/components/KnowledgePanel';
import UserMenu from '@/components/UserMenu';
import Footer from '@/components/Footer';
import CategoryImageButton from '@/components/CategoryImageButton';
import LanguageSelector from '@/components/LanguageSelector';
import { showError } from '@/utils/toast';
import {
  Settings, Globe, FileText, ArrowRight, Folder,
  Briefcase, FolderOpen, BookOpen, Lightbulb, Target, TrendingUp, Users as UsersIcon,
  Calendar, CheckSquare, MessageSquare, Mail, Heart, Award, BarChart, Activity,
  Presentation, Shield, Lock, Search
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

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
  Mail, Globe, Settings, Heart, Award, BarChart, Folder,
  Presentation
};

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResultType[]>([]);
  const [docResults, setDocResults] = useState<DocResultType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [activeEntity, setActiveEntity] = useState<SearchEntity | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [adminPage, setAdminPage] = useState('dashboard');
  const hasInitialSearchRun = useRef(false);
  
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

  // Lire le paramètre ?q= de l'URL au chargement et lancer la recherche
  useEffect(() => {
    if (hasInitialSearchRun.current) return;
    const queryFromUrl = searchParams.get('q');
    if (queryFromUrl && queryFromUrl.trim()) {
      hasInitialSearchRun.current = true;
      setSearchQuery(queryFromUrl);
      handleSearch(queryFromUrl);
    }
  }, [searchParams]);

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

      setSearchParams({ q: query }, { replace: true });
      setDocResults([]);
      setActiveEntity(null);

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

      // Recherche d'Entité Frontend Fast
      const lowerQuery = query.toLowerCase().trim();
      const entitySearchPromise = supabase
        .from('search_entities')
        .select('*')
        .or(`name.ilike.%${query}%`) // Initial fast check
        .order('priority', { ascending: false })
        .limit(10)
        .then(({ data }) => {
            if (!data) return null;
            // Precise local keyword check
            const exactMatch = data.find(e => e.name.toLowerCase() === lowerQuery || e.keywords.some((k: string) => k.toLowerCase() === lowerQuery));
            return exactMatch || data[0] || null;
        })
        .catch(() => null);

      const [webResponse, docData, entityData] = await Promise.all([
          webSearchPromise, 
          docSearchPromise, 
          entitySearchPromise
      ]);
      const webData = await webResponse.json();
      
      if (entityData) {
          setActiveEntity(entityData as SearchEntity);
      }
      
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
      case 'entities':
        return <EntitiesManager />;
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
      label: t('index.tech'),
      imageSrc: '/landing-tags/valencia-2154438_1280.jpg',
      query: 'Technologie',
    },
    {
      label: t('index.science'),
      imageSrc: '/landing-tags/landscape-10071292_1280.jpg',
      query: 'Science',
    },
    {
      label: t('index.design'),
      imageSrc: '/landing-tags/tulip-3502171_1920.jpg',
      query: 'Design',
    },
    {
      label: t('index.news'),
      imageSrc: '/landing-tags/ganges-10021683_1280.jpg',
      query: 'Actualité',
    },
  ];

  return (
    <div className="bg-[#FAF9F4] text-[#111111] min-h-screen flex flex-col antialiased relative font-sans selection:bg-[#00236F] selection:text-white">
      <style>{`
        .grid-bg-pattern {
            background-image: 
                linear-gradient(to right, rgba(197, 197, 211, 0.4) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(197, 197, 211, 0.4) 1px, transparent 1px);
            background-size: 40px 40px;
        }
      `}</style>
      <div className="fixed inset-0 grid-bg-pattern opacity-50 z-0 pointer-events-none"></div>

      {hasSearched && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#FAF9F4]/90 backdrop-blur-xl border-b border-[#c5c5d3]/30">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div 
                  onClick={() => {
                    setHasSearched(false);
                    setResults([]);
                    setTotalResults(0);
                    setDocResults([]);
                    setSearchQuery('');
                    setSearchParams({}, { replace: true });
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
                  <span className="text-xl font-bold text-gray-900 tracking-tight">Sivara</span>
                </div>
                <button 
                  onClick={() => navigate('/about')} 
                  className="text-sm font-medium text-[#5a5b67] hover:text-[#00236F] transition-colors hidden sm:block translate-y-[2px]"
                >
                  {t('about.navLink')}
                </button>
                <button 
                  onClick={() => {
                      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                      window.location.href = isLocal ? '/pricing' : 'https://account.sivara.ca/pricing';
                  }} 
                  className="text-sm font-medium text-[#5a5b67] hover:text-[#00236F] transition-colors hidden sm:block translate-y-[2px]"
                >
                  {t('pricing.navLink')}
                </button>
              </div>
            <div className="flex items-center gap-4">
              <LanguageSelector />
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
          <div className="w-full flex-1 flex flex-col relative z-10">
            {/* TopNavBar */}
            <nav className="sticky top-0 z-50 bg-[#FAF9F4]/80 backdrop-blur-xl w-full border-b border-[#c5c5d3]/30">
              <div className="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
                {/* Brand & About Link */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 cursor-pointer transition-all active:scale-95">
                    <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
                    <span className="text-xl font-bold tracking-tighter text-[#111111]">Sivara</span>
                  </div>
                  <button 
                    onClick={() => navigate('/about')} 
                    className="text-sm font-medium text-[#5a5b67] hover:text-[#00236F] transition-colors hidden sm:block translate-y-[2px]"
                  >
                    {t('about.navLink')}
                  </button>
                  <button 
                    onClick={() => {
                        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                        window.location.href = isLocal ? '/pricing' : 'https://account.sivara.ca/pricing';
                    }} 
                    className="text-sm font-medium text-[#5a5b67] hover:text-[#00236F] transition-colors hidden sm:block translate-y-[2px]"
                  >
                    {t('pricing.navLink')}
                  </button>
                </div>

                {/* Trailing Actions */}
                <div className="flex items-center gap-4 lg:gap-6">
                  <LanguageSelector />
                  {isStaff && (
                    <button onClick={() => setShowManage(true)} className="text-sm font-medium text-[#5a5b67] hover:text-[#00236F] transition-colors hidden sm:block">{t('index.contribution')}</button>
                  )}
                  <UserMenu />
                </div>
              </div>
            </nav>

            {/* Main Content Canvas */}
            <main className="flex-1 w-full max-w-screen-2xl mx-auto px-6 md:px-12 py-12 flex flex-col gap-12 relative z-10">
              
              {/* Hero Search Area */}
              <section className="flex flex-col items-center justify-center py-16 gap-8 bg-transparent rounded-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="relative z-10 flex flex-col items-center w-full max-w-3xl text-center gap-6 px-4">
                  
                  <div>
                    <h1 className="text-5xl md:text-6xl font-light tracking-[-0.02em] text-[#111111] leading-tight flex flex-col gap-2">
                        <span>{t('index.heroLine1')}</span>
                        <span className="text-[#00236F]">{t('index.heroLine2')}</span>
                    </h1>
                    <p className="text-[13px] font-light text-[#5a5b67] mt-4 italic">
                        {t('index.designedBy')}
                    </p>
                  </div>
                  
                  <p className="text-lg md:text-xl font-light text-[#2c2d38] max-w-2xl">
                    {t('index.heroSubTitle')}
                  </p>
                  
                  <form onSubmit={(e) => { e.preventDefault(); if(searchQuery.trim()) handleSearch(searchQuery.trim()); }} className="w-full mt-4 relative">
                    <div className="relative flex items-center w-full bg-white rounded-none border border-[#c5c5d3]/30 focus-within:border-[#00236F] focus-within:ring-1 focus-within:ring-[#00236F] transition-colors shadow-sm overflow-hidden">
                      <Search className="ml-5 text-[#00236F] h-5 w-5" />
                      <input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Rechercher sur Sivara..." 
                        className="w-full bg-transparent border-none focus:ring-0 text-[#111111] text-lg py-4 pl-4 pr-32 font-medium placeholder:text-[#5a5b67] outline-none rounded-none" 
                        placeholder={t('index.searchPlaceholder')}
                        type="text"
                      />
                      <button type="submit" disabled={isSearching} className="absolute right-2 top-2 bottom-2 bg-[#00236F] hover:bg-[#1e3a8a] text-white px-6 rounded-none font-bold transition-colors text-sm uppercase tracking-wider flex items-center gap-2 shadow-sm">
                        {isSearching ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : null}
                        {t('index.searchButton')}
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              {/* Dashboard Bento Grid */}
              <section className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full animate-in fade-in slide-in-from-bottom-12 duration-1000" style={{ animationDelay: '200ms' }}>
                {/* Quick Categories List (Span 12) */}
                <div className="md:col-span-12 bg-[#f5f4ef] rounded-xl p-8 outline outline-1 outline-[#c5c5d3]/30 shadow-sm border border-[#c5c5d3]/15 flex flex-col gap-6">
                  <div className="flex items-end justify-between border-b border-[#c5c5d3]/30 pb-4">
                    <div>
                      <h2 className="text-2xl font-medium tracking-tight text-[#111111]">{t('index.categoriesTitle')}</h2>
                      <p className="text-base font-medium text-[#2c2d38] mt-1">{t('index.categoriesSubTitle')}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-4">
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

                {/* Visual Block (Span 12) */}
                <div className="md:col-span-12 bg-white rounded-xl p-8 flex flex-col gap-6 relative overflow-hidden outline outline-1 outline-[#c5c5d3]/30 shadow-sm border border-[#c5c5d3]/15">
                  <div className="flex justify-between items-start z-10">
                    <div>
                      <h2 className="text-2xl font-medium tracking-tight text-[#111111]">{t('index.accessibleTitle')}</h2>
                      <p className="text-base font-medium text-[#2c2d38] mt-1">{t('index.accessibleSubTitle')}</p>
                    </div>
                    <div className="p-2 bg-[#00236F]/5 rounded text-[#00236F]">
                      <Globe className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="relative w-full h-80 bg-[#efeee9] rounded overflow-hidden mt-2 z-10 border border-[#c5c5d3]/20">
                    <img 
                      alt="Famille utilisant une tablette" 
                      className="w-full h-full object-cover opacity-90" 
                      src="/help-hero.jpg"
                    />
                    <div className="absolute bottom-4 left-4 bg-[#faf9f4]/90 backdrop-blur-md px-3 py-2 rounded border border-[#c5c5d3]/30 flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#2c2d38]">{t('index.indexedContent')}</span>
                      <span className="text-xl font-medium text-[#00236F] flex items-center gap-2">
                        <Activity className="h-4 w-4" /> {t('index.realTime')}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </main>
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
                              <FileText className="h-4 w-4" /> {t('index.yourDocs')}
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
                                      className="group hover:scale-[1.01] transition-all cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden border-0 rounded-none bg-white/50 backdrop-blur-sm"
                                      onClick={() => openDoc(doc)}
                                  >
                                      {/* BACKGROUND IMAGE & OVERLAY */}
                                      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" 
                                           style={{ backgroundImage: `url(${doc.cover_url || '/default-cover.jpg'})` }}>
                                      </div>
                                      <div className="absolute inset-0 bg-black/70 group-hover:bg-black/60 transition-colors"></div>
                                      
                                      <div className="p-5 flex items-center justify-between relative z-10">
                                          <div className="flex items-center gap-4">
                                              <div className="w-10 h-10 rounded-none flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20">
                                                  <Folder className="h-5 w-5 text-white" />
                                              </div>
                                              <div>
                                                  <h3 className="font-thin text-lg text-white group-hover:underline decoration-white/50 underline-offset-4 transition-all">{doc.title}</h3>
                                                  <p className="text-xs text-white/60 mt-0.5 font-light">{t('index.secureFolder')}</p>
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
                                      className="group hover:border-[#00236F]/50 transition-all cursor-pointer border-l-4 shadow-sm hover:shadow-md rounded-none bg-white"
                                      style={{ borderLeftColor: doc.color || '#00236F' }}
                                      onClick={() => openDoc(doc)}
                                  >
                                      <div className="p-4 flex items-center justify-between">
                                          <div className="flex items-center gap-4">
                                              <div 
                                                className="w-10 h-10 rounded-none flex items-center justify-center text-white shadow-sm"
                                                style={{ backgroundColor: doc.color || '#00236F' }}
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
                  <p className="mt-6 text-lg text-gray-500 font-light">{t('index.exploring')}</p>
                </div>
              ) : groupedResults.length > 0 ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <p className="text-sm text-gray-400 mb-6 px-2 font-medium tracking-wide uppercase">
                    {totalResults} {totalResults > 1 ? t('index.results') : t('index.result')} {totalResults > 1 ? t('index.founds') : t('index.found')}
                  </p>
                  
                  <div className={activeEntity ? "grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" : "w-full"}>
                    <div className={activeEntity ? "lg:col-span-2 space-y-6" : "space-y-6"}>
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
                    {/* Colonne latérale droite: Knowledge Panel */}
                    {activeEntity && (
                      <div className="lg:col-span-1 hidden lg:block">
                        <KnowledgePanel entity={activeEntity} />
                      </div>
                    )}
                  </div>
                  {/* Affichage Mobile de l'entité (en dessous) */}
                  {activeEntity && (
                      <div className="block lg:hidden mt-8">
                        <KnowledgePanel entity={activeEntity} />
                      </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 animate-in fade-in duration-500">
                  <div className="h-24 w-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Globe className="h-10 w-10 text-gray-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('index.noWebResult')}</h3>
                  <p className="text-gray-500 max-w-md mx-auto">{t('index.noWebResultSub')}</p>
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