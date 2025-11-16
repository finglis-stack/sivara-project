import { ExternalLink, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SearchResultProps {
  url: string;
  title: string;
  description: string;
  content: string;
  domain: string;
  crawledAt: string;
}

const SearchResult = ({ url, title, description, content, domain, crawledAt }: SearchResultProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Construire l'URL du favicon via Google's favicon service
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <Card className="hover:shadow-lg transition-shadow">
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
                    // Fallback vers l'icône Globe si le favicon ne charge pas
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
  );
};

export default SearchResult;