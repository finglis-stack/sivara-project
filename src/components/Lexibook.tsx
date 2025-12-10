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
  score: number;
  type: string;
  desc?: string;
}

// --- ALGO PHONÉTIQUE FRANÇAIS SIMPLIFIÉ (Soundex-like) ---
// Transforme "jeune", "geune", "jeunne" => un code sonore commun
const frenchSoundex = (s: string) => {
    let a = s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève accents
        .replace(/[^a-z]/g, ''); // Garde que les lettres

    if (a === "" || a.length === 0) return "";

    const firstChar = a[0].toUpperCase();
    
    // 1. Remplacements phonétiques majeurs
    a = a.replace(/qu/g, 'k')
         .replace(/q/g, 'k')
         .replace(/ph/g, 'f')
         .replace(/gn/g, 'n') // oignon -> onion
         .replace(/ch/g, 'S') // chat -> Sat
         .replace(/eau/g, 'o')
         .replace(/au/g, 'o')
         .replace(/ai/g, 'e')
         .replace(/ei/g, 'e')
         .replace(/er$/g, 'e') // manger -> mange
         .replace(/ez$/g, 'e') // mangez -> mange
         .replace(/s$/g, '') // pluriel simple
         .replace(/t$/g, ''); // mot muet fin

    // 2. Simplification des consonnes
    // B, P => 1
    // C, K, Q => 2
    // D, T => 3
    // L => 4
    // M, N => 5
    // R => 6
    // G, J => 7
    // S, Z, X => 8
    // F, V => 9
    const mappings: {[key: string]: string} = {
        'b': '1', 'p': '1',
        'c': '2', 'k': '2',
        'd': '3', 't': '3',
        'l': '4',
        'm': '5', 'n': '5',
        'r': '6',
        'g': '7', 'j': '7',
        's': '8', 'z': '8', 'x': '8',
        'f': '9', 'v': '9'
    };

    let res = firstChar;
    let prevCode = mappings[firstChar.toLowerCase()] || '';

    for (let i = 1; i < a.length; i++) {
        const char = a[i];
        const code = mappings[char];
        
        if (code && code !== prevCode) {
            res += code;
            prevCode = code;
        }
    }

    return res.substring(0, 4); // Code sur 4 chars max
};

