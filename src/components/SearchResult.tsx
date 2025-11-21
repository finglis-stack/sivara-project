import { ExternalLink, Globe, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface SearchResultProps {
  url: string;
  title: string;
  description: string;
  content: string;
  domain: string;
  crawledAt: string;
  isMainDomain?: boolean;
  relatedResults?: Array<{
    id: string;
    url: string;
    title: string;
    description: string;
    content: string;
    crawled_at: string;
  }>;
}

const SearchResult = ({ 
  url, 
  title, 
  description, 
  content, 
  domain, 
  crawledAt,
  isMainDomain = false,
  relatedResults = []
}: SearchResultProps) => {
  const [showRelated, setShowRelated] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getUrlPath = (fullUrl: string) => {
    try {
      const path = new URL(fullUrl).pathname;
      return path === '/' ? '' : path;
    } catch {
      return '';
    }
  };

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <div className="space-y-2">
      <div className={`group hover:bg-gray-50 rounded-2xl p-6 transition-all duration-300 ${isMainDomain ? 'bg-gray-50/50' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <img 
                src={faviconUrl} 
                alt={`${domain} favicon`}
                className="w-6 h-6 flex-shrink-0 rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="truncate font-medium">{domain}</span>
                {isMainDomain && (
                  <>
                    <span>•</span>
                    <span className="text-gray-700 font-semibold">Résultat principal</span>
                  </>
                )}
              </div>
            </div>
            
            <h2 className="text-2xl mb-2">
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-700 hover:text-gray-900 hover:underline flex items-center gap-2 group-hover:gap-3 transition-all duration-300"
              >
                {title}
                <ExternalLink size={18} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </a>
            </h2>
            
            {description && (
              <p className="text-base text-gray-700 mb-2 leading-relaxed">
                {description}
              </p>
            )}
            
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {content}
            </p>
            
            <p className="text-xs text-gray-500 mt-3">{formatDate(crawledAt)}</p>
          </div>
        </div>
      </div>

      {relatedResults.length > 0 && (
        <div className="ml-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRelated(!showRelated)}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full mb-2"
          >
            {showRelated ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Masquer {relatedResults.length} autre{relatedResults.length > 1 ? 's' : ''} résultat{relatedResults.length > 1 ? 's' : ''}
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Voir {relatedResults.length} autre{relatedResults.length > 1 ? 's' : ''} résultat{relatedResults.length > 1 ? 's' : ''}
              </>
            )}
          </Button>

          {showRelated && (
            <div className="border-l-2 border-gray-100 pl-4 space-y-3">
              {relatedResults.map((result) => {
                const path = getUrlPath(result.url);
                return (
                  <div key={result.id} className="group hover:bg-gray-50 rounded-xl p-3 transition-all duration-300">
                    <div className="flex items-start gap-2">
                      <CornerDownRight className="h-4 w-4 text-gray-300 mt-1.5 flex-shrink-0" />
                      <div>
                        <h3 className="text-lg leading-tight">
                          <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-gray-700 hover:text-gray-900 hover:underline flex items-center gap-2 flex-wrap"
                          >
                            <span>{result.title}</span>
                            {path && (
                              <span className="text-xs font-mono text-gray-400 font-normal">{path}</span>
                            )}
                          </a>
                        </h3>
                        {result.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-1">{result.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResult;