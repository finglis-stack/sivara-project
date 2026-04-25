import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService, parseDocumentIVs } from '@/lib/encryption';
import { sivaraVM } from '@/lib/sivara-vm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Extension, mergeAttributes } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Image } from '@tiptap/extension-image';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

import {
  ArrowLeft, Download, Share2, Users, Loader2, Star, MoreVertical, Trash2, Copy, Shield, Lock,
  FileText, Briefcase, FolderOpen, BookOpen, Lightbulb, Target, TrendingUp, Users as UsersIcon,
  Calendar, CheckSquare, MessageSquare, Mail, Phone, Globe, Settings, Heart, Zap, Award,
  BarChart, PieChart, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3, Type, Check,
  Eye, LockKeyhole, Globe2, UserPlus, MousePointer2, Cloud, LogIn, FileKey, PenTool,
  MapPin, Laptop, KeyRound, ShieldCheck, Crosshair, BookType, Image as ImageIcon,
  Maximize, Minimize, Wand2, RefreshCcw, Upload, X
} from 'lucide-react';

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Toggle } from '@/components/ui/toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- NEW COMPONENTS ---
import { SivaraText } from '@/components/SivaraText';
import { ImageNodeView } from '@/components/ImageNodeView';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// --- CUSTOM EXTENSIONS ---
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize.replace('px', ''),
          renderHTML: (attributes) => {
            if (!attributes.fontSize) return {};
            return { style: `font-size: ${attributes.fontSize}px` };
          },
        },
      },
    }];
  },
});