const calculateDistance = (source: string, target: string) => {
  const m = source.length;
  const n = target.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && source[i - 1] === target[j - 2] && source[i - 2] === target[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[m][n];
};

const computeRelevance = (input: string, candidate: string): number => {
  // 1. Distance Orthographique (Damerau-Levenshtein)
  const distance = calculateDistance(input.toLowerCase(), candidate.toLowerCase());
  const maxLength = Math.max(input.length, candidate.length);
  let score = (1 - distance / maxLength) * 100;

  // 2. Bonus Phonétique (Le mot sonne-t-il pareil ?)
  const soundInput = frenchSoundex(input);
  const soundCand = frenchSoundex(candidate);
  
  if (soundInput && soundCand && soundInput === soundCand) {
      score += 30; // GROS BONUS si ça sonne pareil (ex: bo -> beau)
  }

  // 3. Pénalités de structure (éviter les trucs chelous)
  if (candidate === candidate.toUpperCase() && input !== input.toUpperCase()) score -= 50; // Acronymes
  if (candidate.includes(' ')) score -= 10; // Mots composés moins probables pour un mot simple
  
  return Math.min(Math.round(score), 100);
};

export const Lexibook = ({ editor, onClose, isOpen }: LexibookProps) => {
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 100 });
  const [size, setSize] = useState({ w: 280, h: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  const [currentWord, setCurrentWord] = useState('');
  const [currentRange, setCurrentRange] = useState<{ from: number, to: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

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

  const analyzeWord = async (text: string) => {
    if (!text || text === currentWord) return;
    setCurrentWord(text);
    setLoading(true);
    setSuggestions([]);

    try {
      // On utilise LanguageTool pour la correction, mais on va filtrer agressivement
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `text=${encodeURIComponent(text)}&language=fr&enabledOnly=false`
      });

      const data = await response.json();
      let rawSuggestions: string[] = [];

      // Récupération des corrections
      if (data.matches) {
          data.matches.forEach((match: any) => {
              match.replacements.slice(0, 8).forEach((repl: any) => {
                  rawSuggestions.push(repl.value);
              });
          });
      }

      // Si LT ne trouve rien, Wiktionary pour compléter (ex: début de mot)
      if (rawSuggestions.length === 0) {
         const wikiRes = await fetch(`https://fr.wiktionary.org/w/api.php?action=opensearch&search=${text}&limit=5&origin=*`);
         const wikiData = await wikiRes.json();
         if (wikiData[1]) rawSuggestions = wikiData[1];
      }

      // --- FILTRAGE INTELLIGENT ---
      const cleanSuggestions = rawSuggestions
        .filter(word => {
            // 1. Pas le mot lui-même
            if (word.toLowerCase() === text.toLowerCase()) return false;
            // 2. Pas d'acronymes ALL CAPS si l'input n'est pas ALL CAPS (ex: BO)
            if (word === word.toUpperCase() && text !== text.toUpperCase()) return false;
            // 3. Pas de chiffres ou symboles bizarres
            if (/[0-9]/.test(word)) return false;
            // 4. Longueur minimale (sauf mots communs)
            if (word.length < 2 && !['a', 'y', 'à'].includes(word.toLowerCase())) return false;
            return true;
        })
        .map(word => ({
            word,
            score: computeRelevance(text, word),
            type: 'correction'
        }));

      // Dédoublonnage et Tri par pertinence (Score maison)
      const unique = Array.from(new Map(cleanSuggestions.map(s => [s.word, s])).values());
      const sorted = unique.sort((a, b) => b.score - a.score).slice(0, 5);

      setSuggestions(sorted);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!editor || !isOpen) return;
    const interval = setInterval(() => {
        const { from, to } = editor.state.selection;
        let text = "";
        
        if (from !== to) {
            text = editor.state.doc.textBetween(from, to, ' ');
        } else {
            const $pos = editor.state.selection.$from;
            const lineText = $pos.parent.textContent;
            
            // Regex améliorée pour capturer le mot complet (lettres + accents)
            const before = lineText.slice(0, $pos.parentOffset);
            const after = lineText.slice($pos.parentOffset);
            
            const matchBefore = before.match(/[\wÀ-ÿ-]+$/);
            const matchAfter = after.match(/^[\wÀ-ÿ-]+/);
            
            const start = matchBefore ? matchBefore[0] : '';
            const end = matchAfter ? matchAfter[0] : '';
            
            text = start + end;
            
            // Calculer la range réelle pour le remplacement
            if (text) {
                const startPos = $pos.pos - start.length;
                const endPos = $pos.pos + end.length;
                setCurrentRange({ from: startPos, to: endPos });
            }
        }

        text = text.trim();
        if (text && text.length > 1 && text !== currentWord) {
            analyzeWord(text);
        }
    }, 600);
    return () => clearInterval(interval);
  }, [editor, isOpen, currentWord]);

  const replaceWord = (newWord: string) => {
    if (!editor || !currentRange) return;
    // Remplacement chirurgical (supprime l'ancien, met le nouveau)
    editor.chain().focus().deleteRange(currentRange).insertContent(newWord).run();
    setCurrentWord(newWord); 
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      style={{ 
        position: 'fixed', left: position.x, top: position.y,
        width: isMinimized ? '200px' : `${size.w}px`,
        height: isMinimized ? 'auto' : `${size.h}px`,
        zIndex: 60, transition: isDragging ? 'none' : 'width 0.2s, height 0.2s'
      }}
      className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-slate-200 ring-1 ring-black/5 flex flex-col overflow-hidden font-sans select-none"
    >
      <div onMouseDown={startDrag} className="h-11 bg-slate-50 border-b border-slate-100 flex items-center justify-between px-4 cursor-move">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1 rounded-md"><BookType className="h-3.5 w-3.5 text-white" /></div>
          <span className="text-sm font-bold text-slate-800">Lexibook</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-slate-200 rounded text-slate-400"><Minimize2 className="h-3.5 w-3.5" /></button>
          <button onClick={onClose} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="p-5 pb-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Search className="h-3 w-3" /> Détecté</div>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">{currentWord || <span className="text-slate-200">...</span>}</div>
          </div>

          <ScrollArea className="flex-1 px-4 pb-4">
            {loading ? (
                <div className="space-y-3 pt-2">
                    <Skeleton className="h-12 w-full rounded-xl bg-slate-50" />
                    <Skeleton className="h-12 w-full rounded-xl bg-slate-50" />
                </div>
            ) : suggestions.length > 0 ? (
                <div className="space-y-2 pt-2">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => replaceWord(s.word)}
                            className="w-full text-left p-4 bg-white border border-slate-100 hover:border-indigo-600 hover:ring-1 hover:ring-indigo-600/20 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98] group"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-lg text-slate-800 group-hover:text-indigo-700">{s.word}</span>
                                {s.score > 80 && <Sparkles className="h-4 w-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                currentWord && !loading && (
                    <div className="text-center py-10 text-slate-300">
                        <SpellCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">Aucune suggestion</p>
                    </div>
                )
            )}
          </ScrollArea>
        </div>
      )}
      
      {!isMinimized && (
        <div className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center text-slate-300 hover:text-indigo-500 z-50"
            onMouseDown={(e) => {
                e.preventDefault(); e.stopPropagation();
                const startX = e.clientX; const startY = e.clientY;
                const startW = size.w; const startH = size.h;
                const onResize = (ev: MouseEvent) => setSize({ w: Math.max(220, startW + (ev.clientX - startX)), h: Math.max(200, startH + (ev.clientY - startY)) });
                const stopResize = () => { window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', stopResize); };
                window.addEventListener('mousemove', onResize); window.addEventListener('mouseup', stopResize);
            }}
        >
            <Move className="h-3.5 w-3.5 rotate-45" />
        </div>
      )}
    </div>
  );
};