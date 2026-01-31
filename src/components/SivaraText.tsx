import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  BrainCircuit,
  Minimize2,
  Move,
  Search,
  Sparkles,
  SpellCheck,
  Type,
  X,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { encryptionService } from '@/lib/encryption';
import { supabase } from '@/integrations/supabase/client';

interface SivaraTextProps {
  editor: Editor | null;
  onClose: () => void;
  isOpen: boolean;
  userId: string;
}

interface Suggestion {
  word: string;
  score: number;
  type: string;
  desc?: string;
  isLearned?: boolean;
}

type UserMemory = Record<string, Record<string, number>>;

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
      if (
        i > 1 &&
        j > 1 &&
        source[i - 1] === target[j - 2] &&
        source[i - 2] === target[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[m][n];
};

const frenchSoundex = (s: string) => {
  let a = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  if (a === '') return '';
  const firstChar = a[0].toUpperCase();
  a = a
    .replace(/qu|q/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/gn/g, 'n')
    .replace(/ch/g, 'S')
    .replace(/eau|au/g, 'o')
    .replace(/ai|ei/g, 'e')
    .replace(/er$|ez$/g, 'e')
    .replace(/s$|t$/g, '');
  const mappings: { [key: string]: string } = {
    b: '1',
    p: '1',
    c: '2',
    k: '2',
    d: '3',
    t: '3',
    l: '4',
    m: '5',
    n: '5',
    r: '6',
    g: '7',
    j: '7',
    s: '8',
    z: '8',
    x: '8',
    f: '9',
    v: '9',
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
  return res.substring(0, 4);
};

type ContextForAnalysis = {
  sentenceText: string;
  wordOffsetInSentence: number;
  wordLength: number;
};

const isSentenceDelimiter = (ch: string) => ch === '.' || ch === '!' || ch === '?' || ch === '\n';

function extractSentenceContext(
  parentText: string,
  wordStartOffset: number,
  wordEndOffset: number
): ContextForAnalysis {
  const before = parentText.slice(0, wordStartOffset);
  const after = parentText.slice(wordEndOffset);

  let sentenceStart = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    if (isSentenceDelimiter(before[i])) {
      sentenceStart = i + 1;
      break;
    }
  }

  let sentenceEnd = parentText.length;
  for (let i = 0; i < after.length; i++) {
    if (isSentenceDelimiter(after[i])) {
      sentenceEnd = wordEndOffset + i + 1;
      break;
    }
  }

  const rawSentence = parentText.slice(sentenceStart, sentenceEnd);
  const sentenceText = rawSentence.trim();
  const trimmedStart = rawSentence.indexOf(sentenceText);
  const effectiveSentenceStart = sentenceStart + Math.max(0, trimmedStart);

  return {
    sentenceText,
    wordOffsetInSentence: Math.max(0, wordStartOffset - effectiveSentenceStart),
    wordLength: Math.max(0, wordEndOffset - wordStartOffset),
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

type DragMode = 'move' | 'resize' | null;

type DragState = {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
};

export const SivaraText = ({ editor, onClose, isOpen, userId }: SivaraTextProps) => {
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 120 });
  const [size, setSize] = useState({ w: 320, h: 520 });
  const [isMinimized, setIsMinimized] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState>({
    mode: null,
    startClientX: 0,
    startClientY: 0,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
  });

  const [currentWord, setCurrentWord] = useState('');
  const [currentRange, setCurrentRange] = useState<{ from: number; to: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const [memory, setMemory] = useState<UserMemory>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const memoryRef = useRef<UserMemory>({});

  const panelRef = useRef<HTMLDivElement>(null);

  // Placement par défaut + adaptation mobile
  useEffect(() => {
    if (!isOpen) return;

    const isMobile = window.innerWidth < 640;

    if (isMobile) {
      const w = clamp(window.innerWidth - 24, 260, 420);
      const h = clamp(Math.round(window.innerHeight * 0.55), 260, Math.round(window.innerHeight * 0.75));
      setSize({ w, h });
      setPosition({
        x: Math.round((window.innerWidth - w) / 2),
        y: Math.round(clamp(window.innerHeight - h - 90, 12, window.innerHeight - h - 12)),
      });
      return;
    }

    // Desktop : si le panneau serait hors écran, on le recale
    setPosition((p) => ({
      x: clamp(p.x, 8, Math.max(8, window.innerWidth - size.w - 8)),
      y: clamp(p.y, 8, Math.max(8, window.innerHeight - size.h - 8)),
    }));
  }, [isOpen]);

  // Recalage si resize fenêtre
  useEffect(() => {
    if (!isOpen) return;

    const onResize = () => {
      setPosition((p) => ({
        x: clamp(p.x, 8, Math.max(8, window.innerWidth - (isMinimized ? 240 : size.w) - 8)),
        y: clamp(p.y, 8, Math.max(8, window.innerHeight - (isMinimized ? 64 : size.h) - 8)),
      }));
      setSize((s) => ({
        w: clamp(s.w, 260, Math.max(260, window.innerWidth - 16)),
        h: clamp(s.h, 260, Math.max(260, window.innerHeight - 16)),
      }));
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, isMinimized, size.w, size.h]);

  // Drag/Resize via Pointer Events (PC + mobile)
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const { mode, startClientX, startClientY, startX, startY, startW, startH } = dragRef.current;
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;

      if (mode === 'move') {
        const currentW = isMinimized ? 240 : size.w;
        const currentH = isMinimized ? 64 : size.h;

        const nextX = clamp(startX + dx, 8, Math.max(8, window.innerWidth - currentW - 8));
        const nextY = clamp(startY + dy, 8, Math.max(8, window.innerHeight - currentH - 8));
        setPosition({ x: nextX, y: nextY });
      }

      if (mode === 'resize') {
        const minW = 260;
        const minH = 260;
        const maxW = Math.max(minW, window.innerWidth - startX - 8);
        const maxH = Math.max(minH, window.innerHeight - startY - 8);

        const nextW = clamp(startW + dx, minW, maxW);
        const nextH = clamp(startH + dy, minH, maxH);
        setSize({ w: nextW, h: nextH });
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
      dragRef.current.mode = null;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDragging, isMinimized, size.w, size.h]);

  const startMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragRef.current = {
      mode: 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: position.x,
      startY: position.y,
      startW: size.w,
      startH: size.h,
    };
    setIsDragging(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    e.preventDefault();
  };

  const startResize = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    dragRef.current = {
      mode: 'resize',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: position.x,
      startY: position.y,
      startW: size.w,
      startH: size.h,
    };
    setIsDragging(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    e.preventDefault();
    e.stopPropagation();
  };

  // Mémoire
  useEffect(() => {
    const loadMemory = async () => {
      if (!userId) return;

      const localData = localStorage.getItem(`sivara-text-memory-${userId}`);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setMemory(parsed);
          memoryRef.current = parsed;
        } catch {
          // ignore
        }
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('text_preferences')
          .eq('id', userId)
          .single();

        if (data?.text_preferences) {
          try {
            const encryptedObj = JSON.parse(data.text_preferences);
            const decryptedJson = await encryptionService.decrypt(encryptedObj.content, encryptedObj.iv);
            const cloudMemory = JSON.parse(decryptedJson);

            const merged = { ...memoryRef.current, ...cloudMemory };
            setMemory(merged);
            memoryRef.current = merged;
            localStorage.setItem(`sivara-text-memory-${userId}`, JSON.stringify(merged));
          } catch (cryptoError) {
            console.warn('Impossible de déchiffrer la mémoire cloud (nouvelle session ?)', cryptoError);
          }
        }
      } catch (e) {
        console.error('Erreur chargement mémoire', e);
      }
    };

    if (isOpen) loadMemory();
  }, [userId, isOpen]);

  const saveMemoryToCloud = async (newMemory: UserMemory) => {
    setIsSyncing(true);
    try {
      const jsonString = JSON.stringify(newMemory);
      const { encrypted, iv } = await encryptionService.encrypt(jsonString);
      const storagePayload = JSON.stringify({ content: encrypted, iv });

      await supabase.from('profiles').update({ text_preferences: storagePayload }).eq('id', userId);
      localStorage.setItem(`sivara-text-memory-${userId}`, jsonString);
    } catch (e) {
      console.error('Erreur sauvegarde mémoire', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const computeScore = (input: string, candidate: string): { score: number; isLearned: boolean } => {
    const inputLower = input.toLowerCase();
    const candLower = candidate.toLowerCase();

    const distance = calculateDistance(inputLower, candLower);
    const maxLength = Math.max(inputLower.length, candLower.length);
    let score = (1 - distance / maxLength) * 100;

    const soundIn = frenchSoundex(inputLower);
    const soundCand = frenchSoundex(candLower);
    if (soundIn && soundCand && soundIn === soundCand) score += 25;

    let isLearned = false;
    if (memory[inputLower] && memory[inputLower][candLower]) {
      const frequency = memory[inputLower][candLower];
      const learningBonus = Math.min(60, Math.log(frequency + 1) * 30);
      score += learningBonus;
      isLearned = true;
    }

    if (candidate === candidate.toUpperCase() && input !== input.toUpperCase()) score -= 50;

    return { score: Math.min(Math.round(score), 100), isLearned };
  };

  const analyzeWord = async (text: string, context?: ContextForAnalysis) => {
    if (!text || text === currentWord) return;
    setCurrentWord(text);
    setLoading(true);
    setSuggestions([]);

    try {
      const sentenceText = context?.sentenceText || text;

      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `text=${encodeURIComponent(sentenceText)}&language=fr&enabledOnly=false`,
      });

      const data = await response.json();
      const candidates = new Set<string>();

      const wordStart = context?.wordOffsetInSentence ?? 0;
      const wordEnd = wordStart + (context?.wordLength ?? text.length);

      if (data.matches) {
        data.matches.forEach((match: any) => {
          const matchStart = match.offset;
          const matchEnd = match.offset + match.length;
          const overlaps = matchStart < wordEnd && matchEnd > wordStart;
          if (!overlaps) return;

          match.replacements.slice(0, 8).forEach((repl: any) => {
            if (!repl.value.includes(' ')) candidates.add(repl.value);
          });
        });
      }

      const results: Suggestion[] = [];
      candidates.forEach((cand) => {
        if (cand.toLowerCase() !== text.toLowerCase()) {
          const { score, isLearned } = computeScore(text, cand);
          if (score > 30) results.push({ word: cand, score, type: 'correction', isLearned });
        }
      });

      setSuggestions(results.sort((a, b) => b.score - a.score).slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const replaceWord = (selectedWord: string) => {
    if (!editor || !currentRange) return;

    editor.chain().focus().deleteRange(currentRange).insertContent(selectedWord).run();
    setCurrentWord(selectedWord);

    const mistake = currentWord.toLowerCase();
    const correction = selectedWord.toLowerCase();

    if (mistake !== correction) {
      const newMemory = { ...memory };
      if (!newMemory[mistake]) newMemory[mistake] = {};

      const currentCount = newMemory[mistake][correction] || 0;
      newMemory[mistake][correction] = currentCount + 1;

      setMemory(newMemory);
      memoryRef.current = newMemory;
      saveMemoryToCloud(newMemory);
    }
  };

  // Polling curseur
  useEffect(() => {
    if (!editor || !isOpen) return;

    const interval = setInterval(() => {
      const { from, to } = editor.state.selection;
      let text = '';
      let range = { from, to };
      let context: ContextForAnalysis | undefined;

      if (from !== to) {
        text = editor.state.doc.textBetween(from, to, ' ');
      } else {
        const $pos = editor.state.selection.$from;
        const parentText = $pos.parent.textBetween(0, $pos.parent.content.size, ' ');

        const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, ' ');
        const textAfter = $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size, ' ');
        const matchBefore = textBefore.match(/[\wÀ-ÿ-]+$/);
        const matchAfter = textAfter.match(/^[\wÀ-ÿ-]+/);

        if (matchBefore || matchAfter) {
          const partBefore = matchBefore ? matchBefore[0] : '';
          const partAfter = matchAfter ? matchAfter[0] : '';
          text = partBefore + partAfter;
          range = { from: $pos.pos - partBefore.length, to: $pos.pos + partAfter.length };

          const wordStartOffset = $pos.parentOffset - partBefore.length;
          const wordEndOffset = $pos.parentOffset + partAfter.length;
          context = extractSentenceContext(parentText, wordStartOffset, wordEndOffset);
        }
      }

      const cleanText = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      if (cleanText && cleanText.length > 1 && cleanText !== currentWord) {
        setCurrentWord(cleanText);
        setCurrentRange(range);
        analyzeWord(cleanText, context);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [editor, isOpen, currentWord, memory]);

  if (!isOpen) return null;

  const panelWidth = isMinimized ? 240 : size.w;
  const panelHeight = isMinimized ? 64 : size.h;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: panelWidth,
        height: panelHeight,
        zIndex: 50,
      }}
      className={
        "rounded-2xl overflow-hidden border border-white/20 bg-white/80 backdrop-blur-2xl shadow-2xl ring-1 ring-black/5 font-sans select-none animate-in fade-in zoom-in-95 duration-200"
      }
    >
      {/* HEADER */}
      <div
        onPointerDown={startMove}
        className="relative h-16 px-4 flex items-center justify-between cursor-grab active:cursor-grabbing touch-none"
        style={{
          backgroundImage: `url(/sivara-text-header.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-700/80 to-sky-600/70" />
        <div className="absolute inset-0 bg-black/10" />

        <div className="relative flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-white/15 border border-white/20 backdrop-blur flex items-center justify-center shadow-sm">
            <Type className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">Sivara Text</span>
              {isSyncing && <BrainCircuit className="h-3.5 w-3.5 text-white/80 animate-pulse" />}
            </div>
            <span className="text-[10px] text-white/70">Correcteur intelligent</span>
          </div>
        </div>

        <div className="relative flex items-center gap-1">
          <button
            onClick={() => setIsMinimized((v) => !v)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 transition"
            aria-label="Réduire"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 transition"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="h-3 w-3" /> Analyse
              </span>
              <span className="text-[10px] text-slate-400">Auto</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 break-words leading-tight">
              {currentWord || <span className="text-slate-300 italic font-medium">...</span>}
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 pb-4 bg-gradient-to-b from-white to-slate-50/40">
            {loading && suggestions.length === 0 ? (
              <div className="space-y-3 pt-2">
                <Skeleton className="h-12 w-full rounded-xl bg-slate-200/50" />
                <Skeleton className="h-12 w-full rounded-xl bg-slate-100/50" />
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-2 pt-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => replaceWord(s.word)}
                    className="w-full group relative flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-200 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-bold text-slate-900 text-base">{s.word}</span>
                      <div className="flex items-center gap-2">
                        {s.isLearned && (
                          <span className="text-[10px] text-blue-700 font-semibold flex items-center gap-1">
                            <BrainCircuit className="h-3 w-3" /> Appris
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">Score {s.score}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {s.score > 90 && <Sparkles className="h-4 w-4 text-amber-400 fill-current" />}
                      <div className="h-9 w-9 rounded-2xl bg-blue-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <SpellCheck className="h-4 w-4" />
                      </div>
                    </div>

                    <div
                      className={`absolute bottom-0 left-0 h-0.5 rounded-full transition-all ${
                        s.isLearned ? 'bg-blue-500' : 'bg-blue-500/20'
                      }`}
                      style={{ width: `${s.score}%` }}
                    />
                  </button>
                ))}
              </div>
            ) : (
              currentWord && !loading && (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-xs">Aucune suggestion.</p>
                </div>
              )
            )}
          </ScrollArea>

          {/* Resize handle (desktop + mobile) */}
          <div
            onPointerDown={startResize}
            className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-end justify-end p-2 text-slate-300 hover:text-slate-700 z-50 touch-none"
            aria-label="Redimensionner"
          >
            <Move className="h-4 w-4 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
};