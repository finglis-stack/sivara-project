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
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
        <div className="relative flex items-center bg-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300">
          <Search className="absolute left-6 text-gray-400 group-hover:text-blue-600 transition-colors duration-300" size={24} />
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
            className="mr-2 px-8 py-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 hover:scale-105 shadow-lg"
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