// --- EXTENSION IMAGE ROBUSTE (FIX PERSISTANCE) ---
const AdvancedImage = Image.extend({
  // On surcharge addAttributes pour s'assurer que Tiptap sait lire/écrire nos données
  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      width: {
        default: '100%',
        // Lecture: on regarde le style width ou l'attribut width
        parseHTML: (element) => element.style.width || element.getAttribute('width'),
        // Ecriture: on ne fait rien ici, c'est géré dans renderHTML global
      },
      style: {
        default: '',
        // Lecture: on récupère tout le style inline
        parseHTML: (element) => element.getAttribute('style'),
      },
      textAlign: {
        default: 'center',
        // Lecture: on regarde le style text-align ou data-align
        parseHTML: (element) => element.style.textAlign || element.getAttribute('data-align'),
      },
    };
  },

  // C'est ICI que la magie opère pour la sauvegarde
  renderHTML({ HTMLAttributes }) {
    const { style, width, textAlign, ...rest } = HTMLAttributes;

    // On construit une chaîne CSS complète et valide
    const styles = [
      style, // Les filtres (blur, grayscale...)
      width ? `width: ${width}` : '', // La taille
      textAlign ? `text-align: ${textAlign}` : '', // L'alignement interne
      'display: block', // Force le block pour que les marges auto fonctionnent
      // Gestion des marges pour l'alignement visuel
      textAlign === 'center' ? 'margin-left: auto; margin-right: auto;' : '',
      textAlign === 'right' ? 'margin-left: auto; margin-right: 0;' : '',
      textAlign === 'left' ? 'margin-right: auto; margin-left: 0;' : '',
    ].filter(Boolean).join('; ');

    // On retourne une balise <img> standard avec tout dans l'attribut style
    return ['img', mergeAttributes(this.options.HTMLAttributes, rest, { 
      style: styles,
      'data-align': textAlign // Backup pour le parsing
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

// --- TYPES ---
interface Document {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  is_starred: boolean;
  updated_at: string;
  encryption_iv: string;
  icon?: string;
  color?: string;
  visibility: 'private' | 'limited' | 'public';
  public_permission: 'read' | 'write';
  share_secret_encrypted?: string | null;
  share_secret_iv?: string | null;
}

interface AccessEntry {
  id: string;
  email: string;
  permission: 'read' | 'write';
}

interface Collaborator {
  id: string;
  email: string;
  color: string;
  avatar_url?: string | null;
  name: string;
  online_at: number;
}

interface RemoteCursor {
  x: number;
  y: number;
  color: string;
  name: string;
  last_updated: number;
}

const CURSOR_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
const FONT_FAMILIES = [
  { name: 'Inter (Sans)', value: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Serif (Par défaut)', value: 'serif' },
  { name: 'Playfair Display', value: '"Playfair Display", serif' },
  { name: 'Merriweather', value: 'Merriweather, serif' },
  { name: 'Lora', value: 'Lora, serif' },
  { name: 'Courier Prime', value: '"Courier Prime", monospace' },
  { name: 'OpenDyslexic', value: 'OpenDyslexic, sans-serif' },
];
const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '30', '36', '48', '60', '72'];
const AVAILABLE_ICONS = [
  { name: 'FileText', icon: FileText }, { name: 'Briefcase', icon: Briefcase },
  { name: 'FolderOpen', icon: FolderOpen }, { name: 'BookOpen', icon: BookOpen },
  { name: 'Lightbulb', icon: Lightbulb }, { name: 'Target', icon: Target },
  { name: 'TrendingUp', icon: TrendingUp }, { name: 'UsersIcon', icon: UsersIcon },
  { name: 'Calendar', icon: Calendar }, { name: 'CheckSquare', icon: CheckSquare },
  { name: 'MessageSquare', icon: MessageSquare }, { name: 'Mail', icon: Mail },
  { name: 'Globe', icon: Globe }, { name: 'Settings', icon: Settings },
  { name: 'Heart', icon: Heart }, { name: 'Zap', icon: Zap },
  { name: 'Award', icon: Award }, { name: 'BarChart', icon: BarChart }
];
const COLOR_PALETTE = [
  { name: 'Bleu', value: '#3B82F6' }, { name: 'Violet', value: '#8B5CF6' },
  { name: 'Rose', value: '#EC4899' }, { name: 'Rouge', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' }, { name: 'Vert', value: '#10B981' },
  { name: 'Gris', value: '#6B7280' }
];

declare global {
  interface Window {
    google: any;
  }
}

const DocEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // State
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [isOwner, setIsOwner] = useState(false);
  const [decryptionError, setDecryptionError] = useState(false);
  const [userProfile, setUserProfile] = useState<{avatar_url: string | null, is_pro: boolean} | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  
  // UI Dialogs
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  // AI Review States
  const [aiReviewMode, setAiReviewMode] = useState(false);
  const [aiCorrections, setAiCorrections] = useState<{original: string; corrected: string; explanation: string; type: string; accepted: boolean | null}[]>([]);
  const [aiOriginalText, setAiOriginalText] = useState('');
  const [aiCorrectedText, setAiCorrectedText] = useState('');
  const [aiSelectionRange, setAiSelectionRange] = useState<{from: number; to: number} | null>(null);
  const [aiCorrectionPositions, setAiCorrectionPositions] = useState<{top: number; left: number; width: number}[]>([]);
  const aiLoadingRef = useRef(false);
  
  // AI States
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryPos, setSummaryPos] = useState({ x: window.innerWidth / 2 - 200, y: 150 });
  const [isDraggingSummary, setIsDraggingSummary] = useState(false);
  const summaryDragRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const startDragSummary = (e: React.PointerEvent) => {
    setIsDraggingSummary(true);
    summaryDragRef.current = { x: e.clientX, y: e.clientY, startX: summaryPos.x, startY: summaryPos.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const moveDragSummary = (e: React.PointerEvent) => {
    if (!isDraggingSummary) return;
    setSummaryPos({
      x: summaryDragRef.current.startX + (e.clientX - summaryDragRef.current.x),
      y: summaryDragRef.current.startY + (e.clientY - summaryDragRef.current.y)
    });
  };
  const endDragSummary = (e: React.PointerEvent) => {
    setIsDraggingSummary(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };
  
  // UI Inputs
  const [selectedIcon, setSelectedIcon] = useState('FileText');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'read' | 'write'>('read');
  
  // Image Inputs
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isImageUploading, setIsImageUploading] = useState(false);
  
  // Security Inputs (Export)
  const [exportPassword, setExportPassword] = useState('');
  const [restrictDevice, setRestrictDevice] = useState(false);
  const [restrictUsers, setRestrictUsers] = useState(false);
  const [restrictGeo, setRestrictGeo] = useState(false);
  const [geoRadius, setGeoRadius] = useState([50]); // km
  const [geoCenter, setGeoCenter] = useState<{lat: number, lng: number} | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const circleObjRef = useRef<any>(null);

  // --- SIVARA TEXT STATE ---
  const [showSivaraText, setShowSivaraText] = useState(false);

  const titleRef = useRef(title);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef('');
  const myColorRef = useRef(CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const shareSecretRef = useRef<string | null>(null);
  const anonIdRef = useRef(`anon_${Math.random().toString(36).substring(2, 9)}`);
  
  // Track latest user object for closures
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  // --- FIX: PREVENT RELOAD ON TAB SWITCH ---
  const isLoadedRef = useRef(false);

  useEffect(() => { titleRef.current = title; }, [title]);

  // Load persistence for Sivara Text
  useEffect(() => {
      if (!id || !user) return;
      const prefKey = `sivara-text-${id}-${user.id}`;
      const savedState = localStorage.getItem(prefKey);
      if (savedState === 'true') setShowSivaraText(true);
  }, [id, user]);

  const toggleSivaraText = () => {
      if (!id || !user) return;
      const newState = !showSivaraText;
      setShowSivaraText(newState);
      localStorage.setItem(`sivara-text-${id}-${user.id}`, String(newState));
      if (newState) showSuccess("Sivara Text activé");
  };

  // Load Google Maps Script for Geofencing
  useEffect(() => {
      if (showExportDialog && restrictGeo && !window.google) {
          const loadMaps = async () => {
              const { data } = await supabase.functions.invoke('get-maps-key');
              if (data?.key) {
                  const script = window.document.createElement('script');
                  script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}`;
                  script.async = true;
                  script.onload = () => initMap();
                  window.document.head.appendChild(script);
              }
          };
          loadMaps();
      } else if (showExportDialog && restrictGeo && window.google) {
          setTimeout(initMap, 100);
      }
  }, [showExportDialog, restrictGeo]);

  useEffect(() => {
      if (circleObjRef.current && geoRadius.length > 0) {
          const currentMapRadius = circleObjRef.current.getRadius();
          const targetRadius = geoRadius[0] * 1000; 
          
          if (Math.abs(currentMapRadius - targetRadius) > 100) {
              circleObjRef.current.setRadius(targetRadius);
          }
      }
  }, [geoRadius]);

  const initMap = async () => {
      if (!mapRef.current) return;
      
      let initialPos = { lat: 45.5017, lng: -73.5673 }; // Default MTL

      try {
          const { data, error } = await supabase.functions.invoke('sivara-kernel', {
              body: { action: 'locate_me' }
          });
          if (!error && data?.lat) {
              initialPos = { lat: data.lat, lng: data.lng };
              showSuccess(`Position Internet détectée : ${data.city}`);
          }
      } catch (e) { console.error("Locate error", e); }

      setGeoCenter(initialPos);

      const map = new window.google.maps.Map(mapRef.current, {
          center: initialPos,
          zoom: 9,
          disableDefaultUI: true,
          streetViewControl: false,
      });
      mapObjRef.current = map;

      new window.google.maps.Marker({
          position: initialPos,
          map: map,
          title: "Votre IP (Centre de données)",
          icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: "#EF4444",
              fillOpacity: 1,
              strokeWeight: 0
          }
      });

      const circle = new window.google.maps.Circle({
          strokeColor: '#3B82F6',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#3B82F6',
          fillOpacity: 0.35,
          map,
          center: initialPos,
          radius: geoRadius[0] * 1000, 
          editable: true,
          draggable: true
      });
      circleObjRef.current = circle;

      circle.addListener('center_changed', () => {
          const c = circle.getCenter();
          setGeoCenter({ lat: c.lat(), lng: c.lng() });
      });

      circle.addListener('radius_changed', () => {
          const r = circle.getRadius();
          setGeoRadius([Math.round(r / 1000)]);
      });
  };

  const recenterMap = async () => {
      if (!mapObjRef.current || !circleObjRef.current) return;
      try {
          const { data } = await supabase.functions.invoke('sivara-kernel', {
              body: { action: 'locate_me' }
          });
          if (data?.lat) {
              const pos = { lat: data.lat, lng: data.lng };
              mapObjRef.current.panTo(pos);
              circleObjRef.current.setCenter(pos);
              setGeoCenter(pos);
              showSuccess(`Recentré sur : ${data.city}`);
          }
      } catch (e) {}
  };

  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, FontFamily, FontSize, AdvancedImage,
      TextAlign.configure({ types: ['heading', 'paragraph'] }), // Image gérée par NodeView
      Placeholder.configure({ placeholder: 'Commencez à écrire...' }),
    ],
    content: '',
    editable: false, 
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none outline-none focus:outline-none min-h-[90vh] bg-white py-8 px-4 sm:px-12 md:px-16 shadow-sm mb-8 rounded-lg',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      contentRef.current = html;
      
      if (!isUpdatingFromRemoteRef.current) {
        const broadcastSecurely = async () => {
            const currentUser = userRef.current;
            const senderId = currentUser ? currentUser.id : anonIdRef.current;
            
            if (channelRef.current) {
                try {
                    const { encrypted, iv } = await encryptionService.encrypt(html);
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'content_update',
                        payload: { content: encrypted, iv: iv, sender: senderId }
                    });
                } catch (e) { console.error("Erreur chiffrement broadcast", e); }
            }
        };
        broadcastSecurely();

        if (permission === 'write') {
          handleContentChange(html);
        }
      }
    },
  });

  useEffect(() => {
    if (editor && !isLoading) {
      editor.setEditable(permission === 'write');
    }
  }, [editor, permission, isLoading]);

  useEffect(() => {
    if (!id || authLoading) return;
    
    // --- FIX: PREVENT RELOAD ON TAB SWITCH ---
    // Si on a déjà chargé le document pour cet ID, on ne le recharge pas
    // sauf si l'ID change (navigation vers un autre doc)
    if (isLoadedRef.current && document?.id === id) {
        return;
    }

    const init = async () => {
      if (!window.document.getElementById('sivara-google-fonts')) {
        const link = window.document.createElement('link');
        link.id = 'sivara-google-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime&family=Inter:wght@300;400;500;600&family=Lato:wght@300;400;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@300;400;600&family=Open+Sans:wght@300;400;600&family=Playfair+Display:wght@400;600&family=Roboto:wght@300;400;500&display=swap';
        window.document.head.appendChild(link);
      }

      if (user) {
        const { data } = await supabase.from('profiles').select('avatar_url, is_pro').eq('id', user.id).single();
        setUserProfile(data as any);
      }

      await fetchDocumentAndInitCrypto();
      isLoadedRef.current = true; // Marquer comme chargé
    };
    init();
    
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      // Clear per-document share key when leaving the editor
      encryptionService.clearDocumentKey();
      shareSecretRef.current = null;
    };
  }, [id, user, editor, authLoading]); // On garde les dépendances mais on bloque avec la ref

  useEffect(() => { return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; } }; }, [id]);
  
  useEffect(() => { 
      // Si le document est chargé et déchiffré, lancer la sync (même si anon)
      if (id && !isLoading && !decryptionError && !channelRef.current) { 
          setTimeout(() => setupRealtime(), 500);
      } 
  }, [id, user, isLoading, decryptionError, userProfile]);

  const setupRealtime = () => {
    if (!id) return;
    
    const myId = userRef.current ? userRef.current.id : anonIdRef.current;
    
    const myPresenceState = { 
        id: myId, 
        email: userRef.current?.email || '', 
        color: myColorRef.current, 
        avatar_url: userProfile?.avatar_url, 
        name: userRef.current ? (userRef.current.email?.split('@')[0] || 'Anonyme') : 'Invité', 
        online_at: Date.now() 
    };
    
    if (channelRef.current) { 
        channelRef.current.track(myPresenceState); 
        return; 
    }
    
    const channel = supabase.channel(`doc:${id}`, { config: { presence: { key: myId, }, }, });
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users: Collaborator[] = [];
        for (const key in newState) {
           const presences = newState[key] as any[];
           if (presences && presences.length > 0) {
             const userData = presences[0]; 
             if (userData.id !== user.id) {
                users.push({ 
                    id: userData.id, 
                    email: userData.email, 
                    color: userData.color, 
                    avatar_url: userData.avatar_url, 
                    name: userData.name, 
                    online_at: userData.online_at 
                });
             }
           }
        }
        setCollaborators(users);
      })
      .on('broadcast', { event: 'cursor-pos' }, ({ payload }) => {
        if (payload.id !== user.id) {
            setCursors(prev => ({ ...prev, [payload.id]: { x: payload.x, y: payload.y, color: payload.color, name: payload.name, last_updated: Date.now() } }));
        }
      })
      .on('broadcast', { event: 'title_update' }, ({ payload }) => {
        const myId = userRef.current ? userRef.current.id : anonIdRef.current;
        if (payload.sender !== myId) {
           setTitle(payload.title);
        }
      })
      .on('broadcast', { event: 'content_update' }, async ({ payload }) => {
        const myId = userRef.current ? userRef.current.id : anonIdRef.current;
        if (payload.sender !== myId && editor) {
           isUpdatingFromRemoteRef.current = true;
           try {
               const decryptedContent = await encryptionService.decrypt(payload.content, payload.iv);
               const { from, to } = editor.state.selection;
               editor.commands.setContent(decryptedContent);
               editor.commands.setTextSelection({ from, to });
           } catch (e) { console.error("Broadcast decrypt error", e); }
           
           // Slight delay to allow internal editor updates to finish
           setTimeout(() => isUpdatingFromRemoteRef.current = false, 50);
        }
      })
      .subscribe(async (status) => { if (status === 'SUBSCRIBED') { await channel.track(myPresenceState); } });
    
    channelRef.current = channel;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!channelRef.current || !editorRef.current) return;
    const now = Date.now();
    if ((editorRef.current as any).lastMove && now - (editorRef.current as any).lastMove < 30) return;
    (editorRef.current as any).lastMove = now;
    const rect = editorRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + editorRef.current.scrollTop;
    
    const myId = userRef.current ? userRef.current.id : anonIdRef.current;
    const myName = userRef.current ? (userRef.current.email?.split('@')[0] || 'Anonyme') : 'Invité';
    
    channelRef.current.send({ type: 'broadcast', event: 'cursor-pos', payload: { id: myId, name: myName, color: myColorRef.current, x, y } });
  };

  useEffect(() => {
     const interval = setInterval(() => {
        const now = Date.now();
        setCursors(prev => {
            const next = { ...prev };
            let changed = false;
            Object.keys(next).forEach(key => {
                if (now - next[key].last_updated > 10000) { delete next[key]; changed = true; }
            });
            return changed ? next : prev;
        });
     }, 5000);
     return () => clearInterval(interval);
  }, []);

  const fetchDocumentAndInitCrypto = async () => {
    try {
      const { data: doc, error } = await supabase.from('documents').select('*').eq('id', id).single();
      if (error || !doc) {
        if (!user) {
          const currentUrl = window.location.href;
          const loginUrl = `https://account.sivara.ca/login?returnTo=${encodeURIComponent(currentUrl)}`;
          window.location.href = loginUrl;
          return;
        }
        throw new Error("Document inaccessible");
      }

      // --- SHARE KEY RESOLUTION ---
      // 1. Check URL fragment for #key=XXXX (collaborator with share link)
      // 2. If owner and doc is shared: unwrap share secret from DB using DEK
      // 3. Otherwise: private doc, use DEK directly
      const hash = window.location.hash || '';
      const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const urlShareKey = params.get('key');

      if (urlShareKey && urlShareKey.length > 8) {
        // Collaborator with share link: derive share key from URL secret
        shareSecretRef.current = urlShareKey;
        await encryptionService.setDocumentShareKey(urlShareKey);
        // Also load DEK if authenticated (needed for some operations)
        if (user) {
          try { await encryptionService.ensureReady(); } catch (_) {}
        }
      } else if (doc.share_secret_encrypted && doc.share_secret_iv && user) {
        // Owner or authenticated user on a shared doc: unwrap share secret with DEK
        await encryptionService.ensureReady();
        try {
          const shareSecret = await encryptionService.decryptWithMasterKey(
            doc.share_secret_encrypted, doc.share_secret_iv
          );
          shareSecretRef.current = shareSecret;
          await encryptionService.setDocumentShareKey(shareSecret);
        } catch (e) {
          // If unwrapping fails, try DEK directly (backward compat for old docs)
          console.warn('Share secret unwrap failed, falling back to DEK', e);
        }
      } else {
        // Private doc or no share secret: use DEK
        if (user) {
          await encryptionService.ensureReady();
        }
      }

      const isDocOwner = user?.id === doc.owner_id;
      setIsOwner(isDocOwner);

      let userPermission: 'read' | 'write' = 'read';

      if (isDocOwner) {
        userPermission = 'write';
      } else {
        let explicitPermission = null;
        if (user && user.email) {
          const { data: accessEntries } = await supabase
            .from('document_access')
            .select('email, permission')
            .eq('document_id', id);

          if (accessEntries) {
            const myAccess = accessEntries.find(
              (a) => a.email.toLowerCase() === user.email!.toLowerCase()
            );
            if (myAccess) {
              explicitPermission = myAccess.permission;
            }
          }
        }

        if (explicitPermission === 'write') userPermission = 'write';
        else if (doc.visibility === 'public' && doc.public_permission === 'write') userPermission = 'write';
        else if (explicitPermission === 'read') userPermission = 'read';
        else if (doc.visibility === 'public') userPermission = 'read';
        else if (urlShareKey && urlShareKey.length > 8) userPermission = 'read';
        else throw new Error("Document inaccessible");
      }

      setPermission(userPermission);

      let decryptedTitle = doc.title;
      let decryptedContent = doc.content;

      try {
        const { titleIv, contentIv } = parseDocumentIVs(doc.encryption_iv);
        decryptedTitle = await encryptionService.decrypt(doc.title, titleIv);
        decryptedContent = await encryptionService.decrypt(doc.content, contentIv);
      } catch (e: any) {
        // Fallback: try with DEK directly (backward compat for old private docs)
        if (user) {
          try {
            encryptionService.clearDocumentKey();
            encryptionService.invalidateCache();
            await encryptionService.ensureReady();
            const { titleIv: tIv2, contentIv: cIv2 } = parseDocumentIVs(doc.encryption_iv);
            decryptedTitle = await encryptionService.decrypt(doc.title, tIv2);
            decryptedContent = await encryptionService.decrypt(doc.content, cIv2);
            // If DEK fallback worked, this is an old private doc — clear shareSecretRef
            shareSecretRef.current = null;
          } catch {
            setDecryptionError(true);
            decryptedTitle = "Document sécurisé";
            decryptedContent = "";
          }
        } else {
          setDecryptionError(true);
          decryptedTitle = "Document sécurisé";
          decryptedContent = "";
        }
      }

      setDocument(doc);
      setTitle(decryptedTitle);
      contentRef.current = decryptedContent;
      setSelectedIcon(doc.icon || 'FileText');
      setSelectedColor(doc.color || '#3B82F6');

      if (editor) {
        editor.commands.setContent(decryptedContent);
        editor.setEditable(userPermission === 'write');
      }

      if (isDocOwner) fetchAccessList();
    } catch (error) {
      console.error(error);
      showError("Document inaccessible ou privé");
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccessList = async () => { const { data } = await supabase.from('document_access').select('*').eq('document_id', id); setAccessList(data || []); };
  
  const handleSave = async (key: string, value: string) => {
    if (!id || permission !== 'write') return;
    try {
      setIsSaving(true);
      const currentTitle = titleRef.current;
      const currentContent = editor?.getHTML() || '';

      // Encrypt with active key (share key if shared, DEK if private)
      const { encrypted: encTitle, iv: titleIv } = await encryptionService.encrypt(currentTitle);
      const { encrypted: encContent, iv: contentIv } = await encryptionService.encrypt(currentContent);

      await supabase.from('documents').update({
        title: encTitle,
        content: encContent,
        encryption_iv: JSON.stringify({ t: titleIv, c: contentIv }),
        updated_at: new Date().toISOString(),
        ...((key === 'icon') ? { icon: value } : {}),
        ...((key === 'color') ? { color: value } : {}),
      }).eq('id', id);
    } catch(e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleContentChange = (content: string) => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = setTimeout(() => handleSave('content', content), 500); };
  
  const updateVisibility = async (visibility: 'private' | 'limited' | 'public') => {
    if (!document || !user) return;
    const wasPrivate = document.visibility === 'private';
    const goingPrivate = visibility === 'private';

    try {
      if (wasPrivate && !goingPrivate) {
        // --- TRANSITION: PRIVATE → SHARED ---
        // 1. Generate share secret
        const shareSecret = encryptionService.generateShareSecret();
        shareSecretRef.current = shareSecret;

        // 2. Wrap share secret with DEK
        const { encrypted: ssEnc, iv: ssIv } = await encryptionService.encryptWithMasterKey(shareSecret);

        // 3. Decrypt current content with DEK
        const { titleIv, contentIv } = parseDocumentIVs(document.encryption_iv);
        const plainTitle = await encryptionService.decrypt(document.title, titleIv);
        const plainContent = await encryptionService.decrypt(document.content, contentIv);

        // 4. Switch to share key
        await encryptionService.setDocumentShareKey(shareSecret);

        // 5. Re-encrypt with share key
        const { encrypted: encTitle, iv: newTitleIv } = await encryptionService.encrypt(plainTitle);
        const { encrypted: encContent, iv: newContentIv } = await encryptionService.encrypt(plainContent);

        // 6. Save everything
        await supabase.from('documents').update({
          visibility,
          title: encTitle,
          content: encContent,
          encryption_iv: JSON.stringify({ t: newTitleIv, c: newContentIv }),
          share_secret_encrypted: ssEnc,
          share_secret_iv: ssIv,
          updated_at: new Date().toISOString(),
        }).eq('id', id);

        setDocument({ ...document, visibility, title: encTitle, content: encContent,
          encryption_iv: JSON.stringify({ t: newTitleIv, c: newContentIv }),
          share_secret_encrypted: ssEnc, share_secret_iv: ssIv });
        showSuccess('Document partagé et rechiffré');

      } else if (!wasPrivate && goingPrivate) {
        // --- TRANSITION: SHARED → PRIVATE ---
        // 1. Decrypt with current share key
        const { titleIv, contentIv } = parseDocumentIVs(document.encryption_iv);
        const plainTitle = await encryptionService.decrypt(document.title, titleIv);
        const plainContent = await encryptionService.decrypt(document.content, contentIv);

        // 2. Switch back to DEK
        encryptionService.clearDocumentKey();
        shareSecretRef.current = null;

        // 3. Re-encrypt with DEK
        const { encrypted: encTitle, iv: newTitleIv } = await encryptionService.encrypt(plainTitle);
        const { encrypted: encContent, iv: newContentIv } = await encryptionService.encrypt(plainContent);

        // 4. Save and clear share columns
        await supabase.from('documents').update({
          visibility,
          title: encTitle,
          content: encContent,
          encryption_iv: JSON.stringify({ t: newTitleIv, c: newContentIv }),
          share_secret_encrypted: null,
          share_secret_iv: null,
          updated_at: new Date().toISOString(),
        }).eq('id', id);

        setDocument({ ...document, visibility, title: encTitle, content: encContent,
          encryption_iv: JSON.stringify({ t: newTitleIv, c: newContentIv }),
          share_secret_encrypted: null, share_secret_iv: null });
        showSuccess('Document redevenu privé et rechiffré');

      } else {
        // Same sharing state: just update visibility (limited ↔ public)
        await supabase.from('documents').update({ visibility }).eq('id', id);
        setDocument({ ...document, visibility });
        showSuccess('Visibilité changée');
      }
    } catch (e: any) {
      console.error('Visibility change error:', e);
      showError('Erreur lors du changement de visibilité');
    }
  };
  
  const inviteUser = async () => { 
      if (!newInviteEmail) return; 
      const { error } = await supabase.from('document_access').insert({ 
          document_id: id, 
          email: newInviteEmail.toLowerCase().trim(), 
          permission: invitePermission 
      }); 
      if (error) showError("Erreur invitation"); 
      else { showSuccess("Invitation envoyée"); setNewInviteEmail(''); fetchAccessList(); } 
  };
  
  const removeAccess = async (accessId: string) => { await supabase.from('document_access').delete().eq('id', accessId); fetchAccessList(); };
  
  const copyShareLink = async () => {
    if (!document || !user) return;
    try {
      let shareSecret = shareSecretRef.current;

      // If no share secret yet (doc was private), transition to shared
      if (!shareSecret) {
        if (document.visibility === 'private') {
          // Auto-transition to limited visibility
          await updateVisibility('limited');
        }
        shareSecret = shareSecretRef.current;
      }

      if (!shareSecret && document.share_secret_encrypted && document.share_secret_iv) {
        // Recover from DB
        await encryptionService.ensureReady();
        shareSecret = await encryptionService.decryptWithMasterKey(
          document.share_secret_encrypted, document.share_secret_iv
        );
        shareSecretRef.current = shareSecret;
      }

      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocal
        ? `${window.location.origin}/${id}?app=docs`
        : `https://docs.sivara.ca/${id}`;
      const link = shareSecret ? `${baseUrl}#key=${shareSecret}` : baseUrl;
      navigator.clipboard.writeText(link);
      showSuccess('Lien sécurisé copié !');
    } catch (e) {
      console.error('Copy share link error:', e);
      showError('Erreur lors de la copie du lien');
    }
  };
  const handleLogin = () => { 
    const currentUrl = window.location.href; 
    window.location.href = `https://account.sivara.ca/login?returnTo=${encodeURIComponent(currentUrl)}`; 
  };

  const handleExportSivara = async () => {
    if (!document || !user) return;
    setIsExporting(true);
    try {
        let encryptedTitle = document.title;
        let encryptedContent = document.content;
        let titleIv = '';
        let contentIv = '';
        let salt = null;
        let exportKeyToEmbed = null;

        if (exportPassword) {
            const saltValue = crypto.randomUUID();
            await encryptionService.initializeDirect(exportPassword, saltValue);
            const { encrypted: encTitle, iv: tIv } = await encryptionService.encrypt(titleRef.current);
            const { encrypted: encContent, iv: cIv } = await encryptionService.encrypt(contentRef.current);
            encryptedTitle = encTitle;
            encryptedContent = encContent;
            titleIv = tIv;
            contentIv = cIv;
            salt = saltValue;
            encryptionService.invalidateCache();
            await encryptionService.ensureReady();
        } else {
            // SECURITY (v8): Use user.id derived key for .sivara — owner-bound via direct PBKDF2
            await encryptionService.initializeDirect(user.id);
            const { encrypted: encTitle, iv: tIv } = await encryptionService.encrypt(titleRef.current);
            const { encrypted: encContent, iv: cIv } = await encryptionService.encrypt(contentRef.current);
            encryptedTitle = encTitle;
            encryptedContent = encContent;
            titleIv = tIv;
            contentIv = cIv;
            exportKeyToEmbed = user.id;
            
            // Restore DEK-based encryption for Supabase session
            encryptionService.invalidateCache();
            await encryptionService.ensureReady();
        }

        const securityContext: any = {};

        if (restrictDevice) {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            securityContext.allowed_fingerprints = [result.visitorId];
        }

        if (restrictUsers) {
            const allowedEmails = accessList.map(a => a.email.toLowerCase());
            allowedEmails.push(user.email!.toLowerCase());
            securityContext.allowed_emails = allowedEmails;
        }

        if (restrictGeo && geoCenter) {
            securityContext.geofence = {
                lat: geoCenter.lat,
                lng: geoCenter.lng,
                radius_km: geoRadius[0]
            };
        }

        const payload = {
            encrypted_title: encryptedTitle,
            encrypted_content: encryptedContent,
            title_iv: titleIv,
            content_iv: contentIv,
            icon: document.icon || 'FileText',
            color: document.color || '#3B82F6',
            salt: salt,
            security: securityContext,
            embedded_key: exportKeyToEmbed,
            user_secret: exportPassword || undefined
        };

        const blob = await sivaraVM.compile(payload);
        
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `secure-${document.id.slice(0, 8)}.sivara`;
        a.click();
        
        showSuccess("Exporté et sécurisé par Sivara Kernel");
        setShowExportDialog(false);
        setExportPassword('');
    } catch (e: any) {
        console.error(e);
        showError(e.message || "Erreur lors de l'exportation");
    } finally {
        setIsExporting(false);
        if (user) {
            encryptionService.invalidateCache();
            await encryptionService.ensureReady();
            // Restore document share key if we were on a shared doc
            if (shareSecretRef.current) {
              await encryptionService.setDocumentShareKey(shareSecretRef.current);
            }
        }
    }
  };

  // Compute inline positions for correction tooltips
  useEffect(() => {
    if (!aiReviewMode || !editor || !editorRef.current || aiCorrections.length === 0) {
      setAiCorrectionPositions([]);
      return;
    }
    const computePositions = () => {
      const scrollContainer = editorRef.current;
      if (!scrollContainer) return;
      const containerRect = scrollContainer.getBoundingClientRect();
      const positions: {top: number; left: number; width: number}[] = [];
      const docText = editor.getText();
      
      for (const correction of aiCorrections) {
        // Find the original word in the editor text
        const textIndex = docText.indexOf(correction.original);
        if (textIndex === -1) { positions.push({ top: 0, left: 0, width: 0 }); continue; }
        // Convert text offset to ProseMirror position (add 1 for doc node offset)
        let pmPos = 0;
        let charCount = 0;
        editor.state.doc.descendants((node, pos) => {
          if (node.isText && pmPos === 0) {
            const nodeText = node.text || '';
            if (charCount + nodeText.length > textIndex) {
              pmPos = pos + (textIndex - charCount);
              return false;
            }
            charCount += nodeText.length;
          } else if (node.isBlock && node.childCount === 0 && pmPos === 0) {
            // empty block counts as nothing
          }
          return pmPos === 0;
        });
        if (pmPos === 0 && textIndex > 0) { positions.push({ top: 0, left: 0, width: 0 }); continue; }
        try {
          const startCoords = editor.view.coordsAtPos(pmPos);
          const endCoords = editor.view.coordsAtPos(pmPos + correction.original.length);
          positions.push({
            top: startCoords.top - containerRect.top + scrollContainer.scrollTop - 80,
            left: startCoords.left - containerRect.left,
            width: Math.max(endCoords.right - startCoords.left, 40),
          });
        } catch {
          positions.push({ top: 0, left: 0, width: 0 });
        }
      }
      setAiCorrectionPositions(positions);
    };
    // Small delay to let editor render
    const timer = setTimeout(computePositions, 100);
    return () => clearTimeout(timer);
  }, [aiReviewMode, aiCorrections, editor]);

  const handleAiAction = async (action: 'revise' | 'summarize') => {
    if (!editor || !userProfile?.is_pro || aiLoadingRef.current) return;
    setAiLoading(true);
    aiLoadingRef.current = true;
    let text = '';
    
    if (action === 'revise') {
      const { from, to } = editor.state.selection;
      text = editor.state.doc.textBetween(from, to, ' ');
      if (!text) {
        setAiLoading(false);
        aiLoadingRef.current = false;
        return showError("Veuillez sélectionner du texte à réviser.");
      }
      // Lock the editor during AI review
      editor.setEditable(false);
      setAiSelectionRange({ from, to });
    } else if (action === 'summarize') {
      text = editor.getText();
    }

    try {
      const { data, error } = await supabase.functions.invoke('doc-ai', {
        body: { action, text }
      });

      if (error || !data?.result) throw new Error(error?.message || "Erreur IA");

      if (action === 'revise') {
        if (data.corrections && data.corrections.length > 0) {
          setAiCorrections(data.corrections.map((c: any) => ({ ...c, accepted: null })));
          setAiOriginalText(data.original_text || text);
          setAiCorrectedText(data.result);
          setAiReviewMode(true);
        } else {
          editor.setEditable(permission === 'write');
          showSuccess("Aucune erreur détectée ! 🎉");
        }
      } else if (action === 'summarize') {
        setSummaryText(data.result);
        setSummaryPos({ x: window.innerWidth / 2 - 200, y: 150 });
        showSuccess("Résumé généré !");
      }
    } catch (e: any) {
      console.error(e);
      showError("Échec de l'assistant IA.");
      if (action === 'revise') {
        editor.setEditable(permission === 'write');
      }
    } finally {
      setAiLoading(false);
      aiLoadingRef.current = false;
    }
  };

  const handleAcceptCorrection = (index: number) => {
    setAiCorrections(prev => prev.map((c, i) => i === index ? { ...c, accepted: true } : c));
  };

  const handleRejectCorrection = (index: number) => {
    setAiCorrections(prev => prev.map((c, i) => i === index ? { ...c, accepted: false } : c));
  };

  const handleApplyReview = () => {
    if (!editor || !aiSelectionRange) return;
    
    // Build the final text by applying only accepted corrections
    let finalText = aiOriginalText;
    // Sort corrections by position in text (reverse to maintain indices)
    const acceptedCorrections = aiCorrections
      .filter(c => c.accepted === true)
      .reverse();
    
    for (const correction of acceptedCorrections) {
      const idx = finalText.lastIndexOf(correction.original);
      if (idx !== -1) {
        finalText = finalText.substring(0, idx) + correction.corrected + finalText.substring(idx + correction.original.length);
      }
    }
    
    // Replace the selected text with corrected version
    editor.chain()
      .focus()
      .deleteRange(aiSelectionRange)
      .insertContent(finalText)
      .run();
    
    // Exit review mode
    setAiReviewMode(false);
    setAiCorrections([]);
    setAiOriginalText('');
    setAiCorrectedText('');
    setAiSelectionRange(null);
    editor.setEditable(permission === 'write');
    showSuccess("Corrections appliquées !");
  };

  const handleRejectAllReview = () => {
    if (!editor) return;
    // Cancel review mode — keep original text
    setAiReviewMode(false);
    setAiCorrections([]);
    setAiOriginalText('');
    setAiCorrectedText('');
    setAiSelectionRange(null);
    editor.setEditable(permission === 'write');
  };
  
  const CurrentIcon = AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.icon || FileText;
  const getIconTextColor = (bgColor: string) => { const hex = bgColor.replace('#', ''); const r = parseInt(hex.substr(0, 2), 16); const g = parseInt(hex.substr(2, 2), 16); const b = parseInt(hex.substr(4, 2), 16); return ((r * 299 + g * 587 + b * 114) / 1000) > 155 ? '#1F2937' : '#FFFFFF'; };

  // --- IMAGE HANDLING ---
  const addImageUrl = () => {
    if (imageUrlInput) {
      editor?.chain().focus().setImage({ src: imageUrlInput }).run();
      setImageUrlInput('');
      setShowImageDialog(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check Quota
    const isPro = userProfile?.is_pro || false;
    const maxSize = isPro ? 35 * 1024 * 1024 : 15 * 1024 * 1024; // 35MB vs 15MB

    if (file.size > maxSize) {
        showError(`Fichier trop volumineux. Limite: ${isPro ? '35MB' : '15MB'}`);
        return;
    }

    setIsImageUploading(true);
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        // On utilise le bucket 'doc-assets' (à créer si inexistant, ou fallback sur 'covers' si besoin)
        // Pour l'instant on tente 'doc-assets'
        const { error: uploadError } = await supabase.storage
            .from('doc-assets')
            .upload(fileName, file);

        if (uploadError) {
            // Fallback si le bucket n'existe pas encore (pour éviter de casser la démo)
            console.warn("Bucket doc-assets manquant, tentative sur covers...");
             const { error: fallbackError } = await supabase.storage
                .from('covers')
                .upload(`doc-images/${fileName}`, file);
             
             if (fallbackError) throw fallbackError;
             
             const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(`doc-images/${fileName}`);
             editor?.chain().focus().setImage({ src: publicUrl }).run();
        } else {
             const { data: { publicUrl } } = supabase.storage.from('doc-assets').getPublicUrl(fileName);
             editor?.chain().focus().setImage({ src: publicUrl }).run();
        }
        
        setShowImageDialog(false);
        showSuccess("Image insérée");
    } catch (error: any) {
        console.error(error);
        showError("Erreur lors de l'upload");
    } finally {
        setIsImageUploading(false);
    }
  };

  if (isLoading || authLoading)
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );

  if (decryptionError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full border border-gray-200">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LockKeyhole className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contenu sécurisé inaccessible</h1>
          <p className="text-gray-500 mb-6">
            Ce document est chiffré et la clé de déchiffrement n'a pas pu être générée correctement.
          </p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6] pt-[env(safe-area-inset-top)]">
      {/* SIVARA TEXT COMPONENT (uniquement si connecté) */}
      {user && (
        <SivaraText
          editor={editor}
          isOpen={showSivaraText}
          onClose={() => toggleSivaraText()}
          userId={user.id}
        />
      )}

      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 overflow-hidden">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
              
              <button onClick={() => isOwner && setShowIconPicker(true)} className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isOwner ? 'hover:opacity-80' : ''}`} style={{ backgroundColor: selectedColor }}>
                <CurrentIcon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: getIconTextColor(selectedColor) }} />
              </button>

              <Input 
                value={title} 
                onChange={(e) => { 
                  const newTitle = e.target.value;
                  setTitle(newTitle); 
                  
                  // Broadcast immédiat du titre aux autres utilisateurs
                  if (channelRef.current && user) {
                    channelRef.current.send({
                      type: 'broadcast',
                      event: 'title_update',
                      payload: { title: newTitle, sender: user.id }
                    });
                  }
                  
                  // Sauvegarde avec debounce
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = setTimeout(() => {
                    handleSave('title', newTitle);
                  }, 500);
                }} 
                className="text-base sm:text-lg font-medium border-0 focus-visible:ring-0 px-2 max-w-[150px] sm:max-w-md bg-transparent truncate" 
                readOnly={!isOwner} 
              />
              
              <Badge variant="outline" className="hidden md:flex gap-1">
                 {document?.visibility === 'public' ? <Globe2 className="h-3 w-3" /> : document?.visibility === 'limited' ? <Users className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
                 {document?.visibility === 'public' ? 'Public' : document?.visibility === 'limited' ? 'Limité' : 'Barré'}
              </Badge>

              <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-[20px] shrink-0">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cloud className="h-3 w-3" />}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-3 shrink-0 ml-2">
              <div className="flex -space-x-2 mr-1 sm:mr-4">
                  {collaborators.slice(0, 3).map(collab => (
                      <div key={collab.id} className="relative group">
                          <Avatar className="h-6 w-6 sm:h-8 sm:w-8 border-2 border-white ring-2" style={{ '--tw-ring-color': collab.color } as any}>
                              {collab.avatar_url ? <AvatarImage src={collab.avatar_url} alt={collab.name} /> : null}
                              <AvatarFallback style={{ backgroundColor: collab.color }} className="text-white text-[10px] sm:text-xs">{collab.name.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                      </div>
                  ))}
              </div>

              {!user && <Button variant="outline" size="sm" onClick={handleLogin} className="gap-2 h-8 text-xs"><LogIn className="h-3 w-3" /> <span className="hidden sm:inline">Connexion</span></Button>}

              {isOwner && <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-8 sm:h-9 px-2 sm:px-4" onClick={() => setShowShareDialog(true)}><Share2 className="h-3 w-3 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Partager</span></Button>}
              
              <Button 
                variant={showSivaraText ? "secondary" : "ghost"} 
                size="icon" 
                onClick={toggleSivaraText}
                className={`h-8 w-8 ${showSivaraText ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`}
                title="Sivara Text (Assistant Intelligent)"
              >
                <Type className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.print()}><Download className="mr-2 h-4 w-4" /> Exporter PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowExportDialog(true)}><FileKey className="mr-2 h-4 w-4 text-blue-600" /> Exporter .sivara</DropdownMenuItem>
                  {isOwner && <DropdownMenuItem className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        
        {permission === 'write' && (
            <div className="border-t border-gray-200 bg-[#F8F9FA] px-2 sm:px-4 py-2 flex justify-start sm:justify-center items-center gap-2 shadow-inner overflow-x-auto no-scrollbar">
                <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 px-2 py-1 gap-1 sm:gap-2 min-w-max">
                    <Select value={editor?.getAttributes('textStyle').fontFamily || 'Inter, sans-serif'} onValueChange={(val) => editor?.chain().focus().setFontFamily(val).run()}>
                        <SelectTrigger className="w-[100px] sm:w-[140px] h-8 text-xs border-none shadow-none hover:bg-gray-100"><SelectValue placeholder="Police" /></SelectTrigger>
                        <SelectContent>{FONT_FAMILIES.map(font => <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>{font.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="w-px h-4 bg-gray-200"></div>
                    <Select value={editor?.getAttributes('textStyle').fontSize || ''} onValueChange={(val) => editor?.chain().focus().setMark('textStyle', { fontSize: val }).run()}>
                        <SelectTrigger className="w-[50px] sm:w-[70px] h-8 text-xs border-none shadow-none hover:bg-gray-100"><SelectValue placeholder="16" /></SelectTrigger>
                        <SelectContent>{FONT_SIZES.map(size => <SelectItem key={size} value={size}>{size}px</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="w-px h-4 bg-gray-200"></div>
                    <Toggle size="sm" className="h-7 w-7 sm:h-9 sm:w-9" pressed={editor?.isActive('bold')} onPressedChange={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-3 w-3 sm:h-4 sm:w-4" /></Toggle>
                    <Toggle size="sm" className="h-7 w-7 sm:h-9 sm:w-9" pressed={editor?.isActive('italic')} onPressedChange={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-3 w-3 sm:h-4 sm:w-4" /></Toggle>
                    <Toggle size="sm" className="h-7 w-7 sm:h-9 sm:w-9" pressed={editor?.isActive('underline')} onPressedChange={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3 w-3 sm:h-4 sm:w-4" /></Toggle>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    <Toggle size="sm" className="h-7 w-7 sm:h-9 sm:w-9" pressed={editor?.isActive({ textAlign: 'left' })} onPressedChange={() => editor?.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-3 w-3 sm:h-4 sm:w-4" /></Toggle>
                    <Toggle size="sm" className="h-7 w-7 sm:h-9 sm:w-9" pressed={editor?.isActive({ textAlign: 'center' })} onPressedChange={() => editor?.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-3 w-3 sm:h-4 sm:w-4" /></Toggle>
                    <Toggle size="sm" className="h-7 w-7 sm:h-9 sm:w-9" pressed={editor?.isActive({ textAlign: 'right' })} onPressedChange={() => editor?.chain().focus().setTextAlign('right').run()}><AlignRight className="h-3 w-3 sm:h-4 sm:w-4" /></Toggle>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    <Toggle size="sm" className="h-7 w-7 sm:h-9 sm:w-9" pressed={editor?.isActive('bulletList')} onPressedChange={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-3 w-3 sm:h-4 sm:w-4" /></Toggle>
                    <Toggle size="sm" className="h-7 w-7 sm:h-9 sm:w-9" pressed={editor?.isActive('orderedList')} onPressedChange={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3 w-3 sm:h-4 sm:w-4" /></Toggle>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-9 sm:w-9 p-0" onClick={() => setShowImageDialog(true)}><ImageIcon className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                </div>
            </div>
        )}
      </header>

      <div 
        className="flex-1 relative overflow-y-auto cursor-text" 
        onClick={(e) => {
          if (aiLoading || aiReviewMode) { e.preventDefault(); e.stopPropagation(); return; }
          if (permission === 'write') editor?.commands.focus();
        }}
        onMouseMove={handleMouseMove}
        ref={editorRef}
      >
        {/* AI Loading Overlay — blocks all interaction */}
        {aiLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                <Wand2 className="h-4 w-4 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <span className="text-sm font-medium text-gray-500">Analyse en cours…</span>
            </div>
          </div>
        )}

        {/* Inline correction tooltips — positioned above faulty words */}
        {aiReviewMode && aiCorrectionPositions.length > 0 && aiCorrections.map((correction, idx) => {
          const pos = aiCorrectionPositions[idx];
          if (!pos || (pos.top === 0 && pos.left === 0)) return null;
          return (
            <div
              key={idx}
              className="absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
              style={{ top: pos.top, left: pos.left, minWidth: 200 }}
            >
              <div className={`bg-white rounded-xl shadow-xl border overflow-hidden transition-all duration-200 ${
                correction.accepted === true ? 'border-emerald-300 opacity-60 scale-95' :
                correction.accepted === false ? 'border-gray-200 opacity-30 scale-95' :
                'border-gray-200'
              }`}>
                <div className="px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                      correction.type === 'orthographe' ? 'bg-red-100 text-red-700' :
                      correction.type === 'grammaire' ? 'bg-amber-100 text-amber-700' :
                      correction.type === 'conjugaison' ? 'bg-blue-100 text-blue-700' :
                      correction.type === 'accent' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{correction.type}</span>
                    <span className="text-[10px] text-gray-400 truncate">{correction.explanation}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="line-through text-red-500 font-medium">{correction.original}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-emerald-600 font-semibold">{correction.corrected}</span>
                  </div>
                </div>
                {correction.accepted === null && (
                  <div className="flex border-t border-gray-100">
                    <button onClick={() => handleAcceptCorrection(idx)} className="flex-1 py-1.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-1 transition-colors">
                      <Check className="h-3 w-3" /> Accepter
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button onClick={() => handleRejectCorrection(idx)} className="flex-1 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 flex items-center justify-center gap-1 transition-colors">
                      <X className="h-3 w-3" /> Refuser
                    </button>
                  </div>
                )}
              </div>
              {/* Arrow pointing down to the word */}
              <div className="ml-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} />
            </div>
          );
        })}

        {Object.values(cursors).map((cursor: RemoteCursor, i) => (
            <div key={i} className="absolute pointer-events-none z-30 transition-all duration-100 ease-linear flex flex-col items-start" style={{ left: cursor.x, top: cursor.y }}>
                <MousePointer2 className="h-5 w-5 fill-current" style={{ color: cursor.color }} />
                <div className="ml-4 px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-sm" style={{ backgroundColor: cursor.color }}>{cursor.name}</div>
            </div>
        ))}

        <div className="max-w-[21cm] w-full mx-auto py-4 sm:py-8">
          {editor && userProfile?.is_pro && permission === 'write' && !aiReviewMode && !aiLoading && (
            <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden flex items-center p-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleAiAction('revise')} 
                disabled={aiLoading}
                className="text-xs h-7 gap-1 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
              >
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : <Wand2 className="h-3 w-3"/>}
                Réviser
              </Button>
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleAiAction('summarize')}
                disabled={aiLoading} 
                className="text-xs h-7 gap-1 px-2 text-gray-700 font-medium"
              >
                Résumer
              </Button>
            </BubbleMenu>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Floating action bar during AI review */}
      {aiReviewMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white/95 backdrop-blur-xl rounded-full shadow-2xl border border-gray-200 px-2 py-1.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 pl-3">
              <Wand2 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-xs font-medium text-gray-600">
                {aiCorrections.filter(c => c.accepted === true).length}/{aiCorrections.length} acceptée{aiCorrections.filter(c => c.accepted === true).length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <Button variant="ghost" size="sm" onClick={handleRejectAllReview} className="text-xs h-7 px-3 text-gray-500 hover:text-gray-700 rounded-full">
              Annuler
            </Button>
            <Button size="sm" onClick={handleApplyReview} className="text-xs h-7 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-sm">
              <Check className="h-3 w-3 mr-1" /> Appliquer
            </Button>
          </div>
        </div>
      )}

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Insérer une image</DialogTitle><DialogDescription>Ajoutez une image depuis votre appareil ou via une URL.</DialogDescription></DialogHeader>
            <Tabs defaultValue="upload">
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="upload">Upload</TabsTrigger><TabsTrigger value="url">Lien</TabsTrigger></TabsList>
                <TabsContent value="upload" className="py-4">
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => imageInputRef.current?.click()}>
                        {isImageUploading ? <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400" /> : <Upload className="h-8 w-8 mx-auto text-gray-400" />}
                        <p className="mt-2 text-sm text-gray-500">Cliquez pour choisir un fichier</p>
                        <p className="text-xs text-gray-400 mt-1">Max: {userProfile?.is_pro ? '35MB' : '15MB'}</p>
                    </div>
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </TabsContent>
                <TabsContent value="url" className="py-4 space-y-4">
                    <Input placeholder="https://exemple.com/image.jpg" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} />
                    <Button onClick={addImageUrl} className="w-full">Insérer</Button>
                </TabsContent>
            </Tabs>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[500px] max-w-[95vw]">
          <DialogHeader><DialogTitle>Partager</DialogTitle><DialogDescription>Gérez les accès.</DialogDescription></DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="general">Général</TabsTrigger><TabsTrigger value="invites">Invités</TabsTrigger></TabsList>
            <TabsContent value="general" className="space-y-4 py-4">
                <div className="space-y-2">
                    {['private', 'limited', 'public'].map((v) => (
                        <div key={v} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${document?.visibility === v ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`} onClick={() => updateVisibility(v as any)}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full bg-white shadow-sm`}>{v === 'private' ? <LockKeyhole className="h-4 w-4" /> : v === 'limited' ? <Users className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}</div>
                                <span className="capitalize font-medium text-sm">{v}</span>
                            </div>
                            {document?.visibility === v && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                    ))}
                </div>
                <Button variant="outline" className="w-full" onClick={copyShareLink}><Copy className="mr-2 h-4 w-4" /> Copier le lien</Button>
            </TabsContent>
            <TabsContent value="invites" className="space-y-4 py-4">
                <div className="flex gap-2">
                    <Input placeholder="email..." value={newInviteEmail} onChange={(e) => setNewInviteEmail(e.target.value)} className="flex-1" />
                    
                    <Select value={invitePermission} onValueChange={(v: any) => setInvitePermission(v)}>
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Lecture</SelectItem>
                        <SelectItem value="write">Écriture</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button onClick={inviteUser}><UserPlus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2 mt-4 max-h-40 overflow-y-auto">
                    {accessList.map(access => (
                        <div key={access.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded border border-gray-100">
                            <div className="flex items-center gap-2">
                                <span>{access.email}</span>
                                <Badge variant="outline" className="text-[10px] h-5">{access.permission === 'read' ? 'Lecture' : 'Écriture'}</Badge>
                            </div>
                            <Trash2 className="h-4 w-4 text-red-500 cursor-pointer hover:text-red-700" onClick={() => removeAccess(access.id)} />
                        </div>
                    ))}
                </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showIconPicker} onOpenChange={setShowIconPicker}><DialogContent className="max-w-[95vw]"><DialogHeader><DialogTitle>Icône</DialogTitle></DialogHeader><div className="grid grid-cols-6 gap-2">{AVAILABLE_ICONS.map(i => <button key={i.name} onClick={() => { setSelectedIcon(i.name); handleSave('icon', i.name); setShowIconPicker(false); }} className={`p-2 rounded hover:bg-gray-100 ${selectedIcon === i.name ? 'bg-blue-50 ring-1' : ''}`}><i.icon className="h-6 w-6 mx-auto" /></button>)}</div><div className="border-t pt-4 mt-2"><Label>Couleur</Label><div className="flex gap-2 mt-2 overflow-x-auto pb-2">{COLOR_PALETTE.map(c => <button key={c.value} onClick={() => { setSelectedColor(c.value); handleSave('color', c.value); }} className={`h-6 w-6 shrink-0 rounded-full ${selectedColor === c.value ? 'ring-2 ring-offset-2 ring-black' : ''}`} style={{ backgroundColor: c.value }} />)}</div></div></DialogContent></Dialog>
      
      {/* EXPORT DIALOG WITH SECURITY */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle>Export Sécurisé (.sivara)</DialogTitle>
                <DialogDescription>Créez un conteneur chiffré autoportant.</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="standard">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="standard">Standard</TabsTrigger>
                    <TabsTrigger value="security" className="text-blue-600"><ShieldCheck className="h-3 w-3 mr-2" /> Sécurité</TabsTrigger>
                </TabsList>

                <TabsContent value="standard" className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Mot de passe (Optionnel)</Label>
                        <Input 
                            type="password" 
                            placeholder="Protéger par clé..." 
                            value={exportPassword}
                            onChange={(e) => setExportPassword(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">Si vide, le fichier sera lié à votre compte Sivara.</p>
                    </div>
                </TabsContent>

                <TabsContent value="security" className="py-4 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold flex items-center gap-2"><Laptop className="h-4 w-4" /> Verrouillage Appareil</Label>
                            <p className="text-xs text-gray-500">Fichier ouvrable uniquement sur CET ordinateur.</p>
                        </div>
                        <Switch checked={restrictDevice} onCheckedChange={setRestrictDevice} />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold flex items-center gap-2"><Users className="h-4 w-4" /> Restriction Utilisateurs</Label>
                            <p className="text-xs text-gray-500">Seuls les collaborateurs actuels pourront ouvrir.</p>
                        </div>
                        <Switch checked={restrictUsers} onCheckedChange={setRestrictUsers} />
                    </div>

                    <div className="border p-3 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold flex items-center gap-2"><MapPin className="h-4 w-4" /> Geofencing</Label>
                            <Switch checked={restrictGeo} onCheckedChange={setRestrictGeo} />
                        </div>
                        {restrictGeo && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div className="h-40 bg-gray-200 rounded-lg overflow-hidden relative" ref={mapRef}>
                                    <Button size="sm" variant="secondary" className="absolute top-2 right-2 z-10 h-6 text-xs bg-white/90 hover:bg-white shadow-sm" onClick={recenterMap}>
                                        <Crosshair className="w-3 h-3 mr-1" /> Ma Position
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-12">Rayon:</span>
                                    <Slider value={geoRadius} max={500} min={10} step={10} onValueChange={setGeoRadius} className="flex-1" />
                                    <span className="text-xs font-bold w-10 text-right">{geoRadius[0]}km</span>
                                </div>
                                <p className="text-[10px] text-gray-400">Le fichier s'auto-détruira s'il est ouvert hors zone.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <DialogFooter>
                <Button variant="outline" onClick={() => setShowExportDialog(false)}>Annuler</Button>
                <Button onClick={handleExportSivara} disabled={isExporting} className="bg-black hover:bg-gray-800 text-white">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                    Générer le fichier
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Summarize Bubble */}
      {summaryText && (
          <div 
             className="fixed z-50 w-80 bg-white shadow-2xl border border-gray-200 rounded-2xl overflow-hidden flex flex-col transition-shadow"
             style={{ 
                 left: summaryPos.x, top: summaryPos.y,
                 touchAction: 'none'
             }}
          >
             <div 
                 onPointerDown={startDragSummary}
                 onPointerMove={moveDragSummary}
                 onPointerUp={endDragSummary}
                 onPointerCancel={endDragSummary}
                 className="bg-zinc-50 border-b border-gray-100 px-4 py-2.5 cursor-move flex items-center justify-between select-none active:cursor-grabbing"
             >
                 <div className="font-semibold text-sm text-zinc-700 tracking-tight">
                     L'essentiel
                 </div>
                 <button onClick={() => setSummaryText(null)} className="text-zinc-400 hover:text-zinc-800 transition-colors p-1" aria-label="Fermer">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
             </div>
             <div className="p-5 max-h-[400px] overflow-y-auto text-[13.5px] text-zinc-600 font-sans leading-relaxed whitespace-pre-wrap">
                 {summaryText}
             </div>
          </div>
      )}
    </div>
  );
};

export default DocEditor;