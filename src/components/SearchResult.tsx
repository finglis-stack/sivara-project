import { ExternalLink, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card className={`hover:shadow-lg transition-shadow ${isMainDomain ? 'border-2 border-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl mb-1">
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                >
                  <img 
                    src={faviconUrl} 
                    alt={`${domain} favicon`}
                    className="w-5 h-5 flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const fallbackIcon = document.createElement('div');
                        fallbackIcon.className = 'w-5 h-5 flex-shrink-0';
                        fallbackIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
                        parent.insertBefore(fallbackIcon, parent.firstChild);
                      }
                    }}
                  />
                  {title}
                  <ExternalLink size={16} className="flex-shrink-0" />
                </a>
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Globe size={14} />
                <span className="truncate">{domain}</span>
                <span>•</span>
                <span>{formatDate(crawledAt)}</span>
                {isMainDomain && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 font-semibold">Résultat principal</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {description && (
            <CardDescription className="text-base mb-2">
              {description}
            </CardDescription>
          )}
          <p className="text-sm text-gray-600 line-clamp-3">
            {content}
          </p>
        </CardContent>
      </Card>

      {relatedResults.length > 0 && (
        <div className="ml-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRelated(!showRelated)}
            className="text-blue-600 hover:text-blue-800"
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
            <div className="mt-2 space-y-2">
              {relatedResults.map((result) => (
                <Card key={result.id} className="hover:shadow-md transition-shadow bg-gray-50">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-base">
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                      >
                        {result.title}
                        <ExternalLink size={14} className="flex-shrink-0" />
                      </a>
                    </CardTitle>
                    <p className="text-xs text-gray-500">{formatDate(result.crawled_at)}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {result.description && (
                      <p className="text-sm text-gray-600 mb-1">{result.description}</p>
                    )}
                    <p className="text-xs text-gray-500 line-clamp-2">{result.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResult;