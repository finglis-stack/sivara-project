import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SearchBar from '@/components/SearchBar';
import SearchResult from '@/components/SearchResult';
import CrawlManager from '@/components/CrawlManager';
import StatsDisplay from '@/components/StatsDisplay';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { showError } from '@/utils/toast';

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

  const groupResultsByDomain = (results: SearchResultType[]): GroupedResult[] => {
    if (results.length === 0) return [];

    const grouped: { [key: string]: SearchResultType[] } = {};
    const mainDomain = results[0]?.domain;

    // Grouper par domaine
    results.forEach(result => {
      const baseDomain = extractBaseDomain(result.domain);
      if (!grouped[baseDomain]) {
        grouped[baseDomain] = [];
      }
      grouped[baseDomain].push(result);
    });

    // Convertir en format GroupedResult
    const groupedResults: GroupedResult[] = [];
    
    Object.entries(grouped).forEach(([domain, domainResults]) => {
      const [mainResult, ...relatedResults] = domainResults;
      groupedResults.push({
        mainResult,
        relatedResults,
        isMainDomain: extractBaseDomain(mainDomain) === domain
      });
    });

    // Trier : domaine principal en premier, puis par rank
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

      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({ query, page: 1, limit: 50 }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la recherche');
      }

      const data = await response.json();
      setResults(data.results || []);
      setTotalResults(data.total || 0);
    } catch (error) {
      console.error('Search error:', error);
      showError('Erreur lors de la recherche');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const groupedResults = groupResultsByDomain(results);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img 
              src="/logo.png" 
              alt="Sivara Logo" 
              className="h-16 w-auto"
            />
          </div>
          <p className="text-xl text-gray-600">
            Moteur de recherche intelligent avec web scraping
          </p>
        </div>

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="search">Recherche</TabsTrigger>
            <TabsTrigger value="manage">Gestion</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-8">
            <SearchBar onSearch={handleSearch} isLoading={isSearching} />

            {hasSearched && (
              <div className="max-w-4xl mx-auto">
                {isSearching ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Recherche en cours...</p>
                  </div>
                ) : groupedResults.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Environ {totalResults} résultat{totalResults > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-6">
                      {groupedResults.map((group, index) => (
                        <SearchResult
                          key={group.mainResult.id}
                          url={group.mainResult.url}
                          title={group.mainResult.title}
                          description={group.mainResult.description}
                          content={group.mainResult.content}
                          domain={group.mainResult.domain}
                          crawledAt={group.mainResult.crawled_at}
                          isMainDomain={group.isMainDomain}
                          relatedResults={group.relatedResults}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-xl text-gray-600">
                      Aucun résultat trouvé. Essayez une autre recherche ou ajoutez plus de pages à crawler.
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manage" className="space-y-8">
            <div className="max-w-4xl mx-auto space-y-6">
              <StatsDisplay />
              <CrawlManager />
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;