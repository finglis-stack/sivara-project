import { ExternalLink, Globe, ChevronDown, ChevronUp } from 'lucide-react';
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

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <div className="space-y-2">
      <div className={`group hover:bg-white/50 rounded-2xl p-6 transition-all duration-300 ${isMainDomain ? 'bg-blue-50/50' : ''}`}>
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
                    <span className="text-blue-600 font-semibold">Résultat principal</span>
                  </>
                )}
              </div>
            </div>
            
            <h2 className="text-2xl mb-2">
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-2 group-hover:gap-3 transition-all duration-300"
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
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full"
          >
            {showRelated ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Masquer {relatedResults.length} autre{relatedResults.length > 1 ? 's' : ''} résultat{relatedResults.length > 1 ? 's' : ''} de {domain}
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Voir {relatedResults.length} autre{relatedResults.length > 1 ? 's' : ''} résultat{relatedResults.length > 1 ? 's' : ''} de {domain}
              </>
            )}
          </Button>

          {showRelated && (
            <div className="mt-3 space-y-2">
              {relatedResults.map((result) => (
                <div key={result.id} className="hover:bg-white/50 rounded-xl p-4 transition-all duration-300">
                  <h3 className="text-lg mb-1">
                    <a 
                      href={result.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-2"
                    >
                      {result.title}
                      <ExternalLink size={14} className="flex-shrink-0" />
                    </a>
                  </h3>
                  {result.description && (
                    <p className="text-sm text-gray-600 mb-1">{result.description}</p>
                  )}
                  <p className="text-xs text-gray-500 line-clamp-2">{result.content}</p>
                  <p className="text-xs text-gray-400 mt-2">{formatDate(result.crawled_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResult;