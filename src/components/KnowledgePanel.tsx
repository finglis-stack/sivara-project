import { SearchEntity } from './admin/EntitiesManager';
import { ExternalLink, Globe, Book } from 'lucide-react';
import { Button } from './ui/button';

interface KnowledgePanelProps {
  entity: SearchEntity;
}

const KnowledgePanel = ({ entity }: KnowledgePanelProps) => {
  return (
    <div className="bg-white rounded-none border border-[#c5c5d3]/30 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500 sticky top-28">
      {/* Cover Image */}
      {entity.cover_url && (
        <div className="h-32 w-full bg-gray-100 overflow-hidden relative">
          <img src={entity.cover_url} alt={`${entity.name} cover`} className="w-full h-full object-cover" />
        </div>
      )}
      
      <div className="p-6 relative">
        {/* Header (Logo + Name) */}
        <div className="flex items-start gap-4">
          {entity.logo_url && (
            <div className={`shrink-0 overflow-hidden bg-white ${entity.cover_url ? '-mt-12 w-16 h-16 rounded-lg shadow-sm border border-[#c5c5d3]/30' : 'w-12 h-12 rounded-none'}`}>
              <img src={entity.logo_url} alt={`${entity.name} logo`} className="w-full h-full object-contain p-1" />
            </div>
          )}
          <div className={`${entity.cover_url && entity.logo_url ? 'mt-2' : ''}`}>
            <h2 className="text-2xl font-bold text-[#111111] leading-tight">{entity.name}</h2>
            {entity.phonetic && (
              <span className="text-sm font-medium text-gray-500 tracking-wide">{entity.phonetic}</span>
            )}
          </div>
        </div>

        {/* Description */}
        {entity.description && (
          <p className="mt-4 text-sm text-[#2c2d38] leading-relaxed">
            {entity.description}
          </p>
        )}

        {/* Links / Actions */}
        {(entity.website_url || entity.wikipedia_url) && (
          <div className="mt-6 flex flex-col gap-2 border-t border-[#c5c5d3]/20 pt-4">
            {entity.website_url && (
              <a href={entity.website_url} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button variant="outline" className="w-full rounded-none border-[#c5c5d3]/50 text-[#00236F] hover:bg-[#FAF9F4] justify-between">
                  Site officiel <Globe className="h-4 w-4" />
                </Button>
              </a>
            )}
            {entity.wikipedia_url && (
              <a href={entity.wikipedia_url} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button variant="ghost" className="w-full rounded-none text-gray-600 hover:text-[#111111] hover:bg-[#FAF9F4] justify-between">
                  Wikipédia <Book className="h-4 w-4" />
                </Button>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgePanel;
