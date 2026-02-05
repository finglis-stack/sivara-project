import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { showError, showSuccess } from '@/utils/toast';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  MousePointer2,
  Play,
  Plus,
  Presentation,
  Save,
  SquareArrowOutUpRight,
  Type,
  Upload,
  Maximize,
  Minimize,
} from 'lucide-react';

type SlideBackground =
  | { type: 'solid'; color: string }
  | { type: 'image'; url: string }
  | { type: 'youtube'; videoId: string };

type PointElementBase = {
  id: string;
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
};

type PointTextElement = PointElementBase & {
  type: 'text';
  text: string;
  style: {
    fontSize: number;
    fontWeight: number;
    color: string;
    align: 'left' | 'center' | 'right';
    fontFamily?: string;
  };
};

type PointImageElement = PointElementBase & {
  type: 'image';
  src: string;
  fit: 'contain' | 'cover';
  radius: number; // px
};

type PointButtonElement = PointElementBase & {
  type: 'button';
  label: string;
  targetSlideId: string | null;
  style: {
    bg: string;
    fg: string;
    radius: number;
  };
};

type PointElement = PointTextElement | PointImageElement | PointButtonElement;

type PointSlide = {
  id: string;
  name: string;
  background: SlideBackground;
  elements: PointElement[];
};

type PointDocV1 = {
  version: 1;
  slides: PointSlide[];
};

type DbDocument = {
  id: string;
  title: string;
  content: string;
  encryption_iv: string;
  owner_id: string;
  updated_at: string;
  visibility: 'private' | 'limited' | 'public';
  public_permission: 'read' | 'write';
  type: string | null;
};

type Permission = 'read' | 'write';

type SelectedElement = {
  slideId: string;
  elementId: string;
} | null;

const FONT_FAMILIES = [
  { name: 'Inter (par défaut)', value: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
  { name: 'Roboto', value: 'Roboto, system-ui, -apple-system, Segoe UI, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, system-ui, -apple-system, Segoe UI, sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", system-ui, -apple-system, Segoe UI, sans-serif' },
  { name: 'Lato', value: 'Lato, system-ui, -apple-system, Segoe UI, sans-serif' },
  { name: 'Serif', value: 'Georgia, Times, serif' },
  { name: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
];

const clonePoint = (p: PointDocV1): PointDocV1 => {
  // structuredClone est supporté dans les navigateurs modernes
  // et garde mieux les types que JSON stringify.
  try {
    return structuredClone(p) as PointDocV1;
  } catch {
    return JSON.parse(JSON.stringify(p)) as PointDocV1;
  }
};

const extractYoutubeId = (input: string): string | null => {
  const url = input.trim();
  if (!url) return null;

  // youtu.be/ID
  let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (match?.[1]) return match[1];

  // youtube.com/watch?v=ID
  match = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (match?.[1]) return match[1];

  // youtube.com/embed/ID
  match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (match?.[1]) return match[1];

  return null;
};

const safeJsonParse = (value: string): PointDocV1 | null => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.slides)) return null;

    // Normalisation (compat + defaults)
    const normalized: PointDocV1 = {
      version: 1,
      slides: parsed.slides.map((s: any, i: number) => {
        let bg: SlideBackground = { type: 'solid', color: '#0B1220' };
        if (s?.background?.type === 'solid') bg = { type: 'solid', color: s.background.color || '#0B1220' };
        else if (s?.background?.type === 'image') bg = { type: 'image', url: s.background.url || '' };
        else if (s?.background?.type === 'youtube') bg = { type: 'youtube', videoId: s.background.videoId || '' };

        const elements: PointElement[] = Array.isArray(s?.elements)
          ? s.elements.map((el: any) => {
              if (el?.type === 'text') {
                return {
                  ...el,
                  style: {
                    fontSize: el.style?.fontSize ?? 24,
                    fontWeight: el.style?.fontWeight ?? 400,
                    color: el.style?.color ?? '#FFFFFF',
                    align: el.style?.align ?? 'left',
                    fontFamily:
                      el.style?.fontFamily || 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                  },
                } as PointTextElement;
              }
              return el as PointElement;
            })
          : [];

        return {
          id: s?.id || crypto.randomUUID(),
          name: s?.name || `Slide ${i + 1}`,
          background: bg,
          elements,
        } as PointSlide;
      }),
    };

    return normalized;
  } catch {
    return null;
  }
};

