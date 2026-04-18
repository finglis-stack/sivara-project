import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

const SearchBar = ({ onSearch, isLoading = false, value, onChange }: SearchBarProps) => {
  const { t } = useTranslation();
  const [internalQuery, setInternalQuery] = useState('');
  
  const query = value !== undefined ? value : internalQuery;
  const setQuery = onChange || setInternalQuery;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        <div className="relative flex items-center w-full bg-white rounded-none border border-[#c5c5d3]/30 focus-within:border-[#00236F] focus-within:ring-1 focus-within:ring-[#00236F] shadow-sm transition-colors overflow-hidden">
          <Search className="absolute left-6 text-[#00236F] transition-colors duration-300" size={20} />
          <Input
            type="text"
            placeholder={t('index.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 pl-14 pr-40 py-6 text-lg border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-[#111111] placeholder:text-[#5a5b67]/80"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="lg" 
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-2 bottom-2 bg-[#00236F] hover:bg-[#1e3a8a] text-white px-6 rounded-none font-bold uppercase tracking-wider shadow-sm transition-colors text-sm"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              </div>
            ) : (
              t('index.searchButton')
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default SearchBar;