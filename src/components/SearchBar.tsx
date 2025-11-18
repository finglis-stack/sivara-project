import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

const SearchBar = ({ onSearch, isLoading = false }: SearchBarProps) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gray-200 rounded-full blur opacity-20 group-hover:opacity-30 transition duration-300"></div>
        <div className="relative flex items-center bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200">
          <Search className="absolute left-6 text-gray-400 group-hover:text-gray-600 transition-colors duration-300" size={24} />
          <Input
            type="text"
            placeholder="Rechercher sur Sivara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 pl-16 pr-6 py-7 text-lg border-0 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="lg" 
            disabled={isLoading || !query.trim()}
            className="mr-2 px-8 py-6 rounded-full bg-gray-700 hover:bg-gray-800 transition-all duration-300 hover:scale-105 shadow-md text-white"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Recherche...</span>
              </div>
            ) : (
              'Rechercher'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default SearchBar;