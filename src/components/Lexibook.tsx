import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  BookType, X, Move, Maximize2, Minimize2, 
  Search, Sparkles, Volume2, Type, BookOpen
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
  type?: string;
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

  // --- API CALLS (DICTIONNAIRE FRANÇAIS) ---
  const fetchSuggestions = async (word: string) => {
    setLoading(true);
    setSuggestions([]);

    try {
      // Utilisation de l'API OpenSearch de Wiktionnaire Français
      // Cela retourne les mots existants qui commencent par ou ressemblent à l'entrée
      const response = await fetch(
        `https://fr.wiktionary.org/w/api.php?action=opensearch&search=${word}&limit=10&namespace=0&format=json&origin=*`
      );
      
      const data = await response.json();
      // data format: [search_term, [suggestions], [descriptions], [links]]
      
      if (data && data[1]) {
        const foundWords = data[1].map((w: string) => ({ word: w }));
        // Filtrer pour éviter de proposer exactement ce que l'utilisateur a déjà tapé s'il cherche une correction
        const filtered = foundWords.filter((w: any) => w.word.toLowerCase() !== word.toLowerCase());
        
        // Si le mot exact existe (c'est un mot valide), on le met en premier pour confirmer
        const exactMatch = foundWords.find((w: any) => w.word.toLowerCase() === word.toLowerCase());
        
        // On combine : mots proches orthographiquement
        setSuggestions(filtered.length > 0 ? filtered : foundWords);
      }

    } catch (e) {
      console.error("Lexibook Dictionary error", e);
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
        
        // Regex pour capturer le mot complet (incluant accents français)
        const lastWordPart = before.split(/[\s'’.,;!?]+/).pop() || '';
        const firstWordPart = after.split(/[\s'’.,;!?]+/).shift() || '';
        text = lastWordPart + firstWordPart;
    }

    // Nettoyage ponctuation résiduelle
    text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    
    if (text && text.length > 1 && text !== currentWord) {
        analyzeWord(text);
    }
  };

  // Trigger l'analyse régulièrement si le curseur bouge
  useEffect(() => {
      if (!editor || !isOpen) return;
      const interval = setInterval(analyzeCurrentSelection, 800); // Debounce
      return () => clearInterval(interval);
  }, [editor, isOpen, currentWord]);

  const replaceWord = (newWord: string) => {
    if (!editor) return;
    
    // Logique de remplacement intelligente
    const { from, to } = editor.state.selection;
    const $pos = editor.state.selection.$from;
    
    if (from === to && currentWord) {
        // Si pas de sélection, on remplace le mot détecté autour du curseur
        const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, ' ');
        // On cherche la position de début du mot courant
        const offset = textBefore.lastIndexOf(currentWord.substring(0, Math.min(currentWord.length, textBefore.length)));
        
        if (offset !== -1) {
            const startPos = $pos.start() + offset;
            // On supprime le mot détecté (approximatif) et on insère le nouveau
            // Note: C'est une heuristique, pour être parfait il faudrait des nodes
            // Mais pour de l'aide à la rédaction c'est souvent suffisant
            editor.commands.insertContentAt({ from: startPos, to: startPos + currentWord.length }, newWord);
            return;
        }
    }

    // Fallback: Remplacement standard de la sélection
    editor.chain().focus().insertContent(newWord).run();
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
                <Search className="h-3 w-3" /> Mot analysé
            </div>
            <div className="text-xl font-bold text-gray-900 truncate">
                {currentWord || <span className="text-gray-300 italic">...</span>}
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
                    {/* Corrections Orthographiques */}
                    <div>
                        <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> Dictionnaire
                        </h4>
                        <div className="flex flex-col gap-2">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => replaceWord(s.word)}
                                    className="w-full text-left px-3 py-2 bg-white border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 rounded-lg text-sm transition-all shadow-sm active:scale-95 flex items-center justify-between group"
                                >
                                    <span className="font-medium">{s.word}</span>
                                    <span className="opacity-0 group-hover:opacity-100 text-indigo-400 text-xs">Utiliser</span>
                                </button>
                            ))}
                            {suggestions.length === 0 && currentWord && (
                                <div className="text-center py-4">
                                    <p className="text-xs text-gray-400 italic">Aucune suggestion trouvée.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </ScrollArea>
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