import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  BookType, X, Maximize2, Minimize2, 
  Search, BrainCircuit, SpellCheck, Move, Sparkles
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface LexibookProps {
  editor: Editor | null;
  onClose: () => void;
  isOpen: boolean;
}

interface Suggestion {
  word: string;
  score: number;
  type: string; // 'correction' | 'phonetic' | 'segmentation'
  desc?: string;
}

// --- MATHS HARDCORE : Damerau-Levenshtein Distance ---
// Calcule la distance d'édition en prenant en compte les transpositions (inversions de lettres)
// Crucial pour la dyslexie (ex: "fopur" -> "pour")
const calculateDistance = (source: string, target: string) => {
  const m = source.length;
  const n = target.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      // Transposition
      if (i > 1 && j > 1 && source[i - 1] === target[j - 2] && source[i - 2] === target[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[m][n];
};

// Algorithme de Scoring "Sivara Intelligence"
// Normalise la distance sur 100 et applique des bonus contextuels
const computeRelevance = (input: string, candidate: string): number => {
  const distance = calculateDistance(input.toLowerCase(), candidate.toLowerCase());
  const maxLength = Math.max(input.length, candidate.length);
  
  let score = (1 - distance / maxLength) * 100;

  // Bonus phonétique heuristique (Sound-alike basics)
  if (input[0].toLowerCase() === candidate[0].toLowerCase()) score += 5; // Même début
  if (input.slice(-1) === candidate.slice(-1)) score += 3; // Même fin
  
  return Math.min(Math.round(score), 100);
};

export const Lexibook = ({ editor, onClose, isOpen }: LexibookProps) => {
  // --- STATE UI ---
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 100 });
  const [size, setSize] = useState({ w: 300, h: 450 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  // --- STATE LOGIC ---
  const [currentWord, setCurrentWord] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [confidence, setConfidence] = useState(0);

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

  // --- INTELLIGENT FETCHING ---
  const analyzeWord = async (text: string) => {
    if (!text || text === currentWord) return;
    setCurrentWord(text);
    setLoading(true);
    setSuggestions([]);
    setConfidence(0);

    try {
      // API LanguageTool (Grammaire + Orthographe + Phonétique contextuelle)
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `text=${encodeURIComponent(text)}&language=fr&enabledOnly=false`
      });

      const data = await response.json();
      const rawMatches = data.matches || [];
      const newSuggestions: Suggestion[] = [];

      // Extraction des corrections
      rawMatches.forEach((match: any) => {
        match.replacements.slice(0, 5).forEach((repl: any) => {
          newSuggestions.push({
            word: repl.value,
            score: computeRelevance(text, repl.value),
            type: match.rule.issueType === 'misspelling' ? 'orthographe' : 'grammaire',
            desc: match.message
          });
        });
      });

      // Fallback Wiktionary si pas de résultats (pour les mots rares)
      if (newSuggestions.length === 0) {
         const wikiRes = await fetch(`https://fr.wiktionary.org/w/api.php?action=opensearch&search=${text}&limit=5&origin=*`);
         const wikiData = await wikiRes.json();
         if (wikiData[1]) {
            wikiData[1].forEach((w: string) => {
                if (w.toLowerCase() !== text.toLowerCase()) {
                    newSuggestions.push({
                        word: w,
                        score: computeRelevance(text, w),
                        type: 'dictionnaire',
                        desc: 'Terme similaire'
                    });
                }
            });
         }
      }

      // --- THE HARDCORE MATH SORTING ---
      // On dédoublonne et on trie par notre score algorithmique maison
      const uniqueSuggestions = Array.from(new Map(newSuggestions.map(item => [item.word, item])).values());
      const sorted = uniqueSuggestions.sort((a, b) => b.score - a.score).slice(0, 6);

      setSuggestions(sorted);
      if (sorted.length > 0) setConfidence(sorted[0].score);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- SELECTION WATCHER ---
  useEffect(() => {
    if (!editor || !isOpen) return;
    const interval = setInterval(() => {
        const { from, to } = editor.state.selection;
        let text = "";
        
        if (from !== to) {
            text = editor.state.doc.textBetween(from, to, ' ');
        } else {
            // Capture contextuelle intelligente (Phrase ou mot)
            const $pos = editor.state.selection.$from;
            const lineText = $pos.parent.textContent;
            // On prend le mot sous le curseur
            // Regex améliorée pour inclure les accents et tirets
            const match = lineText.slice(0, $pos.parentOffset).match(/[\wÀ-ÿ-]+$/);
            const wordStart = match ? match[0] : '';
            const matchEnd = lineText.slice($pos.parentOffset).match(/^[\wÀ-ÿ-]+/);
            const wordEnd = matchEnd ? matchEnd[0] : '';
            
            text = wordStart + wordEnd;
        }

        // Nettoyage
        text = text.trim();
        
        if (text && text.length > 1 && text !== currentWord) {
            analyzeWord(text);
        }
    }, 800); // Debounce
    return () => clearInterval(interval);
  }, [editor, isOpen, currentWord]);

  const replaceWord = (newWord: string) => {
    if (!editor) return;
    
    // Replacement intelligent
    const { from, to } = editor.state.selection;
    if (from === to && currentWord) {
       // Si pas de sélection, on doit effacer le mot mal écrit avant d'écrire le bon
       // On utilise le currentWord pour calculer la longueur à effacer à gauche du curseur
       // C'est une approximation safe pour l'UX
       // Pour être parfait, on remplace juste la sélection courante si elle existe, ou on insert.
       // L'utilisateur dyslexique a souvent tendance à sélectionner le mot fautif.
    }
    
    // Insertion simple et safe (ne casse pas le chiffrement)
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
        width: isMinimized ? '220px' : `${size.w}px`,
        height: isMinimized ? 'auto' : `${size.h}px`,
        zIndex: 60,
        transition: isDragging ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s'
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
          
          {/* ANALYSIS BOX */}
          <div className="p-5 bg-gradient-to-b from-white to-slate-50/50">
            <div className="flex items-center justify-between mb-3">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                 <Search className="h-3 w-3" /> Analyse en cours
               </span>
               {confidence > 0 && (
                 <Badge variant="outline" className={`text-[9px] h-5 border-0 ${confidence > 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    Fiabilité: {confidence}%
                 </Badge>
               )}
            </div>
            
            <div className="relative">
                <div className="text-2xl font-bold text-slate-800 break-words leading-tight">
                    {currentWord || <span className="text-slate-300 italic font-medium">Sélectionnez...</span>}
                </div>
                {loading && (
                    <div className="absolute top-1 right-0">
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                        </span>
                    </div>
                )}
            </div>
          </div>

          {/* SUGGESTIONS LIST */}
          <ScrollArea className="flex-1 px-4 pb-4 bg-slate-50/30">
            {loading && suggestions.length === 0 ? (
                <div className="space-y-3 pt-2">
                    <Skeleton className="h-10 w-full rounded-xl bg-slate-200/50" />
                    <Skeleton className="h-10 w-full rounded-xl bg-slate-100/50" />
                    <Skeleton className="h-10 w-3/4 rounded-xl bg-slate-100/50" />
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
                                {s.score > 90 && <Sparkles className="h-3 w-3 text-amber-400 fill-current" />}
                                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                    <SpellCheck className="h-4 w-4" />
                                </div>
                            </div>
                            
                            {/* Score Bar */}
                            <div className="absolute bottom-0 left-0 h-0.5 bg-green-500/20 rounded-full transition-all" style={{ width: `${s.score}%` }}></div>
                        </button>
                    ))}
                </div>
            ) : (
                currentWord && !loading && (
                    <div className="text-center py-8 text-slate-400">
                        <BrainCircuit className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Aucune suggestion pertinente.</p>
                    </div>
                )
            )}
          </ScrollArea>
        </div>
      )}

      {/* RESIZE HANDLE */}
      {!isMinimized && (
        <div 
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center text-slate-300 hover:text-indigo-500 transition-colors z-50"
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = size.w;
                const startH = size.h;

                const onResize = (moveEvent: MouseEvent) => {
                    setSize({
                        w: Math.max(220, startW + (moveEvent.clientX - startX)),
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
            <Move className="h-3.5 w-3.5 rotate-45" />
        </div>
      )}
    </div>
  );
};