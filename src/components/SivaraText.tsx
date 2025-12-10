import { useState, useEffect, useRef, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Type, X, Move, Maximize2, Minimize2, 
  Search, Sparkles, SpellCheck, BrainCircuit, Save
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { encryptionService } from '@/lib/encryption';
import { supabase } from '@/integrations/supabase/client';

interface SivaraTextProps {
  editor: Editor | null;
  onClose: () => void;
  isOpen: boolean;
  userId: string; // Pour lier l'apprentissage au compte
}

interface Suggestion {
  word: string;
  score: number;
  type: string;
  desc?: string;
  isLearned?: boolean; // Marqueur visuel si c'est une habitude
}

// Type pour la mémoire utilisateur : { "jene": { "jeune": 5, "gêne": 1 } }
type UserMemory = Record<string, Record<string, number>>;

// --- MATHS : Damerau-Levenshtein (Distance) ---
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

// --- MATHS : Phonétique FR ---
const frenchSoundex = (s: string) => {
    let a = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, '');
    if (a === "") return "";
    const firstChar = a[0].toUpperCase();
    a = a.replace(/qu|q/g, 'k').replace(/ph/g, 'f').replace(/gn/g, 'n').replace(/ch/g, 'S')
         .replace(/eau|au/g, 'o').replace(/ai|ei/g, 'e').replace(/er$|ez$/g, 'e').replace(/s$|t$/g, '');
    const mappings: {[key: string]: string} = {
        'b': '1', 'p': '1', 'c': '2', 'k': '2', 'd': '3', 't': '3', 'l': '4',
        'm': '5', 'n': '5', 'r': '6', 'g': '7', 'j': '7', 's': '8', 'z': '8', 'x': '8', 'f': '9', 'v': '9'
    };
    let res = firstChar;
    let prevCode = mappings[firstChar.toLowerCase()] || '';
    for (let i = 1; i < a.length; i++) {
        const char = a[i]; const code = mappings[char];
        if (code && code !== prevCode) { res += code; prevCode = code; }
    }
    return res.substring(0, 4);
};

