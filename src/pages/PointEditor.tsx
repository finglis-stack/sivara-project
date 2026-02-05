import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Image as ImageIcon,
  Loader2,
  MousePointer2,
  Play,
  Plus,
  Presentation,
  Save,
  SquareArrowOutUpRight,
  Type,
  Upload,
  Minus,
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

const TEXT_PRESETS = [
  { name: 'Titre', fontSize: 56, fontWeight: 800, align: 'center' as const },
  { name: 'Sous-titre', fontSize: 42, fontWeight: 700, align: 'center' as const },
  { name: 'Titre gauche', fontSize: 48, fontWeight: 700, align: 'left' as const },
  { name: 'Paragraphe', fontSize: 20, fontWeight: 400, align: 'left' as const },
  { name: 'Grand texte', fontSize: 32, fontWeight: 600, align: 'center' as const },
  { name: 'Petit texte', fontSize: 16, fontWeight: 400, align: 'left' as const },
];

const clonePoint = (p: PointDocV1): PointDocV1 => {
  try {
    return structuredClone(p) as PointDocV1;
  } catch {
    return JSON.parse(JSON.stringify(p)) as PointDocV1;
  }
};

const extractYoutubeId = (input: string): string | null => {
  const url = input.trim();
  if (!url) return null;

  let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (match?.[1]) return match[1];

  match = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (match?.[1]) return match[1];

  match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (match?.[1]) return match[1];

  return null;
};

