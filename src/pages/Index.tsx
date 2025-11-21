import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SearchBar from '@/components/SearchBar';
import SearchResult from '@/components/SearchResult';
import CrawlManager from '@/components/CrawlManager';
import StatsDisplay from '@/components/StatsDisplay';
import UserMenu from '@/components/UserMenu';
import { showError } from '@/utils/toast';
import { Settings } from 'lucide-react';

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
      
      console.log('Search response:', data);

      if (!response.ok) {
        console.error('Search error:', data);
        showError(data.details || 'Erreur lors de la recherche');
        setResults([]);
        setTotalResults(0);
        return;
      }

      setResults(data.results || []);
      setTotalResults(data.total || 0);
      
      if (!data.results || data.results.length === 0) {
        console.log('No results found');
      }
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

  if (showManage) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setShowManage(false)}
              className="text-2xl font-bold text-gray-700 hover:text-gray-900 transition-colors"
            >
              Sivara
            </button>
            <UserMenu />
          </div>
          
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Gestion du Crawler</h1>
            <StatsDisplay />
            <CrawlManager />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header avec logo texte */}
      {hasSearched && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-700">
              Sivara
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowManage(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300 text-gray-700"
              >
                <Settings size={18} />
                <span className="text-sm font-medium">Gestion</span>
              </button>
              <UserMenu />
            </div>
          </div>
        </header>
      )}

      <div className={hasSearched ? "pt-20" : ""}>
        {!hasSearched ? (
          // Landing page
          <div className="container mx-auto px-4">
            <div className="min-h-screen flex flex-col items-center justify-center relative">
              {/* Boutons en haut à droite */}
              <div className="absolute top-8 right-8 flex items-center gap-3">
                <button
                  onClick={() => setShowManage(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-300 text-gray-700"
                >
                  <Settings size={18} />
                  <span className="text-sm font-medium">Gestion</span>
                </button>
                <UserMenu />
              </div>

              <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <h1 className="text-8xl font-bold mb-4 text-gray-700 animate-in zoom-in duration-1000">
                  Sivara
                </h1>
                <p className="text-xl text-gray-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                  Moteur de recherche intelligent avec web scraping
                </p>
              </div>

              <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <SearchBar onSearch={handleSearch} isLoading={isSearching} />
              </div>

              {/* Animations décoratives neutres */}
              <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gray-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gray-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-gray-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
              </div>
            </div>
          </div>
        ) : (
          // Page de résultats
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <SearchBar onSearch={handleSearch} isLoading={isSearching} />
            </div>

            <div className="max-w-5xl mx-auto">
              {isSearching ? (
                <div className="text-center py-20 animate-in fade-in duration-500">
                  <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-gray-400"></div>
                  <p className="mt-6 text-xl text-gray-600">Recherche en cours...</p>
                </div>
              ) : groupedResults.length > 0 ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <p className="text-sm text-gray-600 mb-6 px-2">
                    Environ {totalResults} résultat{totalResults > 1 ? 's' : ''}
                  </p>
                  <div className="space-y-4">
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
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="text-2xl text-gray-600 mb-2">
                    Aucun résultat trouvé
                  </p>
                  <p className="text-gray-500">
                    Essayez une autre recherche ou ajoutez plus de pages à crawler
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