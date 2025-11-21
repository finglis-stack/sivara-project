import { useState } from 'react';
import SearchBar from '@/components/SearchBar';
import SearchResult from '@/components/SearchResult';
import CrawlManager from '@/components/CrawlManager';
import StatsDisplay from '@/components/StatsDisplay';
import UserMenu from '@/components/UserMenu';
import { showError } from '@/utils/toast';
import { Settings, Sparkles, ArrowRight, Globe, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface GroupedResult {
  mainResult: SearchResultType;
  relatedResults: SearchResultType[];
  isMainDomain: boolean;
}

const Index = () => {
  const [results, setResults] = useState<SearchResultType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [showManage, setShowManage] = useState(false);

  const groupResultsByDomain = (results: SearchResultType[]): GroupedResult[] => {
    if (results.length === 0) return [];

    const grouped: { [key: string]: SearchResultType[] } = {};
    const mainDomain = results[0]?.domain;

    results.forEach(result => {
      const baseDomain = extractBaseDomain(result.domain);
      if (!grouped[baseDomain]) {
        grouped[baseDomain] = [];
      }
      grouped[baseDomain].push(result);
    });

    const groupedResults: GroupedResult[] = [];
    
    Object.entries(grouped).forEach(([domain, domainResults]) => {
      const [mainResult, ...relatedResults] = domainResults;
      groupedResults.push({
        mainResult,
        relatedResults,
        isMainDomain: extractBaseDomain(mainDomain) === domain
      });
    });

    return groupedResults.sort((a, b) => {
      if (a.isMainDomain && !b.isMainDomain) return -1;
      if (!a.isMainDomain && b.isMainDomain) return 1;
      return b.mainResult.rank - a.mainResult.rank;
    });
  };

  const extractBaseDomain = (domain: string): string => {
    const parts = domain.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return domain;
  };

  const handleSearch = async (query: string) => {
    try {
      setIsSearching(true);
      setHasSearched(true);

      console.log('Searching for:', query);

      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({ query, page: 1, limit: 50 }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Search error:', data);
        showError(data.details || 'Erreur lors de la recherche');
        setResults([]);
        setTotalResults(0);
        return;
      }

      setResults(data.results || []);
      setTotalResults(data.total || 0);
    } catch (error) {
      console.error('Search error:', error);
      showError('Erreur de connexion au serveur de recherche');
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  };

  const groupedResults = groupResultsByDomain(results);

  // Vue de gestion (Crawl Manager)
  if (showManage) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setShowManage(false)}
              className="text-2xl font-bold text-gray-900 hover:text-gray-700 transition-colors tracking-tight"
            >
              Sivara
            </button>
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
    <div className="min-h-screen bg-white font-sans selection:bg-black selection:text-white">
      {/* Header conditionnel : Transparent sur l'accueil, Blanc sur les résultats */}
      {hasSearched && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <button 
              onClick={() => {
                setHasSearched(false);
                setResults([]);
                setTotalResults(0);
              }}
              className="text-xl font-bold text-gray-900 tracking-tight hover:opacity-70 transition-opacity"
            >
              Sivara
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowManage(true)}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-all duration-300"
                title="Gérer l'indexation"
              >
                <Settings size={20} strokeWidth={1.5} />
              </button>
              <UserMenu />
            </div>
          </div>
        </header>
      )}

      <div className={hasSearched ? "pt-24" : ""}>
        {!hasSearched ? (
          // === LANDING PAGE ===
          <div className="relative min-h-screen w-full overflow-hidden flex flex-col">
             {/* Navbar Transparente Landing */}
            <nav className="absolute top-0 w-full z-50 border-b border-white/10 bg-black/10 backdrop-blur-sm">
              <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Logo blanc */}
                  <div className="h-9 w-9 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
                    <span className="text-white font-bold text-lg">S</span>
                  </div>
                  <span className="font-medium text-lg tracking-wide text-white drop-shadow-md">Sivara</span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowManage(true)}
                    className="text-white/80 hover:text-white transition-colors text-sm font-medium hidden sm:block"
                  >
                    Contribution
                  </button>
                  <UserMenu />
                </div>
              </div>
            </nav>

            {/* Background Hero */}
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 animate-in fade-in duration-1000"
              style={{ 
                backgroundImage: 'url(/search-hero.jpg)',
                backgroundPosition: 'center center'
              }}
            >
              {/* Overlay sombre élégant */}
              <div className="absolute inset-0 bg-black/40"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            </div>

            {/* Contenu Principal Centré */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full max-w-5xl mx-auto mt-10">
              <div className="w-full max-w-3xl space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
                
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium shadow-lg mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>L'information, pure et simple</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-white drop-shadow-2xl leading-[1.1]">
                  Explorez le web <br/>
                  <span className="font-light text-white/90">autrement.</span>
                </h1>
                
                <p className="text-lg md:text-xl text-white/80 font-light max-w-xl mx-auto leading-relaxed drop-shadow-md mb-8">
                  Un moteur de recherche respectueux, rapide et précis. 
                  Trouvez ce qui compte vraiment, sans le bruit.
                </p>

                {/* Barre de recherche */}
                <div className="w-full transform transition-all duration-300 hover:scale-[1.02]">
                  <SearchBar onSearch={handleSearch} isLoading={isSearching} />
                </div>

                {/* Suggestions / Tags rapides */}
                <div className="flex flex-wrap justify-center gap-3 pt-4 opacity-80">
                  {['Technologie', 'Science', 'Design', 'Actualités'].map((tag) => (
                    <button 
                      key={tag}
                      onClick={() => handleSearch(tag)}
                      className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/90 text-sm transition-all backdrop-blur-sm"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Landing minimaliste */}
            <div className="relative z-10 w-full py-6 border-t border-white/10 bg-black/20 backdrop-blur-sm">
              <div className="container mx-auto px-6 flex justify-center gap-8 text-xs text-white/60 font-medium uppercase tracking-widest">
                <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> Privé</span>
                <span className="flex items-center gap-2"><Zap className="w-3 h-3" /> Rapide</span>
                <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Universel</span>
              </div>
            </div>
          </div>
        ) : (
          // === RESULTATS ===
          <div className="container mx-auto px-4 pb-12">
            <div className="max-w-4xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <SearchBar onSearch={handleSearch} isLoading={isSearching} />
            </div>

            <div className="max-w-5xl mx-auto">
              {isSearching ? (
                <div className="text-center py-20 animate-in fade-in duration-500">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Aucun résultat
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Nous n'avons rien trouvé pour cette recherche. Essayez d'autres mots-clés ou vérifiez l'orthographe.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;