const safeJsonParse = (value: string): PointDocV1 | null => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.slides)) return null;

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
                    fontFamily: el.style?.fontFamily || 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
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

  // Curseur : visible par défaut, masqué après 2s d'inactivité en mode présentation
  const [isCursorHidden, setIsCursorHidden] = useState(false);
  const cursorHideTimerRef = useRef<number | null>(null);

  const saveTimeoutRef = useRef<number | null>(null);
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isImageUploading, setIsImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isEditable = useMemo(() => permission === 'write' && mode === 'edit', [permission, mode]);

  const historyRef = useRef<PointDocV1[]>([]);
  const historyIndexRef = useRef(0);

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

  // Édition inline
  const [editingElementId, setEditingElementId] = useState<string | null>(null);

  // Panneaux flottants (position)
  const [panelPositions, setPanelPositions] = useState({
    slides: { x: 20, y: 120, collapsed: false },
    properties: { x: 20, y: 400, collapsed: false },
  });

  const handleElementDoubleClick = (e: React.MouseEvent, elementId: string) => {
    if (!isEditable) return;
    e.stopPropagation();
    setEditingElementId(elementId);
  };

  const handleInlineTextEdit = (elementId: string, newText: string) => {
    if (!activeSlideId || !point) return;
    updateElement(activeSlideId, elementId, { text: newText } as any);
  };

  const handleInlineButtonEdit = (elementId: string, newLabel: string) => {
    if (!activeSlideId || !point) return;
    updateElement(activeSlideId, elementId, { label: newLabel } as any);
  };

  const handleInlineImageEdit = (elementId: string, newSrc: string) => {
    if (!activeSlideId || !point) return;
    updateElement(activeSlideId, elementId, { src: newSrc } as any);
  };

  const startPanelDrag = (panel: 'slides' | 'properties', e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX - panelPositions[panel].x;
    const startY = e.clientY - panelPositions[panel].y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPanelPositions(prev => ({
        ...prev,
        [panel]: {
          ...prev[panel],
          x: moveEvent.clientX - startX,
          y: moveEvent.clientY - startY,
        },
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const scheduleSave = () => {
    if (permission !== 'write') return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      void saveNow();
    }, 500);
  };

  const pushHistory = (next: PointDocV1) => {
    const base = historyRef.current.slice(0, historyIndexRef.current + 1);
    base.push(clonePoint(next));

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
    if (user?.id && user.id === doc.owner_id) return 'write';
    if (doc.visibility === 'public' && doc.public_permission === 'write') return 'write';
    return 'read';
  };

  const fetchDoc = async () => {
    if (!id) return;
    setIsLoading(true);

    try {
      const { data: doc, error } = await supabase.from('documents').select('*').eq('id', id).single();
      if (error || !doc) throw error || new Error('Point introuvable');
      if (doc.type !== 'point') throw new Error("Ce document n'est pas un Point");

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
        await encryptionService.initialize(docTyped.owner_id);
        decryptedTitle = await encryptionService.decrypt(docTyped.title, docTyped.encryption_iv);
        decryptedContent = await encryptionService.decrypt(docTyped.content, docTyped.encryption_iv);
      }

      const parsed = safeJsonParse(decryptedContent);
      if (!parsed) throw new Error('Contenu Point invalide');

      setTitle(decryptedTitle);
      setPoint(parsed);
      setActiveSlideId(parsed.slides[0]?.id || null);

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
  }, [id, authLoading, user?.id]);

  const setPointAndSave = (next: PointDocV1) => {
    commitPoint(next);
  };

  const addSlide = () => {
    if (!point) return;
    const slide: PointSlide = {
      id: crypto.randomUUID(),
      name: `Slide ${point.slides.length + 1}`,
      background: { type: 'solid', color: '#000000' },
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

  // Guides d'alignement (snap)
  const [snapGuides, setSnapGuides] = useState<{
    vertical: number | null;
    horizontal: number | null;
  }>({ vertical: null, horizontal: null });

  const SNAP_THRESHOLD = 0.02;

  // Drag and drop pour réorganiser les slides
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);

  const handleSlideDragStart = (e: React.DragEvent, slideId: string) => {
    setDraggedSlideId(slideId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSlideDragOver = (e: React.DragEvent, slideId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSlideId && draggedSlideId !== slideId) {
      setDragOverSlideId(slideId);
    }
  };

  const handleSlideDragLeave = () => {
    setDragOverSlideId(null);
  };

  const handleSlideDrop = (e: React.DragEvent, targetSlideId: string) => {
    e.preventDefault();
    if (!draggedSlideId || draggedSlideId === targetSlideId || !point) return;

    const slides = [...point.slides];
    const draggedIndex = slides.findIndex((s) => s.id === draggedSlideId);
    const targetIndex = slides.findIndex((s) => s.id === targetSlideId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedSlide] = slides.splice(draggedIndex, 1);
    slides.splice(targetIndex, 0, draggedSlide);

    setPointAndSave({ ...point, slides });
    setDraggedSlideId(null);
    setDragOverSlideId(null);
  };

  const handleSlideDragEnd = () => {
    setDraggedSlideId(null);
    setDragOverSlideId(null);
  };

  const findSnapPosition = (
    targetX: number,
    targetY: number,
    targetW: number,
    targetH: number,
    elements: PointElement[],
    excludeId: string
  ) => {
    let snapX: number | null = null;
    let snapY: number | null = null;

    const targetCenterX = targetX + targetW / 2;
    const targetCenterY = targetY + targetH / 2;
    const targetRight = targetX + targetW;
    const targetBottom = targetY + targetH;

    for (const el of elements) {
      if (el.id === excludeId) continue;

      const elCenterX = el.x + el.w / 2;
      const elCenterY = el.y + el.h / 2;
      const elRight = el.x + el.w;
      const elBottom = el.y + el.h;

      if (Math.abs(targetX - el.x) < SNAP_THRESHOLD) snapX = el.x;
      if (Math.abs(targetRight - elRight) < SNAP_THRESHOLD) snapX = elRight - targetW;
      if (Math.abs(targetCenterX - elCenterX) < SNAP_THRESHOLD) snapX = elCenterX - targetW / 2;
      if (Math.abs(targetX - elRight) < SNAP_THRESHOLD) snapX = elRight;
      if (Math.abs(targetRight - el.x) < SNAP_THRESHOLD) snapX = el.x - targetW;

      if (Math.abs(targetY - el.y) < SNAP_THRESHOLD) snapY = el.y;
      if (Math.abs(targetBottom - elBottom) < SNAP_THRESHOLD) snapY = elBottom - targetH;
      if (Math.abs(targetCenterY - elCenterY) < SNAP_THRESHOLD) snapY = elCenterY - targetH / 2;
      if (Math.abs(targetY - elBottom) < SNAP_THRESHOLD) snapY = elBottom;
      if (Math.abs(targetBottom - el.y) < SNAP_THRESHOLD) snapY = el.y - targetH;
    }

    if (Math.abs(targetCenterX - 0.5) < SNAP_THRESHOLD) snapX = 0.5 - targetW / 2;
    if (Math.abs(targetCenterY - 0.5) < SNAP_THRESHOLD) snapY = 0.5 - targetH / 2;

    return { snapX, snapY };
  };

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

    let clampedX = clamp01(Math.min(nextX, 1 - el.w));
    let clampedY = clamp01(Math.min(nextY, 1 - el.h));

    const { snapX, snapY } = findSnapPosition(clampedX, clampedY, el.w, el.h, slide.elements, el.id);
    
    if (snapX !== null) clampedX = snapX;
    if (snapY !== null) clampedY = snapY;

    const elCenterX = clampedX + el.w / 2;
    const elCenterY = clampedY + el.h / 2;
    
    setSnapGuides({
      vertical: snapX !== null ? elCenterX : null,
      horizontal: snapY !== null ? elCenterY : null,
    });

    dragChangedRef.current = true;
    updateElement(dr.slideId, dr.elementId, { x: clampedX, y: clampedY } as any, { pushHistory: false });
  };

  const onElementPointerUp = () => {
    dragRef.current = null;
    setSnapGuides({ vertical: null, horizontal: null });
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
    setMode('edit');
  };

  useEffect(() => {
    if (mode !== 'present') {
      setIsCursorHidden(false);
      if (cursorHideTimerRef.current) {
        window.clearTimeout(cursorHideTimerRef.current);
        cursorHideTimerRef.current = null;
      }
      return;
    }

    const armHideTimer = () => {
      if (cursorHideTimerRef.current) window.clearTimeout(cursorHideTimerRef.current);
      cursorHideTimerRef.current = window.setTimeout(() => {
        setIsCursorHidden(true);
      }, 2000);
    };

    const onPointerMove = () => {
      setIsCursorHidden(false);
      armHideTimer();
    };

    // Au moment où on entre en présentation
    setIsCursorHidden(false);
    armHideTimer();

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (cursorHideTimerRef.current) {
        window.clearTimeout(cursorHideTimerRef.current);
        cursorHideTimerRef.current = null;
      }
    };
  }, [mode]);

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

  // --- MODE ÉDITION ET PRÉSENTATION ---
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Canvas plein écran - prend tout l'espace */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          data-point-canvas="1"
          className={`relative bg-white overflow-hidden ${mode === 'present' && isCursorHidden ? 'cursor-none' : ''}`}
          style={{ 
            width: '100vw',
            height: '100vh',
            backgroundColor: activeSlide.background.type === 'solid' ? activeSlide.background.color : '#000000'
          }}
          onPointerMove={mode === 'edit' ? onElementPointerMove : undefined}
          onPointerUp={mode === 'edit' ? onElementPointerUp : undefined}
          onPointerCancel={mode === 'edit' ? onElementPointerUp : undefined}
          onPointerLeave={mode === 'edit' ? onElementPointerUp : undefined}
          onClick={() => mode === 'edit' && isEditable && setSelected(null)}
          onContextMenu={(e) => {
            if (mode === 'present') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {renderSlideBackground(activeSlide.background)}
          <div className="absolute inset-0 bg-black/35" />

          {/* Guides d'alignement visuels - seulement en mode édition */}
          {mode === 'edit' && snapGuides.vertical !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-orange-500 pointer-events-none z-50"
              style={{ left: `${snapGuides.vertical * 100}%` }}
            />
          )}
          {mode === 'edit' && snapGuides.horizontal !== null && (
            <div
              className="absolute left-0 right-0 h-0.5 bg-orange-500 pointer-events-none z-50"
              style={{ top: `${snapGuides.horizontal * 100}%` }}
            />
          )}

          {activeSlide.elements.map((el) => {
            const isSelected = selected?.slideId === activeSlide.id && selected?.elementId === el.id;
            const isEditing = editingElementId === el.id;

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
                className={`group select-none relative z-10 ${mode === 'edit' && isEditable ? 'cursor-move' : ''}`}
                onPointerDown={mode === 'edit' ? (e) => onElementPointerDown(e, activeSlide.id, el.id) : undefined}
                onClick={mode === 'edit' ? (e) => handleSelectElement(e, activeSlide.id, el.id) : undefined}
                onDoubleClick={mode === 'edit' ? (e) => handleElementDoubleClick(e, el.id) : undefined}
                onContextMenu={(e) => {
                  if (mode === 'present') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                <div
                  className={`w-full h-full ${
                    mode === 'edit' && isSelected && isEditable ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-transparent' : ''
                  }`}
                >
                  {el.type === 'text' ? (
                    mode === 'edit' && isEditing ? (
                      <textarea
                        autoFocus
                        className="w-full h-full bg-transparent resize-none outline-none"
                        style={{
                          color: el.style.color,
                          fontSize: el.style.fontSize,
                          fontWeight: el.style.fontWeight as any,
                          fontFamily: el.style.fontFamily || 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                          textAlign: el.style.align,
                        }}
                        defaultValue={el.text}
                        onBlur={(e) => {
                          handleInlineTextEdit(el.id, e.target.value);
                          setEditingElementId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingElementId(null);
                          }
                        }}
                      />
                    ) : (
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
                    )
                  ) : el.type === 'image' ? (
                    mode === 'edit' && isEditing ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/50">
                        <Input
                          autoFocus
                          className="w-64"
                          placeholder="URL de l'image"
                          defaultValue={el.src}
                          onBlur={(e) => {
                            handleInlineImageEdit(el.id, e.target.value);
                            setEditingElementId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingElementId(null);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full overflow-hidden" style={{ borderRadius: el.radius }}>
                        <img
                          src={el.src}
                          alt=""
                          className={`w-full h-full ${el.fit === 'cover' ? 'object-cover' : 'object-contain'} pointer-events-none`}
                        />
                      </div>
                    )
                  ) : (
                    mode === 'edit' && isEditing ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/50">
                        <Input
                          autoFocus
                          className="w-48"
                          placeholder="Label du bouton"
                          defaultValue={el.label}
                          onBlur={(e) => {
                            handleInlineButtonEdit(el.id, e.target.value);
                            setEditingElementId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingElementId(null);
                            }
                          }}
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
                          if (mode === 'edit') {
                            e.stopPropagation();
                            setSelected({ slideId: activeSlide.id, elementId: el.id });
                          } else {
                            handleButtonClick(el.targetSlideId);
                          }
                        }}
                      >
                        {el.label}
                      </button>
                    )
                  )}
                </div>

                {mode === 'edit' && isEditable && isSelected && !isEditing && (
                  <div className="absolute -top-9 left-0">
                    <div className="flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 rounded-md px-2 py-1 shadow-sm">
                      <MousePointer2 className="h-3.5 w-3.5 text-gray-600" />
                      <span className="text-[11px] text-gray-600">Déplacer</span>
                    </div>
                  </div>
                )}
              </div>
            );

            if (mode !== 'edit' || !isEditable) {
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

      {/* Barre d'outils flottante en haut - masquée en mode présentation */}
      {mode === 'edit' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md rounded-xl shadow-2xl border border-white/10">
          <div className="px-4 py-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/?app=docs')}
                className="!text-white/80 hover:!text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="h-8 w-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Presentation className="h-4 w-4" />
              </div>

              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave();
                }}
                className="text-base font-medium border-0 focus-visible:ring-0 px-2 w-64 bg-transparent truncate text-white placeholder:text-white/40"
                readOnly={!isOwner}
              />

              <div className="flex items-center gap-2 text-xs text-white/60">
                <span className="px-2 py-1 rounded-md bg-white/10 border border-white/15 text-white/80">
                  {permission === 'write' ? 'Édition' : 'Lecture'}
                </span>
              </div>

              <div className="w-px h-6 bg-white/10" />

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMode('present');
                  }}
                  className="gap-2 bg-white/10 border-white/20 !text-white hover:!text-white hover:bg-white/15"
                >
                  <Play className="h-4 w-4" /> Présenter
                </Button>

                {permission === 'write' && (
                  <Button onClick={manualSave} className="bg-orange-600 hover:bg-orange-700 !text-white gap-2">
                    <Save className="h-4 w-4" /> Sauver
                  </Button>
                )}
              </div>
            </div>
          </div>

          {isEditable && (
            <div className="border-t border-white/10 bg-black/40 px-4 py-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSlide}
                  className="gap-2 bg-white/10 border-white/20 !text-white hover:!text-white hover:bg-white/15"
                >
                  <Plus className="h-4 w-4" /> Nouvelle page
                </Button>
                <div className="w-px h-6 bg-white/10" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addText}
                  className="gap-2 bg-white/10 border-white/20 !text-white hover:!text-white hover:bg-white/15"
                >
                  <Type className="h-4 w-4" /> Texte
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImageDialog(true)}
                  className="gap-2 bg-white/10 border-white/20 !text-white hover:!text-white hover:bg-white/15"
                >
                  <ImageIcon className="h-4 w-4" /> Image
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  className="gap-2 bg-white/10 border-white/20 !text-white hover:!text-white hover:bg-white/15"
                >
                  <SquareArrowOutUpRight className="h-4 w-4" /> Bouton (lien)
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Panneau flottant: Slides - masqué en mode présentation */}
      {mode === 'edit' && (
        <div
          className="fixed z-40 bg-black/55 backdrop-blur-md rounded-lg shadow-2xl border border-white/10"
          style={{
            left: `${panelPositions.slides.x}px`,
            top: `${panelPositions.slides.y}px`,
            width: panelPositions.slides.collapsed ? 'auto' : '280px',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 bg-black/35 border-b border-white/10 cursor-move rounded-t-lg"
            onMouseDown={(e) => startPanelDrag('slides', e)}
          >
            <span className="text-sm font-semibold text-white/90">Pages</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPanelPositions(prev => ({ ...prev, slides: { ...prev.slides, collapsed: !prev.slides.collapsed } }))}
              className="!text-white/70 hover:!text-white hover:bg-white/10"
            >
              {panelPositions.slides.collapsed ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            </Button>
          </div>

          {!panelPositions.slides.collapsed && (
            <div className="p-3">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {point.slides.map((s, idx) => {
                  const active = s.id === activeSlideId;
                  const isDragging = draggedSlideId === s.id;
                  const isDragOver = dragOverSlideId === s.id;

                  return (
                    <div
                      key={s.id}
                      draggable={permission === 'write' && mode === 'edit'}
                      onDragStart={(e) => handleSlideDragStart(e, s.id)}
                      onDragOver={(e) => handleSlideDragOver(e, s.id)}
                      onDragLeave={handleSlideDragLeave}
                      onDrop={(e) => handleSlideDrop(e, s.id)}
                      onDragEnd={handleSlideDragEnd}
                      onClick={() => gotoSlide(s.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition-all cursor-pointer ${
                        active
                          ? 'bg-orange-500/20 border-orange-400/40 ring-1 ring-orange-400/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      } ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-orange-400 border-dashed' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {permission === 'write' && mode === 'edit' && (
                            <div className="cursor-grab text-white/40 hover:text-white/70">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                              </svg>
                            </div>
                          )}
                          <div className="text-sm font-medium text-white/90 truncate">{s.name || `Slide ${idx + 1}`}</div>
                        </div>
                        <div className="text-[11px] text-white/40 shrink-0">{idx + 1}</div>
                      </div>
                    </div>
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
                    className="bg-white/10 border-white/20 !text-white hover:!text-white hover:bg-white/15"
                  >
                    Dupliquer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activeSlideId && deleteSlide(activeSlideId)}
                    disabled={!activeSlideId || point.slides.length <= 1}
                    className="bg-red-500/10 border-red-500/30 !text-red-100 hover:!text-red-50 hover:bg-red-500/15"
                  >
                    Supprimer
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Panneau flottant: Propriétés - masqué en mode présentation */}
      {mode === 'edit' && (
        <div
          className="fixed z-40 bg-black/55 backdrop-blur-md rounded-lg shadow-2xl border border-white/10"
          style={{
            left: `${panelPositions.properties.x}px`,
            top: `${panelPositions.properties.y}px`,
            width: panelPositions.properties.collapsed ? 'auto' : '320px',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 bg-black/35 border-b border-white/10 cursor-move rounded-t-lg sticky top-0"
            onMouseDown={(e) => startPanelDrag('properties', e)}
          >
            <span className="text-sm font-semibold text-white/90">Propriétés</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPanelPositions(prev => ({ ...prev, properties: { ...prev.properties, collapsed: !prev.properties.collapsed } }))}
              className="!text-white/70 hover:!text-white hover:bg-white/10"
            >
              {panelPositions.properties.collapsed ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            </Button>
          </div>

          {!panelPositions.properties.collapsed && (
            <div className="p-4">
              <div className="text-xs text-white/50 mb-3">Sélectionnez un élément pour l'éditer.</div>

              <Separator className="my-3 bg-white/10" />

              {/* Slide properties */}
              <div className="space-y-3 mb-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Nom de page</Label>
                  <Input
                    value={activeSlide.name}
                    onChange={(e) => updateSlide(activeSlide.id, { name: e.target.value })}
                    disabled={!isEditable}
                    className="bg-white/5 border-white/10 !text-white placeholder:text-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Fond</Label>
                  <Select
                    value={activeSlide.background.type}
                    onValueChange={(v: any) => {
                      if (v === 'solid') updateSlide(activeSlide.id, { background: { type: 'solid', color: '#000000' } });
                      if (v === 'image') updateSlide(activeSlide.id, { background: { type: 'image', url: '' } });
                      if (v === 'youtube') updateSlide(activeSlide.id, { background: { type: 'youtube', videoId: '' } });
                    }}
                    disabled={!isEditable}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 !text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-white/10">
                      <SelectItem value="solid" className="text-white">Couleur</SelectItem>
                      <SelectItem value="image" className="text-white">Image</SelectItem>
                      <SelectItem value="youtube" className="text-white">Vidéo YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeSlide.background.type === 'solid' && (
                  <div className="space-y-2">
                    <Label className="text-white/80">Couleur</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={activeSlide.background.color}
                        onChange={(e) => updateSlide(activeSlide.id, { background: { type: 'solid', color: e.target.value } })}
                        disabled={!isEditable}
                        className="w-16 p-1 bg-white/5 border-white/10"
                      />
                      <Input
                        value={activeSlide.background.color}
                        onChange={(e) => updateSlide(activeSlide.id, { background: { type: 'solid', color: e.target.value } })}
                        disabled={!isEditable}
                        className="bg-white/5 border-white/10 !text-white"
                      />
                    </div>
                  </div>
                )}

                {activeSlide.background.type === 'image' && (
                  <div className="space-y-2">
                    <Label className="text-white/80">Image (URL)</Label>
                    <Input
                      value={activeSlide.background.url}
                      onChange={(e) => updateSlide(activeSlide.id, { background: { type: 'image', url: e.target.value } })}
                      disabled={!isEditable}
                      placeholder="https://..."
                      className="bg-white/5 border-white/10 !text-white placeholder:text-white/40"
                    />
                  </div>
                )}

                {activeSlide.background.type === 'youtube' && (
                  <div className="space-y-2">
                    <Label className="text-white/80">Vidéo YouTube (lien)</Label>
                    <Input
                      value={activeSlide.background.videoId ? `https://youtu.be/${activeSlide.background.videoId}` : ''}
                      onChange={(e) => {
                        const id = extractYoutubeId(e.target.value) || '';
                        updateSlide(activeSlide.id, { background: { type: 'youtube', videoId: id } });
                      }}
                      disabled={!isEditable}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="bg-white/5 border-white/10 !text-white placeholder:text-white/40"
                    />
                    <div className="text-xs text-white/50">La vidéo est lue en muet et en boucle.</div>
                  </div>
                )}
              </div>

              <Separator className="my-4 bg-white/10" />

              {selectedElement ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white/90 capitalize">{selectedElement.type}</div>
                    {isEditable && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-red-500/10 border-red-500/30 !text-red-100 hover:!text-red-50 hover:bg-red-500/15"
                        onClick={() => deleteElement(activeSlide.id, selectedElement.id)}
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>

                  {/* Position & Size */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-white/70">X</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedElement.x * 100)}
                        onChange={(e) => {
                          const v = clamp01(Number(e.target.value) / 100);
                          updateElement(activeSlide.id, selectedElement.id, { x: Math.min(v, 1 - selectedElement.w) } as any);
                        }}
                        disabled={!isEditable}
                        className="bg-white/5 border-white/10 !text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-white/70">Y</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedElement.y * 100)}
                        onChange={(e) => {
                          const v = clamp01(Number(e.target.value) / 100);
                          updateElement(activeSlide.id, selectedElement.id, { y: Math.min(v, 1 - selectedElement.h) } as any);
                        }}
                        disabled={!isEditable}
                        className="bg-white/5 border-white/10 !text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-white/70">Largeur</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedElement.w * 100)}
                        onChange={(e) => {
                          const w = clamp01(Number(e.target.value) / 100);
                          updateElement(activeSlide.id, selectedElement.id, { w } as any);
                        }}
                        disabled={!isEditable}
                        className="bg-white/5 border-white/10 !text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-white/70">Hauteur</Label>
                      <Input
                        type="number"
                        value={Math.round(selectedElement.h * 100)}
                        onChange={(e) => {
                          const h = clamp01(Number(e.target.value) / 100);
                          updateElement(activeSlide.id, selectedElement.id, { h } as any);
                        }}
                        disabled={!isEditable}
                        className="bg-white/5 border-white/10 !text-white"
                      />
                    </div>
                  </div>

                  {selectedElement.type === 'text' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-white/80">Style rapide</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {TEXT_PRESETS.map((preset) => (
                            <Button
                              key={preset.name}
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateElement(activeSlide.id, selectedElement.id, {
                                  style: {
                                    ...selectedElement.style,
                                    fontSize: preset.fontSize,
                                    fontWeight: preset.fontWeight,
                                    align: preset.align,
                                  },
                                } as any)
                              }
                              className="text-xs bg-white/10 border-white/20 !text-white hover:!text-white hover:bg-white/15"
                            >
                              {preset.name}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-white/80">Couleur</Label>
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
                              className="w-16 p-1 bg-white/5 border-white/10"
                            />
                            <Input
                              value={selectedElement.style.color}
                              onChange={(e) =>
                                updateElement(activeSlide.id, selectedElement.id, {
                                  style: { ...selectedElement.style, color: e.target.value },
                                } as any)
                              }
                              disabled={!isEditable}
                              className="bg-white/5 border-white/10 !text-white"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Alignement</Label>
                          <Select
                            value={selectedElement.style.align}
                            onValueChange={(v: any) =>
                              updateElement(activeSlide.id, selectedElement.id, {
                                style: { ...selectedElement.style, align: v },
                              } as any)
                            }
                            disabled={!isEditable}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 !text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 border-white/10">
                              <SelectItem value="left" className="text-white">Gauche</SelectItem>
                              <SelectItem value="center" className="text-white">Centre</SelectItem>
                              <SelectItem value="right" className="text-white">Droite</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white/80">Taille</Label>
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
                        <div className="text-xs text-white/50">{selectedElement.style.fontSize}px</div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white/80">Police</Label>
                        <Select
                          value={selectedElement.style.fontFamily || FONT_FAMILIES[0].value}
                          onValueChange={(v: string) =>
                            updateElement(activeSlide.id, selectedElement.id, {
                              style: { ...selectedElement.style, fontFamily: v },
                            } as any)
                          }
                          disabled={!isEditable}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 !text-white">
                            <SelectValue placeholder="Police" />
                          </SelectTrigger>
                          <SelectContent className="bg-black/95 border-white/10">
                            {FONT_FAMILIES.map((f) => (
                              <SelectItem key={f.value} value={f.value} className="text-white">
                                {f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white/80">Graisse</Label>
                        <Select
                          value={selectedElement.style.fontWeight.toString()}
                          onValueChange={(v: string) =>
                            updateElement(activeSlide.id, selectedElement.id, {
                              style: { ...selectedElement.style, fontWeight: parseInt(v) },
                            } as any)
                          }
                          disabled={!isEditable}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 !text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/95 border-white/10">
                            <SelectItem value="100" className="text-white">Fin (100)</SelectItem>
                            <SelectItem value="300" className="text-white">Léger (300)</SelectItem>
                            <SelectItem value="400" className="text-white">Normal (400)</SelectItem>
                            <SelectItem value="500" className="text-white">Moyen (500)</SelectItem>
                            <SelectItem value="600" className="text-white">Semi-bold (600)</SelectItem>
                            <SelectItem value="700" className="text-white">Bold (700)</SelectItem>
                            <SelectItem value="800" className="text-white">Extra-bold (800)</SelectItem>
                            <SelectItem value="900" className="text-white">Black (900)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'image' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-white/80">Source</Label>
                        <Input
                          value={selectedElement.src}
                          onChange={(e) => updateElement(activeSlide.id, selectedElement.id, { src: e.target.value } as any)}
                          disabled={!isEditable}
                          className="bg-white/5 border-white/10 !text-white placeholder:text-white/40"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-white/80">Mode</Label>
                          <Select
                            value={selectedElement.fit}
                            onValueChange={(v: any) => updateElement(activeSlide.id, selectedElement.id, { fit: v } as any)}
                            disabled={!isEditable}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 !text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 border-white/10">
                              <SelectItem value="contain" className="text-white">Contain</SelectItem>
                              <SelectItem value="cover" className="text-white">Cover</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Arrondi</Label>
                          <Slider
                            value={[selectedElement.radius]}
                            min={0}
                            max={40}
                            step={1}
                            onValueChange={(v) => updateElement(activeSlide.id, selectedElement.id, { radius: v[0] } as any)}
                            disabled={!isEditable}
                          />
                          <div className="text-xs text-white/50">{selectedElement.radius}px</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'button' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-white/80">Label</Label>
                        <Input
                          value={selectedElement.label}
                          onChange={(e) => updateElement(activeSlide.id, selectedElement.id, { label: e.target.value } as any)}
                          disabled={!isEditable}
                          className="bg-white/5 border-white/10 !text-white placeholder:text-white/40"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white/80">Destination (page)</Label>
                        <Select
                          value={selectedElement.targetSlideId || ''}
                          onValueChange={(v) => updateElement(activeSlide.id, selectedElement.id, { targetSlideId: v || null } as any)}
                          disabled={!isEditable}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 !text-white">
                            <SelectValue placeholder="Choisir une page" />
                          </SelectTrigger>
                          <SelectContent className="bg-black/95 border-white/10">
                            {point.slides.map((s, idx) => (
                              <SelectItem key={s.id} value={s.id} className="text-white">
                                {idx + 1}. {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-white/80">Fond</Label>
                          <Input
                            type="color"
                            value={selectedElement.style.bg}
                            onChange={(e) =>
                              updateElement(activeSlide.id, selectedElement.id, {
                                style: { ...selectedElement.style, bg: e.target.value },
                              } as any)
                            }
                            disabled={!isEditable}
                            className="w-full p-1 h-10 bg-white/5 border-white/10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Texte</Label>
                          <Input
                            type="color"
                            value={selectedElement.style.fg}
                            onChange={(e) =>
                              updateElement(activeSlide.id, selectedElement.id, {
                                style: { ...selectedElement.style, fg: e.target.value },
                              } as any)
                            }
                            disabled={!isEditable}
                            className="w-full p-1 h-10 bg-white/5 border-white/10"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white/80">Arrondi</Label>
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
                        <div className="text-xs text-white/50">{selectedElement.style.radius}px</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-white/60">{isEditable ? 'Cliquez un élément (ou ajoutez-en un).' : 'Mode lecture.'}</div>
              )}
            </div>
          )}
        </div>
      )}

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