export default function PointEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [docRow, setDocRow] = useState<DbDocument | null>(null);
  const [permission, setPermission] = useState<Permission>('read');
  const [isOwner, setIsOwner] = useState(false);
  const [title, setTitle] = useState('');
  const [point, setPoint] = useState<PointDocV1 | null>(null);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedElement>(null);

  const [mode, setMode] = useState<'edit' | 'present'>('edit');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // IMPORTANT: en présentation, on met en plein écran UNIQUEMENT la scène (pas le menu)
  const presentRef = useRef<HTMLDivElement | null>(null);

  const saveTimeoutRef = useRef<number | null>(null);
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  // Image dialog
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isImageUploading, setIsImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isEditable = useMemo(() => permission === 'write' && mode === 'edit', [permission, mode]);

  // Historique (undo/redo)
  const historyRef = useRef<PointDocV1[]>([]);
  const historyIndexRef = useRef(0);

  // Clipboard interne (copier/coller)
  const clipboardRef = useRef<PointElement | null>(null);

  const activeSlide = useMemo(() => {
    if (!point || !activeSlideId) return null;
    return point.slides.find((s) => s.id === activeSlideId) || null;
  }, [point, activeSlideId]);

  const selectedElement = useMemo(() => {
    if (!selected || !point) return null;
    const slide = point.slides.find((s) => s.id === selected.slideId);
    if (!slide) return null;
    return slide.elements.find((e) => e.id === selected.elementId) || null;
  }, [selected, point]);

  const scheduleSave = () => {
    if (permission !== 'write') return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      void saveNow();
    }, 500);
  };

  const pushHistory = (next: PointDocV1) => {
    // Supprimer tout "future" après l'index actuel
    const base = historyRef.current.slice(0, historyIndexRef.current + 1);
    base.push(clonePoint(next));

    // Limite (simple)
    const MAX = 60;
    while (base.length > MAX) base.shift();

    historyRef.current = base;
    historyIndexRef.current = base.length - 1;
  };

  const undo = () => {
    if (!historyRef.current.length) return;
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const prev = clonePoint(historyRef.current[historyIndexRef.current]);
    setPoint(prev);
    setSelected(null);
    scheduleSave();
  };

  const redo = () => {
    if (!historyRef.current.length) return;
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const next = clonePoint(historyRef.current[historyIndexRef.current]);
    setPoint(next);
    setSelected(null);
    scheduleSave();
  };

  const commitPoint = (next: PointDocV1, opts?: { pushHistory?: boolean }) => {
    setPoint(next);
    if (opts?.pushHistory !== false) pushHistory(next);
    scheduleSave();
  };

  const copyElement = (el: PointElement) => {
    const payload = clonePoint({ version: 1, slides: [{ id: 'x', name: 'x', background: { type: 'solid', color: '#000' }, elements: [el] }] } as any)
      .slides[0].elements[0] as PointElement;
    clipboardRef.current = payload;
    try {
      localStorage.setItem('point-clipboard-v1', JSON.stringify(payload));
    } catch {}
    showSuccess('Copié');
  };

  const copySelected = () => {
    if (!selectedElement) return;
    copyElement(selectedElement);
  };

  const pasteClipboard = () => {
    if (!point || !activeSlideId) return;
    const clip = clipboardRef.current;
    if (!clip) return;

    const newEl: PointElement = {
      ...(clonePoint({ version: 1, slides: [{ id: 'x', name: 'x', background: { type: 'solid', color: '#000' }, elements: [clip] }] } as any)
        .slides[0].elements[0] as any),
      id: crypto.randomUUID(),
      x: Math.min(0.97, Math.max(0, (clip.x ?? 0.1) + 0.03)),
      y: Math.min(0.97, Math.max(0, (clip.y ?? 0.1) + 0.03)),
    };

    const slides = point.slides.map((s) => (s.id === activeSlideId ? { ...s, elements: [...s.elements, newEl] } : s));
    const next = { ...point, slides };
    commitPoint(next);
    setSelected({ slideId: activeSlideId, elementId: newEl.id });
  };

  const cutSelected = () => {
    if (!selectedElement || !activeSlideId) return;
    copySelected();
    deleteElement(activeSlideId, selectedElement.id);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('point-clipboard-v1');
      if (saved) clipboardRef.current = JSON.parse(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isFormField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          (target as any).isContentEditable);

      const mod = e.ctrlKey || e.metaKey;

      if (isEditable && selectedElement && (e.key === 'Delete' || e.key === 'Backspace') && !isFormField) {
        e.preventDefault();
        deleteElement(activeSlide.id, selectedElement.id);
        return;
      }

      if (mod && !isFormField) {
        const key = e.key.toLowerCase();
        if (key === 'c') {
          e.preventDefault();
          copySelected();
        } else if (key === 'x') {
          e.preventDefault();
          if (isEditable) cutSelected();
        } else if (key === 'v') {
          e.preventDefault();
          if (isEditable) pasteClipboard();
        } else if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditable, selectedElement, activeSlide, activeSlideId, point]);

  const saveNow = async () => {
    if (!id || !point || !docRow) return;
    if (permission !== 'write') return;

    try {
      const effectiveKey = getEffectiveKey(docRow.owner_id);
      await encryptionService.initialize(effectiveKey);

      const { encrypted: encTitle, iv } = await encryptionService.encrypt(titleRef.current || 'Point');
      const { encrypted: encContent } = await encryptionService.encrypt(JSON.stringify(point), iv);

      const { error } = await supabase
        .from('documents')
        .update({
          title: encTitle,
          content: encContent,
          encryption_iv: iv,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    } catch (e) {
      console.error(e);
      showError('Erreur lors de la sauvegarde');
    }
  };

  const getEffectiveKey = (ownerId: string) => {
    const hash = window.location.hash || '';
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const shareKey = params.get('key');
    return shareKey && shareKey !== 'share' ? shareKey : ownerId;
  };

  const computePermission = async (doc: DbDocument): Promise<Permission> => {
    // Owner can write
    if (user?.id && user.id === doc.owner_id) return 'write';

    // Otherwise, rely on visibility/document_access just like Docs
    // We keep it minimal: public write -> write, public read -> read.
    // Limited/private are handled by RLS (if user can fetch doc).
    if (doc.visibility === 'public' && doc.public_permission === 'write') return 'write';
    return 'read';
  };

  const fetchDoc = async () => {
    if (!id) return;
    setIsLoading(true);

    try {
      const { data: doc, error } = await supabase.from('documents').select('*').eq('id', id).single();
      if (error || !doc) throw error || new Error('Point introuvable');
      if (doc.type !== 'point') throw new Error('Ce document n\'est pas un Point');

      const docTyped = doc as DbDocument;
      setDocRow(docTyped);
      setIsOwner(Boolean(user?.id && user.id === docTyped.owner_id));
      setPermission(await computePermission(docTyped));

      const effectiveKey = getEffectiveKey(docTyped.owner_id);
      await encryptionService.initialize(effectiveKey);

      let decryptedTitle = 'Point';
      let decryptedContent = '';

      try {
        decryptedTitle = await encryptionService.decrypt(docTyped.title, docTyped.encryption_iv);
        decryptedContent = await encryptionService.decrypt(docTyped.content, docTyped.encryption_iv);
      } catch {
        // fallback owner key
        await encryptionService.initialize(docTyped.owner_id);
        decryptedTitle = await encryptionService.decrypt(docTyped.title, docTyped.encryption_iv);
        decryptedContent = await encryptionService.decrypt(docTyped.content, docTyped.encryption_iv);
      }

      const parsed = safeJsonParse(decryptedContent);
      if (!parsed) throw new Error('Contenu Point invalide');

      setTitle(decryptedTitle);
      setPoint(parsed);
      setActiveSlideId(parsed.slides[0]?.id || null);

      // Init history
      historyRef.current = [clonePoint(parsed)];
      historyIndexRef.current = 0;
    } catch (e: any) {
      console.error(e);
      showError(e.message || 'Point inaccessible');
      navigate('/?app=docs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void fetchDoc();

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading, user?.id]);

  const setPointAndSave = (next: PointDocV1) => {
    commitPoint(next);
  };

  const addSlide = () => {
    if (!point) return;
    const slide: PointSlide = {
      id: crypto.randomUUID(),
      name: `Slide ${point.slides.length + 1}`,
      background: { type: 'solid', color: '#0B1220' },
      elements: [],
    };
    const next = { ...point, slides: [...point.slides, slide] };
    setPointAndSave(next);
    setActiveSlideId(slide.id);
    setSelected(null);
  };

  const duplicateSlide = (slideId: string) => {
    if (!point) return;
    const src = point.slides.find((s) => s.id === slideId);
    if (!src) return;
    const copy: PointSlide = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} (copie)`,
      elements: src.elements.map((e) => ({ ...e, id: crypto.randomUUID() })),
    };
    const idx = point.slides.findIndex((s) => s.id === slideId);
    const slides = [...point.slides];
    slides.splice(idx + 1, 0, copy);
    setPointAndSave({ ...point, slides });
  };

  const deleteSlide = (slideId: string) => {
    if (!point) return;
    if (point.slides.length <= 1) return;

    const slides = point.slides.filter((s) => s.id !== slideId);
    const nextActive = slides[Math.max(0, slides.findIndex((s) => s.id === activeSlideId))]?.id || slides[0]?.id || null;

    setPointAndSave({ ...point, slides });
    setActiveSlideId(nextActive);
    setSelected(null);
  };

  const updateSlide = (slideId: string, patch: Partial<PointSlide>, opts?: { pushHistory?: boolean }) => {
    if (!point) return;
    const slides = point.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s));
    commitPoint({ ...point, slides }, opts);
  };

  const updateElement = (slideId: string, elementId: string, patch: Partial<PointElement>, opts?: { pushHistory?: boolean }) => {
    if (!point) return;
    const slides = point.slides.map((s) => {
      if (s.id !== slideId) return s;
      return {
        ...s,
        elements: s.elements.map((el) => (el.id === elementId ? ({ ...el, ...patch } as PointElement) : el)),
      };
    });
    commitPoint({ ...point, slides }, opts);
  };

  const deleteElement = (slideId: string, elementId: string) => {
    if (!point) return;
    const slides = point.slides.map((s) => {
      if (s.id !== slideId) return s;
      return { ...s, elements: s.elements.filter((el) => el.id !== elementId) };
    });
    setPointAndSave({ ...point, slides });
    setSelected(null);
  };

  const addText = () => {
    if (!point || !activeSlideId) return;
    const el: PointTextElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: 0.12,
      y: 0.12,
      w: 0.76,
      h: 0.14,
      text: 'Titre',
      style: {
        fontSize: 44,
        fontWeight: 700,
        color: '#FFFFFF',
        align: 'left',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      },
    };

    const slides = point.slides.map((s) => (s.id === activeSlideId ? { ...s, elements: [...s.elements, el] } : s));
    setPointAndSave({ ...point, slides });
    setSelected({ slideId: activeSlideId, elementId: el.id });
  };

  const addButton = () => {
    if (!point || !activeSlideId) return;
    const el: PointButtonElement = {
      id: crypto.randomUUID(),
      type: 'button',
      x: 0.36,
      y: 0.74,
      w: 0.28,
      h: 0.1,
      label: 'Suivant',
      targetSlideId: point.slides.find((s) => s.id !== activeSlideId)?.id || null,
      style: {
        bg: '#F97316',
        fg: '#0B1220',
        radius: 14,
      },
    };

    const slides = point.slides.map((s) => (s.id === activeSlideId ? { ...s, elements: [...s.elements, el] } : s));
    setPointAndSave({ ...point, slides });
    setSelected({ slideId: activeSlideId, elementId: el.id });
  };

  const addImageFromUrl = (src: string) => {
    if (!point || !activeSlideId) return;
    const el: PointImageElement = {
      id: crypto.randomUUID(),
      type: 'image',
      x: 0.15,
      y: 0.25,
      w: 0.7,
      h: 0.5,
      src,
      fit: 'contain',
      radius: 16,
    };
    const slides = point.slides.map((s) => (s.id === activeSlideId ? { ...s, elements: [...s.elements, el] } : s));
    setPointAndSave({ ...point, slides });
    setSelected({ slideId: activeSlideId, elementId: el.id });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImageUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Try doc-assets then fallback
      const { error: uploadError } = await supabase.storage.from('doc-assets').upload(fileName, file);

      let publicUrl: string | null = null;

      if (uploadError) {
        const { error: fallbackError } = await supabase.storage.from('covers').upload(`point-images/${fileName}`, file);
        if (fallbackError) throw fallbackError;
        publicUrl = supabase.storage.from('covers').getPublicUrl(`point-images/${fileName}`).data.publicUrl;
      } else {
        publicUrl = supabase.storage.from('doc-assets').getPublicUrl(fileName).data.publicUrl;
      }

      if (!publicUrl) throw new Error('URL image indisponible');

      addImageFromUrl(publicUrl);
      showSuccess('Image ajoutée');
      setShowImageDialog(false);
    } catch (err) {
      console.error(err);
      showError("Erreur lors de l'upload");
    } finally {
      setIsImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // Drag (edit mode)
  const dragRef = useRef<{
    slideId: string;
    elementId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    rect: DOMRect;
  } | null>(null);
  const dragChangedRef = useRef(false);

  const onElementPointerDown = (e: React.PointerEvent, slideId: string, elementId: string) => {
    if (mode !== 'edit' || permission !== 'write') return;
    if (!point) return;

    e.stopPropagation();
    dragChangedRef.current = false;

    const slide = point.slides.find((s) => s.id === slideId);
    const el = slide?.elements.find((x) => x.id === elementId);
    if (!slide || !el) return;

    const canvas = (e.currentTarget as HTMLElement).closest('[data-point-canvas="1"]') as HTMLElement | null;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    dragRef.current = {
      slideId,
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      originX: el.x,
      originY: el.y,
      rect,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected({ slideId, elementId });
  };

  const onElementPointerMove = (e: React.PointerEvent) => {
    const dr = dragRef.current;
    if (!dr || !point) return;

    const dx = (e.clientX - dr.startX) / dr.rect.width;
    const dy = (e.clientY - dr.startY) / dr.rect.height;

    const slide = point.slides.find((s) => s.id === dr.slideId);
    const el = slide?.elements.find((x) => x.id === dr.elementId);
    if (!slide || !el) return;

    const nextX = clamp01(dr.originX + dx);
    const nextY = clamp01(dr.originY + dy);

    // Keep within canvas
    const clampedX = clamp01(Math.min(nextX, 1 - el.w));
    const clampedY = clamp01(Math.min(nextY, 1 - el.h));

    dragChangedRef.current = true;
    updateElement(dr.slideId, dr.elementId, { x: clampedX, y: clampedY } as any, { pushHistory: false });
  };

  const onElementPointerUp = () => {
    dragRef.current = null;
    if (dragChangedRef.current && point) {
      pushHistory(point);
      dragChangedRef.current = false;
    }
  };

  const handleSelectElement = (e: React.MouseEvent, slideId: string, elementId: string) => {
    if (mode !== 'edit' || permission !== 'write') return;
    e.stopPropagation();
    setSelected({ slideId, elementId });
  };

  const exitPresentation = async () => {
    // Quitte le plein écran (si présent) puis revient en édition
    try {
      if (window.document.fullscreenElement) {
        await window.document.exitFullscreen();
      }
    } catch {
      // ignore
    } finally {
      setMode('edit');
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      const fs = Boolean(window.document.fullscreenElement);
      setIsFullscreen(fs);
      // Si on était en présentation et que l'utilisateur sort du plein écran (ESC), on quitte la présentation.
      if (mode === 'present' && !fs) {
        setMode('edit');
      }
    };

    window.document.addEventListener('fullscreenchange', onFsChange);
    onFsChange();
    return () => window.document.removeEventListener('fullscreenchange', onFsChange);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'present') return;

    // Tenter de passer en plein écran sur la scène uniquement
    const el = presentRef.current;
    if (el && !window.document.fullscreenElement) {
      el.requestFullscreen?.({
        navigationUI: 'hide'
      }).catch((err) => {
        console.warn('Fullscreen non disponible:', err);
        // Si le navigateur refuse, on reste quand même en mode présentation (sans UI)
      });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // En présentation : SEULEMENT ESC pour quitter, et navigation clavier
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        void exitPresentation();
        return;
      }
      // Navigation entre les slides
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        gotoNext();
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        gotoPrev();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, point, activeSlideId]);

  const renderSlideBackground = (bg: SlideBackground) => {
    if (bg.type === 'image' && bg.url) {
      return (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${bg.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      );
    }

    if (bg.type === 'youtube' && bg.videoId) {
      return (
        <div className="absolute inset-0 overflow-hidden">
          <iframe
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[160%]"
            src={`https://www.youtube-nocookie.com/embed/${bg.videoId}?autoplay=1&mute=1&controls=0&rel=0&loop=1&playlist=${bg.videoId}&modestbranding=1&playsinline=1&iv_load_policy=3`}
            title="Slide background"
            frameBorder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }

    return null;
  };

  const gotoSlide = (slideId: string) => {
    setActiveSlideId(slideId);
    setSelected(null);
  };

  const gotoNext = () => {
    if (!point || !activeSlideId) return;
    const idx = point.slides.findIndex((s) => s.id === activeSlideId);
    const next = point.slides[idx + 1];
    if (next) gotoSlide(next.id);
  };

  const gotoPrev = () => {
    if (!point || !activeSlideId) return;
    const idx = point.slides.findIndex((s) => s.id === activeSlideId);
    const prev = point.slides[idx - 1];
    if (prev) gotoSlide(prev.id);
  };

  const handleButtonClick = (targetSlideId: string | null) => {
    if (!targetSlideId) return;
    gotoSlide(targetSlideId);
  };

  const manualSave = async () => {
    await saveNow();
    showSuccess('Sauvegardé');
  };

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!point || !docRow || !activeSlide) return null;

  // --- MODE PRÉSENTATION: AUCUNE UI, PLEIN ÉCRAN SUR LA SCÈNE UNIQUEMENT ---
  if (mode === 'present') {
    return (
      <div 
        ref={presentRef} 
        className="fixed inset-0 z-[9999] bg-black overflow-hidden"
        style={{ 
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      >
        <div
          data-point-canvas="1"
          className="absolute inset-0 overflow-hidden relative"
          style={{ backgroundColor: activeSlide.background.type === 'solid' ? activeSlide.background.color : '#000000' }}
        >
          {renderSlideBackground(activeSlide.background)}
          <div className="absolute inset-0 bg-black/35" />

          {/* Conteneur 16:9 centré */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-[1200px] aspect-video relative">
              {activeSlide.elements.map((el) => {
                const style: React.CSSProperties = {
                  position: 'absolute',
                  left: `${el.x * 100}%`,
                  top: `${el.y * 100}%`,
                  width: `${el.w * 100}%`,
                  height: `${el.h * 100}%`,
                };

                return (
                  <div key={el.id} style={style} className="select-none">
                    {el.type === 'text' ? (
                      <div
                        className="w-full h-full flex items-center"
                        style={{
                          color: el.style.color,
                          fontSize: el.style.fontSize,
                          fontWeight: el.style.fontWeight as any,
                          fontFamily: el.style.fontFamily || 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                          justifyContent:
                            el.style.align === 'left' ? 'flex-start' : el.style.align === 'right' ? 'flex-end' : 'center',
                          textAlign: el.style.align,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {el.text}
                      </div>
                    ) : el.type === 'image' ? (
                      <div className="w-full h-full overflow-hidden" style={{ borderRadius: el.radius }}>
                        <img
                          src={el.src}
                          alt=""
                          className={`w-full h-full ${el.fit === 'cover' ? 'object-cover' : 'object-contain'} pointer-events-none`}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="w-full h-full font-semibold border border-white/10 shadow-sm"
                        style={{ background: el.style.bg, color: el.style.fg, borderRadius: el.style.radius }}
                        onClick={() => handleButtonClick(el.targetSlideId)}
                      >
                        {el.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MODE ÉDITION (UI complète) ---
  return (
    <div className="min-h-screen bg-[#F3F4F6] pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
              <Button variant="ghost" size="icon" onClick={() => navigate('/?app=docs')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="h-9 w-9 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Presentation className="h-5 w-5" />
              </div>

              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave();
                }}
                className="text-base sm:text-lg font-medium border-0 focus-visible:ring-0 px-2 max-w-[220px] sm:max-w-md bg-transparent truncate"
                readOnly={!isOwner}
              />

              <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-1 rounded-md bg-gray-100 border border-gray-200">{permission === 'write' ? 'Édition' : 'Lecture'}</span>
                <span className="px-2 py-1 rounded-md bg-gray-100 border border-gray-200">Chiffré</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => setMode('present')}
                className="gap-2"
              >
                <Play className="h-4 w-4" /> Présenter
              </Button>

              {permission === 'write' && (
                <Button onClick={manualSave} className="bg-gray-900 hover:bg-black text-white gap-2">
                  <Save className="h-4 w-4" /> Sauver
                </Button>
              )}
            </div>
          </div>
        </div>

        {isEditable && (
          <div className="border-t border-gray-200 bg-[#F8F9FA] px-4 sm:px-6 py-2">
            <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
              <Button variant="outline" size="sm" onClick={addSlide} className="gap-2">
                <Plus className="h-4 w-4" /> Nouvelle page
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="outline" size="sm" onClick={addText} className="gap-2">
                <Type className="h-4 w-4" /> Texte
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowImageDialog(true)} className="gap-2">
                <ImageIcon className="h-4 w-4" /> Image
              </Button>
              <Button variant="outline" size="sm" onClick={addButton} className="gap-2">
                <SquareArrowOutUpRight className="h-4 w-4" /> Bouton (lien)
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-4 p-4 sm:p-6">
        {/* Slides */}
        <Card className="p-3 h-fit lg:sticky lg:top-[92px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-900">Pages</div>
            {permission === 'write' && mode === 'edit' && (
              <Button variant="ghost" size="sm" onClick={addSlide} className="gap-2">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {point.slides.map((s, idx) => {
              const active = s.id === activeSlideId;
              return (
                <button
                  key={s.id}
                  onClick={() => gotoSlide(s.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    active ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900 truncate">{s.name || `Slide ${idx + 1}`}</div>
                    <div className="text-[11px] text-gray-400">{idx + 1}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {permission === 'write' && mode === 'edit' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => activeSlideId && duplicateSlide(activeSlideId)}
                disabled={!activeSlideId}
              >
                Dupliquer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => activeSlideId && deleteSlide(activeSlideId)}
                disabled={!activeSlideId || point.slides.length <= 1}
                className="text-red-600 hover:text-red-700"
              >
                Supprimer
              </Button>
            </div>
          )}
        </Card>

        {/* Canvas */}
        <div className="space-y-3">
          <div
            data-point-canvas="1"
            className="w-full aspect-video rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden relative"
            style={{ backgroundColor: activeSlide.background.type === 'solid' ? activeSlide.background.color : '#000000' }}
            onPointerMove={onElementPointerMove}
            onPointerUp={onElementPointerUp}
            onPointerCancel={onElementPointerUp}
            onPointerLeave={onElementPointerUp}
            onClick={() => isEditable && setSelected(null)}
          >
            {renderSlideBackground(activeSlide.background)}
            <div className="absolute inset-0 bg-black/35" />

            {activeSlide.elements.map((el) => {
              const isSelected = selected?.slideId === activeSlide.id && selected?.elementId === el.id;

              const style: React.CSSProperties = {
                position: 'absolute',
                left: `${el.x * 100}%`,
                top: `${el.y * 100}%`,
                width: `${el.w * 100}%`,
                height: `${el.h * 100}%`,
              };

              const elementNode = (
                <div
                  style={style}
                  className={`group select-none relative z-10 ${isEditable ? 'cursor-move' : ''}`}
                  onPointerDown={(e) => onElementPointerDown(e, activeSlide.id, el.id)}
                  onClick={(e) => handleSelectElement(e, activeSlide.id, el.id)}
                >
                  <div
                    className={`w-full h-full ${
                      isSelected && isEditable ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-transparent' : ''
                    }`}
                  >
                    {el.type === 'text' ? (
                      <div
                        className="w-full h-full flex items-center"
                        style={{
                          color: el.style.color,
                          fontSize: el.style.fontSize,
                          fontWeight: el.style.fontWeight as any,
                          fontFamily: el.style.fontFamily || 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                          justifyContent:
                            el.style.align === 'left' ? 'flex-start' : el.style.align === 'right' ? 'flex-end' : 'center',
                          textAlign: el.style.align,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {el.text}
                      </div>
                    ) : el.type === 'image' ? (
                      <div className="w-full h-full overflow-hidden" style={{ borderRadius: el.radius }}>
                        <img
                          src={el.src}
                          alt=""
                          className={`w-full h-full ${el.fit === 'cover' ? 'object-cover' : 'object-contain'} pointer-events-none`}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="w-full h-full font-semibold border border-white/10 shadow-sm"
                        style={{
                          background: el.style.bg,
                          color: el.style.fg,
                          borderRadius: el.style.radius,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected({ slideId: activeSlide.id, elementId: el.id });
                        }}
                      >
                        {el.label}
                      </button>
                    )}
                  </div>

                  {isEditable && isSelected && (
                    <div className="absolute -top-9 left-0">
                      <div className="flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 rounded-md px-2 py-1 shadow-sm">
                        <MousePointer2 className="h-3.5 w-3.5 text-gray-600" />
                        <span className="text-[11px] text-gray-600">Déplacer</span>
                      </div>
                    </div>
                  )}
                </div>
              );

              if (!isEditable) {
                return <div key={el.id}>{elementNode}</div>;
              }

              return (
                <ContextMenu
                  key={el.id}
                  onOpenChange={(open) => {
                    if (open) setSelected({ slideId: activeSlide.id, elementId: el.id });
                  }}
                >
                  <ContextMenuTrigger asChild>{elementNode}</ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem onSelect={() => copyElement(el)}>Copier</ContextMenuItem>
                    <ContextMenuItem onSelect={() => { copyElement(el); deleteElement(activeSlide.id, el.id); }}>Couper</ContextMenuItem>
                    <ContextMenuItem
                      onSelect={() => {
                        pasteClipboard();
                      }}
                      disabled={!clipboardRef.current}
                    >
                      Coller
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-red-600" onSelect={() => deleteElement(activeSlide.id, el.id)}>
                      Supprimer
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>

        {/* Properties */}
        <Card className="p-4 h-fit lg:sticky lg:top-[92px]">
          <div className="text-sm font-semibold text-gray-900">Propriétés</div>
          <div className="text-xs text-gray-500 mt-1">Sélectionnez un élément pour l'éditer.</div>

          <Separator className="my-3" />

          {/* Slide properties */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nom de page</Label>
              <Input value={activeSlide.name} onChange={(e) => updateSlide(activeSlide.id, { name: e.target.value })} disabled={!isEditable} />
            </div>

            <div className="space-y-2">
              <Label>Fond</Label>
              <Select
                value={activeSlide.background.type}
                onValueChange={(v: any) => {
                  if (v === 'solid') updateSlide(activeSlide.id, { background: { type: 'solid', color: '#0B1220' } });
                  if (v === 'image') updateSlide(activeSlide.id, { background: { type: 'image', url: '' } });
                  if (v === 'youtube') updateSlide(activeSlide.id, { background: { type: 'youtube', videoId: '' } });
                }}
                disabled={!isEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Couleur</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="youtube">Vidéo YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeSlide.background.type === 'solid' && (
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={activeSlide.background.color}
                    onChange={(e) => updateSlide(activeSlide.id, { background: { type: 'solid', color: e.target.value } })}
                    disabled={!isEditable}
                    className="w-16 p-1"
                  />
                  <Input
                    value={activeSlide.background.color}
                    onChange={(e) => updateSlide(activeSlide.id, { background: { type: 'solid', color: e.target.value } })}
                    disabled={!isEditable}
                  />
                </div>
              </div>
            )}

            {activeSlide.background.type === 'image' && (
              <div className="space-y-2">
                <Label>Image (URL)</Label>
                <Input
                  value={activeSlide.background.url}
                  onChange={(e) => updateSlide(activeSlide.id, { background: { type: 'image', url: e.target.value } })}
                  disabled={!isEditable}
                  placeholder="https://..."
                />
              </div>
            )}

            {activeSlide.background.type === 'youtube' && (
              <div className="space-y-2">
                <Label>Vidéo YouTube (lien)</Label>
                <Input
                  value={activeSlide.background.videoId ? `https://youtu.be/${activeSlide.background.videoId}` : ''}
                  onChange={(e) => {
                    const id = extractYoutubeId(e.target.value) || '';
                    updateSlide(activeSlide.id, { background: { type: 'youtube', videoId: id } });
                  }}
                  disabled={!isEditable}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <div className="text-xs text-gray-500">La vidéo est lue en muet et en boucle.</div>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {selectedElement ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900 capitalize">{selectedElement.type}</div>
                {isEditable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => deleteElement(activeSlide.id, selectedElement.id)}
                  >
                    Supprimer
                  </Button>
                )}
              </div>

              {/* Position & Size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">X</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElement.x * 100)}
                    onChange={(e) => {
                      const v = clamp01(Number(e.target.value) / 100);
                      updateElement(activeSlide.id, selectedElement.id, { x: Math.min(v, 1 - selectedElement.w) } as any);
                    }}
                    disabled={!isEditable}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Y</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElement.y * 100)}
                    onChange={(e) => {
                      const v = clamp01(Number(e.target.value) / 100);
                      updateElement(activeSlide.id, selectedElement.id, { y: Math.min(v, 1 - selectedElement.h) } as any);
                    }}
                    disabled={!isEditable}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Largeur</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElement.w * 100)}
                    onChange={(e) => {
                      const w = clamp01(Number(e.target.value) / 100);
                      updateElement(activeSlide.id, selectedElement.id, { w } as any);
                    }}
                    disabled={!isEditable}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hauteur</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElement.h * 100)}
                    onChange={(e) => {
                      const h = clamp01(Number(e.target.value) / 100);
                      updateElement(activeSlide.id, selectedElement.id, { h } as any);
                    }}
                    disabled={!isEditable}
                  />
                </div>
              </div>

              {selectedElement.type === 'text' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Texte</Label>
                    <Input
                      value={selectedElement.text}
                      onChange={(e) => updateElement(activeSlide.id, selectedElement.id, { text: e.target.value } as any)}
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Couleur</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={selectedElement.style.color}
                          onChange={(e) =>
                            updateElement(activeSlide.id, selectedElement.id, {
                              style: { ...selectedElement.style, color: e.target.value },
                            } as any)
                          }
                          disabled={!isEditable}
                          className="w-16 p-1"
                        />
                        <Input
                          value={selectedElement.style.color}
                          onChange={(e) =>
                            updateElement(activeSlide.id, selectedElement.id, {
                              style: { ...selectedElement.style, color: e.target.value },
                            } as any)
                          }
                          disabled={!isEditable}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Alignement</Label>
                      <Select
                        value={selectedElement.style.align}
                        onValueChange={(v: any) =>
                          updateElement(activeSlide.id, selectedElement.id, {
                            style: { ...selectedElement.style, align: v },
                          } as any)
                        }
                        disabled={!isEditable}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Gauche</SelectItem>
                          <SelectItem value="center">Centre</SelectItem>
                          <SelectItem value="right">Droite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Taille</Label>
                    <Slider
                      value={[selectedElement.style.fontSize]}
                      min={10}
                      max={96}
                      step={1}
                      onValueChange={(v) =>
                        updateElement(activeSlide.id, selectedElement.id, {
                          style: { ...selectedElement.style, fontSize: v[0] },
                        } as any)
                      }
                      disabled={!isEditable}
                    />
                    <div className="text-xs text-gray-500">{selectedElement.style.fontSize}px</div>
                  </div>
                </div>
              )}

              {selectedElement.type === 'text' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Police</Label>
                    <Select
                      value={selectedElement.style.fontFamily || FONT_FAMILIES[0].value}
                      onValueChange={(v: string) =>
                        updateElement(activeSlide.id, selectedElement.id, {
                          style: { ...selectedElement.style, fontFamily: v },
                        } as any)
                      }
                      disabled={!isEditable}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Police" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_FAMILIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {selectedElement.type === 'image' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Input
                      value={selectedElement.src}
                      onChange={(e) => updateElement(activeSlide.id, selectedElement.id, { src: e.target.value } as any)}
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select
                        value={selectedElement.fit}
                        onValueChange={(v: any) => updateElement(activeSlide.id, selectedElement.id, { fit: v } as any)}
                        disabled={!isEditable}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contain">Contain</SelectItem>
                          <SelectItem value="cover">Cover</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Arrondi</Label>
                      <Slider
                        value={[selectedElement.radius]}
                        min={0}
                        max={40}
                        step={1}
                        onValueChange={(v) => updateElement(activeSlide.id, selectedElement.id, { radius: v[0] } as any)}
                        disabled={!isEditable}
                      />
                      <div className="text-xs text-gray-500">{selectedElement.radius}px</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedElement.type === 'button' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={selectedElement.label}
                      onChange={(e) => updateElement(activeSlide.id, selectedElement.id, { label: e.target.value } as any)}
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Destination (page)</Label>
                    <Select
                      value={selectedElement.targetSlideId || ''}
                      onValueChange={(v) => updateElement(activeSlide.id, selectedElement.id, { targetSlideId: v || null } as any)}
                      disabled={!isEditable}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une page" />
                      </SelectTrigger>
                      <SelectContent>
                        {point.slides.map((s, idx) => (
                          <SelectItem key={s.id} value={s.id}>
                            {idx + 1}. {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Fond</Label>
                      <Input
                        type="color"
                        value={selectedElement.style.bg}
                        onChange={(e) =>
                          updateElement(activeSlide.id, selectedElement.id, {
                            style: { ...selectedElement.style, bg: e.target.value },
                          } as any)
                        }
                        disabled={!isEditable}
                        className="w-full p-1 h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Texte</Label>
                      <Input
                        type="color"
                        value={selectedElement.style.fg}
                        onChange={(e) =>
                          updateElement(activeSlide.id, selectedElement.id, {
                            style: { ...selectedElement.style, fg: e.target.value },
                          } as any)
                        }
                        disabled={!isEditable}
                        className="w-full p-1 h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Arrondi</Label>
                    <Slider
                      value={[selectedElement.style.radius]}
                      min={0}
                      max={30}
                      step={1}
                      onValueChange={(v) =>
                        updateElement(activeSlide.id, selectedElement.id, {
                          style: { ...selectedElement.style, radius: v[0] },
                        } as any)
                      }
                      disabled={!isEditable}
                    />
                    <div className="text-xs text-gray-500">{selectedElement.style.radius}px</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">{isEditable ? 'Cliquez un élément (ou ajoutez-en un).' : 'Mode lecture.'}</div>
          )}
        </Card>
      </div>

      {/* Image dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Ajouter une image</DialogTitle>
            <DialogDescription>Upload (recommandé) ou URL.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="url">Lien</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="py-4">
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => imageInputRef.current?.click()}
              >
                {isImageUploading ? (
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400" />
                ) : (
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                )}
                <p className="mt-2 text-sm text-gray-600">Cliquez pour choisir un fichier</p>
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </TabsContent>

            <TabsContent value="url" className="py-4 space-y-3">
              <div className="space-y-2">
                <Label>URL</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </div>
              <DialogFooter className="sm:justify-start">
                <Button
                  onClick={() => {
                    if (!imageUrl.trim()) return;
                    addImageFromUrl(imageUrl.trim());
                    setImageUrl('');
                    setShowImageDialog(false);
                    showSuccess('Image ajoutée');
                  }}
                  className="w-full"
                >
                  Ajouter
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}