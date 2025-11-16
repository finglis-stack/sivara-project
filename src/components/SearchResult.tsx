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
                {title}
                <ExternalLink size={16} />
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