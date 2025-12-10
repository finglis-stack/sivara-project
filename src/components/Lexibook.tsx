import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  BookType, X, Move, Maximize2, Minimize2, 
  Search, Sparkles, Volume2, Type 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface LexibookProps {
  editor: Editor | null;
  onClose: () => void;
  isOpen: boolean;
}

interface WordSuggestion {
  word: string;
  score?: number;
  tags?: string[]; // adj, n, v, etc.
  defs?: string[];
}

export const Lexibook = ({ editor, onClose, isOpen }: LexibookProps) => {
  // --- STATE UI (Drag & Resize) ---
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 100 });
  const [size, setSize] = useState({ w: 300, h: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  // --- STATE LOGIC ---
  const [currentWord, setCurrentWord] = useState('');
  const [suggestions, setSuggestions] = useState<WordSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [synonyms, setSynonyms] = useState<string[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);

  // --- DRAG HANDLERS ---
  const startDrag = (e: React.MouseEvent) => {
    if (isMinimized) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const onDrag = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const stopDrag = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [isDragging]);

  // --- API CALLS ---
  const fetchSuggestions = async (word: string) => {
    setLoading(true);
    setSuggestions([]);
    setSynonyms([]);

    try {
      // 1. "Sounds Like" (Phonétique)
      const resSound = await fetch(`https://api.datamuse.com/words?sl=${word}&max=8`);
      const dataSound = await resSound.json();

      // 2. "Spelled Like" (Correction orthographique proche)
      const resSpell = await fetch(`https://api.datamuse.com/words?sp=${word}&max=5`);
      const dataSpell = await resSpell.json();

      // Fusionner et dédoublonner
      const combined = [...dataSound, ...dataSpell];
      const unique = Array.from(new Map(combined.map(item => [item.word, item])).values());
      
      setSuggestions(unique.slice(0, 8));

      // 3. Synonymes (Bonus)
      const resSyn = await fetch(`https://api.datamuse.com/words?rel_syn=${word}&max=5`);
      const dataSyn = await resSyn.json();
      setSynonyms(dataSyn.map((d: any) => d.word));

    } catch (e) {
      console.error("Lexibook API error", e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeWord = (word: string) => {
    if (word === currentWord) return;
    setCurrentWord(word);
    fetchSuggestions(word);
  };

  // --- WORD DETECTION ---
  useEffect(() => {
    if (!editor || !isOpen) return;

    const updateSelection = () => {
      const { from, to } = editor.state.selection;
      
      // Si sélection, prendre le texte
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        if (text && text.trim().length > 1) analyzeWord(text.trim());
        return;
      }

      // Sinon, on pourrait essayer de détecter le mot sous le curseur
      // Pour cette version, on se concentre sur la sélection explicite ou l'analyse périodique
    };

    editor.on('selectionUpdate', updateSelection);
    editor.on('update', updateSelection);

    return () => {
      editor.off('selectionUpdate', updateSelection);
      editor.off('update', updateSelection);
    };
  }, [editor, isOpen, currentWord]); // Added currentWord dependency for analyzeWord check

  // Détection manuelle plus robuste (Polling)
  const analyzeCurrentSelection = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    let text = "";
    
    if (from !== to) {
        text = editor.state.doc.textBetween(from, to, ' ');
    } else {
        // Essayer de capturer le mot autour du curseur
        const $pos = editor.state.selection.$from;
        const before = $pos.parent.textBetween(0, $pos.parentOffset, ' ');
        const after = $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size, ' ');
        
        const lastWordPart = before.split(/\s+/).pop() || '';
        const firstWordPart = after.split(/\s+/).shift() || '';
        text = lastWordPart + firstWordPart;
    }

    // Nettoyage ponctuation basique
    text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    
    if (text && text !== currentWord) {
        analyzeWord(text);
    }
  };

  // Trigger l'analyse régulièrement si le curseur bouge
  useEffect(() => {
      if (!editor || !isOpen) return;
      const interval = setInterval(analyzeCurrentSelection, 1000); // Debounce manuel 1s
      return () => clearInterval(interval);
  }, [editor, isOpen, currentWord]);

  const replaceWord = (newWord: string) => {
    if (!editor) return;
    // Le plus sûr pour éviter de casser la structure du doc crypté :
    // On remplace uniquement la sélection active ou on insère.
    editor.chain().focus().insertContent(newWord + ' ').run();
  };

  const translateTag = (tag: string) => {
      if (tag === 'n') return 'Nom';
      if (tag === 'v') return 'Verbe';
      if (tag === 'adj') return 'Adj';
      if (tag === 'adv') return 'Adv';
      return 'Mot';
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      style={{ 
        position: 'fixed', 
        left: position.x, 
        top: position.y,
        width: isMinimized ? '200px' : `${size.w}px`,
        height: isMinimized ? 'auto' : `${size.h}px`,
        zIndex: 50,
        transition: isDragging ? 'none' : 'width 0.2s, height 0.2s'
      }}
      className="bg-white rounded-xl shadow-2xl border-2 border-indigo-100 flex flex-col overflow-hidden font-sans"
    >
      {/* HEADER DRAGGABLE */}
      <div 
        onMouseDown={startDrag}
        className="h-10 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between px-3 cursor-move select-none"
      >
        <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
          <BookType className="h-4 w-4" />
          Lexibook
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-indigo-100 rounded text-indigo-400 hover:text-indigo-600 transition-colors">
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-red-100 rounded text-indigo-400 hover:text-red-500 transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* CONTENT */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white/95 backdrop-blur">
          
          {/* Current Word Display */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                <Search className="h-3 w-3" /> Mot détecté
            </div>
            <div className="text-xl font-bold text-gray-900 truncate">
                {currentWord || <span className="text-gray-300 italic">Sélectionnez un mot...</span>}
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-8 w-5/6" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Corrections Phonétiques */}
                    <div>
                        <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2 flex items-center gap-1">
                            <Volume2 className="h-3 w-3" /> Phonétique & Orthographe
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => replaceWord(s.word)}
                                    className="px-3 py-1.5 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 rounded-lg text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2 group"
                                >
                                    {s.word}
                                    {s.tags && s.tags[0] && (
                                        <span className="text-[9px] text-gray-300 group-hover:text-indigo-300 uppercase">{translateTag(s.tags[0])}</span>
                                    )}
                                </button>
                            ))}
                            {suggestions.length === 0 && currentWord && (
                                <span className="text-xs text-gray-400 italic">Aucune suggestion trouvée.</span>
                            )}
                        </div>
                    </div>

                    {/* Synonymes */}
                    {synonyms.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-emerald-300 uppercase mb-2 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Synonymes
                            </h4>
                            <div className="flex flex-col gap-1">
                                {synonyms.map((syn, i) => (
                                    <button
                                        key={i}
                                        onClick={() => replaceWord(syn)}
                                        className="text-left px-3 py-1.5 hover:bg-gray-50 rounded-md text-sm text-gray-600 hover:text-gray-900 transition-colors w-full flex items-center gap-2"
                                    >
                                        <Type className="h-3 w-3 text-gray-300" />
                                        {syn}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
          </ScrollArea>

          {/* Footer Info */}
          <div className="p-2 border-t border-gray-100 bg-gray-50 text-[10px] text-center text-gray-400 flex justify-between px-4">
             <span>Mode Dyslexie Actif</span>
             <span>Sivara Intelligence</span>
          </div>
        </div>
      )}
      
      {/* RESIZE HANDLE */}
      {!isMinimized && (
        <div 
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center text-gray-300 hover:text-indigo-400"
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = size.w;
                const startH = size.h;

                const onResize = (moveEvent: MouseEvent) => {
                    setSize({
                        w: Math.max(200, startW + (moveEvent.clientX - startX)),
                        h: Math.max(200, startH + (moveEvent.clientY - startY))
                    });
                };
                const stopResize = () => {
                    window.removeEventListener('mousemove', onResize);
                    window.removeEventListener('mouseup', stopResize);
                };
                window.addEventListener('mousemove', onResize);
                window.addEventListener('mouseup', stopResize);
            }}
        >
            <Move className="h-3 w-3 rotate-45" />
        </div>
      )}
    </div>
  );
};