export const SivaraText = ({ editor, onClose, isOpen, userId }: SivaraTextProps) => {
  // --- STATE UI ---
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 120 });
  const [size, setSize] = useState({ w: 300, h: 480 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  // --- STATE LOGIC ---
  const [currentWord, setCurrentWord] = useState('');
  const [currentRange, setCurrentRange] = useState<{ from: number, to: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  
  // --- STATE MÉMOIRE (AI) ---
  const [memory, setMemory] = useState<UserMemory>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const memoryRef = useRef<UserMemory>({}); // Ref pour accès instantané sans re-render loops

  const panelRef = useRef<HTMLDivElement>(null);

  // 1. CHARGEMENT DE LA MÉMOIRE (Une fois au montage)
  useEffect(() => {
    const loadMemory = async () => {
        if (!userId) return;
        
        // 1. Essayer le LocalStorage d'abord (Rapide)
        const localData = localStorage.getItem(`sivara-text-memory-${userId}`);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                setMemory(parsed);
                memoryRef.current = parsed;
            } catch (e) {}
        }

        // 2. Fetcher la version Cloud (Autorité)
        try {
            const { data } = await supabase.from('profiles').select('text_preferences').eq('id', userId).single();
            if (data?.text_preferences) {
                // Déchiffrement (E2EE)
                // Note: On suppose que encryptionService est déjà init dans le parent (DocEditor)
                // Mais par sécurité on pourrait le re-init si on avait le sel stocké.
                // Ici on va utiliser le trick simple : on tente de déchiffrer avec la session courante.
                try {
                    // Pour simplifier ici, on suppose que text_preferences contient : { iv: '...', content: '...' } stringifié
                    const encryptedObj = JSON.parse(data.text_preferences);
                    const decryptedJson = await encryptionService.decrypt(encryptedObj.content, encryptedObj.iv);
                    const cloudMemory = JSON.parse(decryptedJson);
                    
                    // Merge intelligent (Cloud gagne si conflit, ou addition)
                    const merged = { ...memoryRef.current, ...cloudMemory };
                    setMemory(merged);
                    memoryRef.current = merged;
                    
                    // Update local cache
                    localStorage.setItem(`sivara-text-memory-${userId}`, JSON.stringify(merged));
                } catch (cryptoError) {
                    console.warn("Impossible de déchiffrer la mémoire cloud (nouvelle session ?)", cryptoError);
                }
            }
        } catch (e) {
            console.error("Erreur chargement mémoire", e);
        }
    };
    if (isOpen) loadMemory();
  }, [userId, isOpen]);

  // 2. SAUVEGARDE INTELLIGENTE (Debounce)
  const saveMemoryToCloud = async (newMemory: UserMemory) => {
      setIsSyncing(true);
      try {
          const jsonString = JSON.stringify(newMemory);
          const { encrypted, iv } = await encryptionService.encrypt(jsonString);
          
          // Stockage format JSON stringifié pour pouvoir parser l'objet chiffré
          const storagePayload = JSON.stringify({ content: encrypted, iv });
          
          await supabase.from('profiles').update({ text_preferences: storagePayload }).eq('id', userId);
          localStorage.setItem(`sivara-text-memory-${userId}`, jsonString);
      } catch (e) {
          console.error("Erreur sauvegarde mémoire", e);
      } finally {
          setIsSyncing(false);
      }
  };

  // --- DRAG HANDLERS ---
  const startDrag = (e: React.MouseEvent) => {
    if (isMinimized) return;
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => { if (isDragging) setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }); };
    const handleUp = () => setIsDragging(false);
    if (isDragging) { window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp); }
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isDragging, dragOffset]);

  // --- MOTEUR DE PERTINENCE (HYBRIDE MATHS + IA PERSO) ---
  const computeScore = (input: string, candidate: string): { score: number, isLearned: boolean } => {
      const inputLower = input.toLowerCase();
      const candLower = candidate.toLowerCase();
      
      // 1. Score de Base (Distance Orthographique)
      const distance = calculateDistance(inputLower, candLower);
      const maxLength = Math.max(inputLower.length, candLower.length);
      let score = (1 - distance / maxLength) * 100;

      // 2. Bonus Phonétique
      const soundIn = frenchSoundex(inputLower);
      const soundCand = frenchSoundex(candLower);
      if (soundIn && soundCand && soundIn === soundCand) score += 25;

      // 3. IA PERSONNELLE (Le "Hardcore Learning")
      // On regarde si l'utilisateur a déjà corrigé "input" par "candidate"
      let isLearned = false;
      if (memory[inputLower] && memory[inputLower][candLower]) {
          const frequency = memory[inputLower][candLower];
          // Formule logarithmique : +20pts au 1er choix, +30 au 2e... plafonne vers +60
          // Cela permet d'apprendre vite mais de ne pas casser le reste
          const learningBonus = Math.min(60, Math.log(frequency + 1) * 30);
          score += learningBonus;
          isLearned = true;
      }

      // Pénalités structurelles
      if (candidate === candidate.toUpperCase() && input !== input.toUpperCase()) score -= 50; // Acronymes
      
      return { score: Math.min(Math.round(score), 100), isLearned };
  };

  const analyzeWord = async (text: string) => {
    if (!text || text === currentWord) return;
    setCurrentWord(text);
    setLoading(true);
    setSuggestions([]);

    try {
      // API LanguageTool
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `text=${encodeURIComponent(text)}&language=fr&enabledOnly=false`
      });

      const data = await response.json();
      const candidates = new Set<string>();

      // Extraction API
      if (data.matches) {
          data.matches.forEach((match: any) => {
              match.replacements.slice(0, 5).forEach((repl: any) => {
                  if (!repl.value.includes(' ')) candidates.add(repl.value);
              });
          });
      }

      // Injection de la mémoire locale (si l'API rate un mot que l'user utilise souvent)
      if (memory[text.toLowerCase()]) {
          Object.keys(memory[text.toLowerCase()]).forEach(learnedWord => {
              candidates.add(learnedWord);
          });
      }

      // Fallback Wiktionary si vide
      if (candidates.size < 2) {
         try {
             const wikiRes = await fetch(`https://fr.wiktionary.org/w/api.php?action=opensearch&search=${text}&limit=5&format=json&origin=*`);
             const wikiData = await wikiRes.json();
             if (wikiData[1]) wikiData[1].forEach((w: string) => candidates.add(w));
         } catch (e) {}
      }

      // Scoring & Tri
      const results: Suggestion[] = [];
      candidates.forEach(cand => {
          if (cand.toLowerCase() !== text.toLowerCase()) {
              const { score, isLearned } = computeScore(text, cand);
              if (score > 30) { // Seuil minimal de pertinence
                  results.push({ word: cand, score, type: 'correction', isLearned });
              }
          }
      });

      setSuggestions(results.sort((a, b) => b.score - a.score).slice(0, 5));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- REMPLACEMENT & APPRENTISSAGE ---
  const replaceWord = (selectedWord: string) => {
    if (!editor || !currentRange) return;
    
    // 1. Action UI
    editor.chain().focus().deleteRange(currentRange).insertContent(selectedWord).run();
    setCurrentWord(selectedWord); 

    // 2. APPRENTISSAGE (Mise à jour du cerveau)
    // On apprend la paire : (mot_mal_ecrit -> mot_choisi)
    // ATTENTION : On apprend par rapport à l'input ORIGINAL (avant remplacement)
    // currentWord contient déjà le nouveau mot ici, donc il faut utiliser l'ancien état ou le passer en param.
    // Hack : On sait que currentWord (state) n'est pas encore mis à jour dans cette closure immédiate ?
    // Non, React state update est async. Donc currentWord est encore l'ancien mot ("jene").
    const mistake = currentWord.toLowerCase();
    const correction = selectedWord.toLowerCase();

    if (mistake !== correction) {
        const newMemory = { ...memory };
        if (!newMemory[mistake]) newMemory[mistake] = {};
        
        const currentCount = newMemory[mistake][correction] || 0;
        newMemory[mistake][correction] = currentCount + 1;

        setMemory(newMemory);
        memoryRef.current = newMemory;
        
        // Sauvegarde Cloud (Async & Silent)
        saveMemoryToCloud(newMemory);
    }
  };

  // Polling curseur
  useEffect(() => {
      if (!editor || !isOpen) return;
      const interval = setInterval(() => {
          const { from, to } = editor.state.selection;
          let text = "";
          let range = { from, to };

          if (from !== to) {
              text = editor.state.doc.textBetween(from, to, ' ');
          } else {
              const $pos = editor.state.selection.$from;
              const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, ' ');
              const textAfter = $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size, ' ');
              const matchBefore = textBefore.match(/[\wÀ-ÿ-]+$/);
              const matchAfter = textAfter.match(/^[\wÀ-ÿ-]+/);

              if (matchBefore || matchAfter) {
                  const partBefore = matchBefore ? matchBefore[0] : '';
                  const partAfter = matchAfter ? matchAfter[0] : '';
                  text = partBefore + partAfter;
                  range = { from: $pos.pos - partBefore.length, to: $pos.pos + partAfter.length };
              }
          }

          const cleanText = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
          if (cleanText && cleanText.length > 1 && cleanText !== currentWord) {
              setCurrentWord(cleanText);
              setCurrentRange(range);
              analyzeWord(cleanText);
          }
      }, 600);
      return () => clearInterval(interval);
  }, [editor, isOpen, currentWord]);

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      style={{ 
        position: 'fixed', left: position.x, top: position.y,
        width: isMinimized ? '200px' : `${size.w}px`,
        height: isMinimized ? 'auto' : `${size.h}px`,
        zIndex: 50, transition: isDragging ? 'none' : 'width 0.2s, height 0.2s'
      }}
      className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 ring-1 ring-black/5 flex flex-col overflow-hidden font-sans select-none"
    >
      <div onMouseDown={startDrag} className="h-12 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between px-4 cursor-move">
        <div className="flex items-center gap-2.5">
          <div className="bg-black p-1.5 rounded-lg shadow-sm"><Type className="h-4 w-4 text-white" /></div>
          <span className="text-sm font-bold text-slate-800 tracking-tight">Sivara Text</span>
        </div>
        <div className="flex items-center gap-1">
          {isSyncing && <BrainCircuit className="h-3 w-3 text-blue-500 animate-pulse mr-2" />}
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400"><Minimize2 className="h-3.5 w-3.5" /></button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="p-5 pb-2">
            <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Search className="h-3 w-3" /> Analyse</span></div>
            <div className="relative"><div className="text-2xl font-bold text-slate-800 break-words leading-tight">{currentWord || <span className="text-slate-300 italic font-medium">...</span>}</div></div>
          </div>

          <ScrollArea className="flex-1 px-4 pb-4 bg-slate-50/30">
            {loading && suggestions.length === 0 ? (
                <div className="space-y-3 pt-2"><Skeleton className="h-10 w-full rounded-xl bg-slate-200/50" /><Skeleton className="h-10 w-full rounded-xl bg-slate-100/50" /></div>
            ) : suggestions.length > 0 ? (
                <div className="space-y-2 pt-2">
                    {suggestions.map((s, i) => (
                        <button key={i} onClick={() => replaceWord(s.word)} className="w-full group relative flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-300 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]">
                            <div className="flex flex-col items-start">
                                <span className="font-bold text-slate-800 text-base">{s.word}</span>
                                {s.isLearned && <span className="text-[9px] text-blue-600 font-medium flex items-center gap-1"><BrainCircuit className="h-2 w-2" /> Appris</span>}
                            </div>
                            <div className="flex items-center gap-3">
                                {s.score > 90 && <Sparkles className="h-3 w-3 text-amber-400 fill-current" />}
                                <div className="h-8 w-8 rounded-lg bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0"><SpellCheck className="h-4 w-4" /></div>
                            </div>
                            <div className={`absolute bottom-0 left-0 h-0.5 rounded-full transition-all ${s.isLearned ? 'bg-blue-500' : 'bg-green-500/20'}`} style={{ width: `${s.score}%` }}></div>
                        </button>
                    ))}
                </div>
            ) : (
                currentWord && !loading && <div className="text-center py-8 text-slate-400"><p className="text-xs">Aucune suggestion.</p></div>
            )}
          </ScrollArea>
        </div>
      )}
      
      {!isMinimized && (
        <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center text-gray-300 hover:text-black z-50" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); const startX = e.clientX; const startY = e.clientY; const startW = size.w; const startH = size.h; const onResize = (ev: MouseEvent) => setSize({ w: Math.max(200, startW + (ev.clientX - startX)), h: Math.max(200, startH + (ev.clientY - startY)) }); const stopResize = () => { window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', stopResize); }; window.addEventListener('mousemove', onResize); window.addEventListener('mouseup', stopResize); }}><Move className="h-3 w-3 rotate-45" /></div>
      )}
    </div>
  );
};