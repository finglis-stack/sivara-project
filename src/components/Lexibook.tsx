import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  BookType, X, Move, Maximize2, Minimize2, 
  Search, Sparkles, SpellCheck
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface LexibookProps {
  editor: Editor | null;
  onClose: () => void;
  isOpen: boolean;
}

interface Suggestion {
  word: string;
  desc?: string;
  type: 'correction' | 'synonym';
}

export const Lexibook = ({ editor, onClose, isOpen }: LexibookProps) => {
  // --- STATE UI ---
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 100 });
  const [size, setSize] = useState({ w: 300, h: 450 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  // --- STATE LOGIC ---
  const [currentWord, setCurrentWord] = useState('');
  // On stocke la range (position) du mot détecté pour pouvoir le remplacer proprement
  const [currentRange, setCurrentRange] = useState<{ from: number, to: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // --- DRAG HANDLERS ---
  const startDrag = (e: React.MouseEvent) => {
    if (isMinimized) return;
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDragging) setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const handleUp = () => setIsDragging(false);
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, dragOffset]);

  // --- API CALLS (LanguageTool) ---
  const fetchSuggestions = async (word: string) => {
    setLoading(true);
    setSuggestions([]);

    try {
      // LanguageTool est excellent pour la correction orthographique contextuelle
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `text=${encodeURIComponent(word)}&language=fr&enabledOnly=false`
      });

      const data = await response.json();
      const newSuggestions: Suggestion[] = [];

      // 1. Corrections (Matches)
      if (data.matches && data.matches.length > 0) {
          data.matches.forEach((match: any) => {
              match.replacements.slice(0, 5).forEach((repl: any) => {
                  // On évite les suggestions avec des espaces si le mot n'en a pas (ex: "sa lu")
                  // Sauf si c'est vraiment pertinent, mais pour un mot simple, on préfère "salut"
                  if (!repl.value.includes(' ')) {
                      newSuggestions.push({
                          word: repl.value,
                          desc: "Correction",
                          type: 'correction'
                      });
                  }
              });
          });
      }

      // Si aucune correction n'est trouvée (mot potentiellement juste), on cherche des synonymes
      // Ou si on a peu de résultats
      if (newSuggestions.length < 3) {
          try {
             // Fallback Wiktionary pour les mots proches / synonymes si le mot existe
             const wikiRes = await fetch(`https://fr.wiktionary.org/w/api.php?action=opensearch&search=${word}&limit=5&format=json&origin=*`);
             const wikiData = await wikiRes.json();
             
             if (wikiData[1]) {
                wikiData[1].forEach((w: string) => {
                    if (w.toLowerCase() !== word.toLowerCase()) {
                        // On vérifie qu'on ne l'a pas déjà
                        if (!newSuggestions.find(s => s.word === w)) {
                            newSuggestions.push({ word: w, type: 'correction', desc: "Similaire" });
                        }
                    }
                });
             }
          } catch (e) { /* ignore wiki errors */ }
      }

      setSuggestions(newSuggestions);

    } catch (e) {
      console.error("API error", e);
    } finally {
      setLoading(false);
    }
  };

  // --- WORD DETECTION (SMART RANGE) ---
  const analyzeContext = () => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    let text = "";
    let range = { from, to };

    if (from !== to) {
        // Cas 1 : Texte sélectionné explicitement
        text = editor.state.doc.textBetween(from, to, ' ');
    } else {
        // Cas 2 : Curseur simple -> On trouve le mot AUTOUR du curseur
        const $pos = editor.state.selection.$from;
        const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, ' ');
        const textAfter = $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size, ' ');

        // Regex qui capture les lettres, accents, et tirets.
        const matchBefore = textBefore.match(/[\wÀ-ÿ-]+$/);
        const matchAfter = textAfter.match(/^[\wÀ-ÿ-]+/);

        if (matchBefore || matchAfter) {
            const partBefore = matchBefore ? matchBefore[0] : '';
            const partAfter = matchAfter ? matchAfter[0] : '';
            
            text = partBefore + partAfter;
            
            // Calcul précis des positions absolues pour le remplacement futur
            const start = $pos.pos - partBefore.length;
            const end = $pos.pos + partAfter.length;
            range = { from: start, to: end };
        }
    }

    // Nettoyage (ponctuation collée éventuelle)
    const cleanText = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    
    if (cleanText && cleanText.length > 1 && cleanText !== currentWord) {
        setCurrentWord(cleanText);
        setCurrentRange(range); // On sauvegarde la position exacte
        fetchSuggestions(cleanText);
    }
  };

  // Polling intelligent : vérifie le mot sous le curseur
  useEffect(() => {
      if (!editor || !isOpen) return;
      const interval = setInterval(analyzeContext, 600);
      return () => clearInterval(interval);
  }, [editor, isOpen, currentWord]);

  // --- REPLACE FUNCTION ---
  const replaceWord = (newWord: string) => {
    if (!editor || !currentRange) return;
    
    // On remplace la plage exacte qu'on avait détectée (supprime l'ancien, met le nouveau)
    // chain() permet d'enchaîner les commandes de manière atomique
    editor
        .chain()
        .focus()
        .deleteRange(currentRange) // Supprime "salu"
        .insertContent(newWord)    // Insère "Salut"
        .run();
        
    // Reset pour forcer une nouvelle analyse si le curseur bouge
    setCurrentWord(newWord); 
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
      className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 ring-1 ring-black/5 flex flex-col overflow-hidden font-sans select-none"
    >
      {/* HEADER */}
      <div 
        onMouseDown={startDrag}
        className="h-12 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border-b border-indigo-100/50 flex items-center justify-between px-4 cursor-move"
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-white p-1.5 rounded-lg shadow-sm">
            <BookType className="h-4 w-4 text-indigo-600" />
          </div>
          <span className="text-sm font-bold text-slate-700 tracking-tight">Lexibook</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/50 rounded-md text-slate-400 hover:text-indigo-600 transition-colors">
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-500 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* BODY */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Analysis Box */}
          <div className="p-5 bg-gradient-to-b from-white to-slate-50/50">
            <div className="flex items-center justify-between mb-3">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                 <Search className="h-3 w-3" /> Mot détecté
               </span>
            </div>
            
            <div className="relative">
                <div className="text-2xl font-bold text-slate-800 break-words leading-tight">
                    {currentWord || <span className="text-slate-300 italic font-medium">...</span>}
                </div>
            </div>
          </div>

          {/* Suggestions List */}
          <ScrollArea className="flex-1 px-4 pb-4 bg-slate-50/30">
            {loading && suggestions.length === 0 ? (
                <div className="space-y-3 pt-2">
                    <Skeleton className="h-10 w-full rounded-xl bg-slate-200/50" />
                    <Skeleton className="h-10 w-full rounded-xl bg-slate-100/50" />
                </div>
            ) : suggestions.length > 0 ? (
                <div className="space-y-2 pt-2">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => replaceWord(s.word)}
                            className="w-full group relative flex items-center justify-between p-3 bg-white hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-200 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
                        >
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-slate-700 text-base">{s.word}</span>
                                {s.desc && <span className="text-[10px] text-slate-400 line-clamp-1 text-left">{s.desc}</span>}
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {s.type === 'synonym' && <Sparkles className="h-3 w-3 text-emerald-400" />}
                                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                    <SpellCheck className="h-4 w-4" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                currentWord && !loading && (
                    <div className="text-center py-8 text-slate-400">
                        <p className="text-xs">Aucune suggestion.</p>
                    </div>
                )
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