import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';

import {
  ArrowLeft, Download, Share2, Users, Loader2, Star, MoreVertical, Trash2, Copy, Shield, Lock,
  FileText, Briefcase, FolderOpen, BookOpen, Lightbulb, Target, TrendingUp, Users as UsersIcon,
  Calendar, CheckSquare, MessageSquare, Mail, Phone, Globe, Settings, Heart, Zap, Award,
  BarChart, PieChart, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3, Type, Check, 
  Eye, LockKeyhole, Globe2, UserPlus, MousePointer2, Cloud, LogIn
} from 'lucide-react';

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
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
import { RealtimeChannel } from '@supabase/supabase-js';

// --- EXTENSION FONT SIZE ---
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
}

interface AccessEntry {
  id: string;
  email: string;
  permission: 'read' | 'write';
}

// Pour le header (Présence)
interface Collaborator {
  id: string;
  email: string;
  color: string;
  avatar_url?: string | null;
  name: string;
  online_at: number;
}

// Pour les curseurs (Broadcast)
interface RemoteCursor {
  x: number;
  y: number;
  color: string;
  name: string;
  last_updated: number;
}

// --- CONSTANTS ---
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

const DocEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // State Document
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [isOwner, setIsOwner] = useState(false);
  const [decryptionError, setDecryptionError] = useState(false);

  // State User & Profile
  const [userProfile, setUserProfile] = useState<{avatar_url: string | null} | null>(null);

  // State UI
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('FileText');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');

  // State Collaboration
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]); // Header avatars
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({}); // Broadcast cursors
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'read' | 'write'>('read');

  // Refs
  const titleRef = useRef(title);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef('');
  
  // Stable random color for this session
  const myColorRef = useRef(CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]);

  useEffect(() => { titleRef.current = title; }, [title]);

  // --- EDITOR SETUP ---
  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, FontFamily, FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Commencez à écrire...' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none outline-none focus:outline-none min-h-[90vh] bg-white py-12 px-8 sm:px-12 md:px-16 shadow-sm mb-8 rounded-lg',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      contentRef.current = html;
      
      if (!isUpdatingFromRemoteRef.current) {
        // Broadcast changes (Typing)
        if (channelRef.current && user) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'content_update',
            payload: { content: html, sender: user.id }
          });
        }
        // Save DB - Temps réel
        if (permission === 'write') {
          handleContentChange(html);
        }
      }
    },
  });

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!id || authLoading) return;

    const init = async () => {
      // 1. Load Fonts
      if (!window.document.getElementById('sivara-google-fonts')) {
        const link = window.document.createElement('link');
        link.id = 'sivara-google-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime&family=Inter:wght@300;400;500;600&family=Lato:wght@300;400;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@300;400;600&family=Open+Sans:wght@300;400;600&family=Playfair+Display:wght@400;600&family=Roboto:wght@300;400;500&display=swap';
        window.document.head.appendChild(link);
      }

      // 2. Load Profile (for avatar)
      if (user) {
        const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
        setUserProfile(data);
      }

      // 3. Load Doc & Keys
      await fetchDocumentAndInitCrypto();
    };

    init();

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [id, user, editor, authLoading]);

  // --- REALTIME SETUP ---
  useEffect(() => {
    // Nettoyage au démontage ou changement d'ID
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [id]);

  useEffect(() => {
    if (id && user && !isLoading && !decryptionError) {
       setupRealtime();
    }
  }, [id, user, isLoading, decryptionError, userProfile]);

  const setupRealtime = () => {
    if (!id || !user) return;

    // Données de présence (Qui suis-je ?)
    const myPresenceState = {
        id: user.id,
        email: user.email,
        color: myColorRef.current,
        avatar_url: userProfile?.avatar_url,
        name: user.email?.split('@')[0] || 'Anonyme',
        online_at: Date.now()
    };

    // Si le channel existe déjà, on met juste à jour la présence (ex: avatar chargé après coup)
    if (channelRef.current) {
        channelRef.current.track(myPresenceState);
        return;
    }

    const channel = supabase.channel(`doc:${id}`, {
      config: {
        presence: {
          key: user.id, // CLÉ UNIQUE CRUCIALE
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users: Collaborator[] = [];
        
        for (const key in newState) {
           const presences = newState[key] as any[];
           if (presences && presences.length > 0) {
             // On prend la dernière version de l'état pour cet utilisateur
             const userData = presences[0]; 
             if (userData.id !== user.id) { // Ne pas s'ajouter soi-même dans la liste des "autres"
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
        // Mise à jour rapide des curseurs
        if (payload.id !== user.id) {
            setCursors(prev => ({
                ...prev,
                [payload.id]: {
                    x: payload.x,
                    y: payload.y,
                    color: payload.color,
                    name: payload.name,
                    last_updated: Date.now()
                }
            }));
        }
      })
      .on('broadcast', { event: 'content_update' }, ({ payload }) => {
        // Mise à jour du contenu
        if (payload.sender !== user.id && editor) {
           isUpdatingFromRemoteRef.current = true;
           const { from, to } = editor.state.selection;
           editor.commands.setContent(payload.content);
           editor.commands.setTextSelection({ from, to });
           setTimeout(() => isUpdatingFromRemoteRef.current = false, 50);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(myPresenceState);
        }
      });
    
    channelRef.current = channel;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!channelRef.current || !editorRef.current || !user) return;
    
    // Throttle léger (toutes les ~30ms max)
    const now = Date.now();
    if ((editorRef.current as any).lastMove && now - (editorRef.current as any).lastMove < 30) return;
    (editorRef.current as any).lastMove = now;

    const rect = editorRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + editorRef.current.scrollTop;
    
    // Broadcast rapide (pas de persistance)
    channelRef.current.send({
        type: 'broadcast',
        event: 'cursor-pos',
        payload: {
            id: user.id,
            name: user.email?.split('@')[0],
            color: myColorRef.current,
            x, y
        }
    });
  };

  // Nettoyage des vieux curseurs inactifs (toutes les 5 sec)
  useEffect(() => {
     const interval = setInterval(() => {
        const now = Date.now();
        setCursors(prev => {
            const next = { ...prev };
            let changed = false;
            Object.keys(next).forEach(key => {
                if (now - next[key].last_updated > 10000) { // 10 secondes d'inactivité
                    delete next[key];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
     }, 5000);
     return () => clearInterval(interval);
  }, []);


  // --- DATA LOADING & CRYPTO ---
  const fetchDocumentAndInitCrypto = async () => {
    try {
      const { data: doc, error } = await supabase.from('documents').select('*').eq('id', id).single();

      if (error || !doc) {
        if (!user) {
           // Redirection login logic...
           const currentUrl = window.location.href;
           const isLocal = window.location.hostname === 'localhost';
           const loginUrl = isLocal 
              ? `/?app=account&path=/login&returnTo=${encodeURIComponent(currentUrl)}`
              : `https://account.sivara.ca/login?returnTo=${encodeURIComponent(currentUrl)}`;
           window.location.href = loginUrl;
           return;
        }
        throw new Error("Document inaccessible");
      }

      // Initialisation Crypto
      const hashKey = window.location.hash.replace('#key=', '');
      if (!hashKey || hashKey === 'share') {
        await encryptionService.initialize(doc.owner_id);
      }

      // Droits
      const isDocOwner = user?.id === doc.owner_id;
      setIsOwner(isDocOwner);

      let userPermission: 'read' | 'write' = 'read';
      if (isDocOwner) userPermission = 'write';
      else if (doc.visibility === 'public') userPermission = doc.public_permission;
      else if (user) {
         const { data: access } = await supabase.from('document_access').select('permission').eq('document_id', id).eq('email', user.email).single();
         if (access) userPermission = access.permission;
      }
      
      setPermission(userPermission);
      if (userPermission === 'read') editor?.setEditable(false);

      // Déchiffrement
      let decryptedTitle = doc.title;
      let decryptedContent = doc.content;

      try {
          decryptedTitle = await encryptionService.decrypt(doc.title, doc.encryption_iv);
          decryptedContent = await encryptionService.decrypt(doc.content, doc.encryption_iv);
      } catch (e) { 
          setDecryptionError(true);
          decryptedTitle = "Document sécurisé";
          decryptedContent = ""; 
      }

      setDocument(doc);
      setTitle(decryptedTitle);
      contentRef.current = decryptedContent;
      setSelectedIcon(doc.icon || 'FileText');
      setSelectedColor(doc.color || '#3B82F6');
      editor?.commands.setContent(decryptedContent);
      
      if (isDocOwner) fetchAccessList();

    } catch (error) {
      showError("Document inaccessible ou privé");
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccessList = async () => {
      const { data } = await supabase.from('document_access').select('*').eq('document_id', id);
      setAccessList(data || []);
  };

  // --- ACTIONS & SHARING ---
  const handleSave = async (key: string, value: string) => {
      if (!id || permission !== 'write') return;
      try {
          setIsSaving(true);
          const { encrypted: encTitle, iv } = await encryptionService.encrypt(titleRef.current);
          const { encrypted: encContent } = await encryptionService.encrypt(editor?.getHTML() || '', iv);
          
          await supabase.from('documents').update({
              title: encTitle,
              content: encContent,
              encryption_iv: iv,
              updated_at: new Date().toISOString(),
              ...((key === 'icon') ? { icon: value } : {}),
              ...((key === 'color') ? { color: value } : {})
          }).eq('id', id);
      } catch(e) { console.error(e); } 
      finally { setIsSaving(false); }
  };

  const handleContentChange = (content: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => handleSave('content', content), 500);
  };

  const updateVisibility = async (visibility: 'private' | 'limited' | 'public') => {
    if (!document) return;
    await supabase.from('documents').update({ visibility }).eq('id', id);
    setDocument({ ...document, visibility });
    showSuccess(`Visibilité changée`);
  };

  const updatePublicPermission = async (perm: 'read' | 'write') => {
    if (!document) return;
    await supabase.from('documents').update({ public_permission: perm }).eq('id', id);
    setDocument({ ...document, public_permission: perm });
  };

  const inviteUser = async () => {
      if (!newInviteEmail) return;
      const { error } = await supabase.from('document_access').insert({
          document_id: id,
          email: newInviteEmail.toLowerCase().trim(),
          permission: invitePermission
      });
      if (error) showError("Erreur invitation");
      else {
          showSuccess("Invitation envoyée");
          setNewInviteEmail('');
          fetchAccessList();
      }
  };

  const removeAccess = async (accessId: string) => {
      await supabase.from('document_access').delete().eq('id', accessId);
      fetchAccessList();
  };

  const copyShareLink = () => {
      const link = `${window.location.origin}/${id}`;
      navigator.clipboard.writeText(link);
      showSuccess("Lien copié !");
  };

  const handleLogin = () => {
    const currentUrl = window.location.href;
    const isLocal = window.location.hostname === 'localhost';
    const loginUrl = isLocal 
       ? `/?app=account&path=/login&returnTo=${encodeURIComponent(currentUrl)}`
       : `https://account.sivara.ca/login?returnTo=${encodeURIComponent(currentUrl)}`;
    window.location.href = loginUrl;
  };

  // --- RENDER HELPERS ---
  const CurrentIcon = AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.icon || FileText;
  const getIconTextColor = (bgColor: string) => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return ((r * 299 + g * 587 + b * 114) / 1000) > 155 ? '#1F2937' : '#FFFFFF';
  };

  if (isLoading || authLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

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
                  <Button onClick={() => window.location.reload()} className="w-full">Réessayer</Button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Left */}
            <div className="flex items-center gap-4 flex-1">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-5 w-5" /></Button>
              
              <button
                onClick={() => isOwner && setShowIconPicker(true)}
                className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isOwner ? 'hover:opacity-80' : ''}`}
                style={{ backgroundColor: selectedColor }}
              >
                <CurrentIcon className="h-5 w-5" style={{ color: getIconTextColor(selectedColor) }} />
              </button>

              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); handleSave('title', e.target.value); }}
                className="text-lg font-medium border-0 focus-visible:ring-0 px-2 max-w-md bg-transparent"
                readOnly={!isOwner}
              />
              
              <Badge variant="outline" className="hidden sm:flex gap-1">
                 {document?.visibility === 'public' ? <Globe2 className="h-3 w-3" /> : document?.visibility === 'limited' ? <Users className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
                 {document?.visibility === 'public' ? 'Public' : document?.visibility === 'limited' ? 'Limité' : 'Barré'}
              </Badge>

              <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-[100px]">
                {isSaving ? <><Loader2 className="h-3 w-3 animate-spin" /><span>Enregistrement...</span></> : <><Cloud className="h-3 w-3" /><span>Synchronisé</span></>}
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
              {/* Avatars */}
              <div className="flex -space-x-2 mr-4">
                  {collaborators.map(collab => (
                      <div key={collab.id} className="relative group">
                          <Avatar className="h-8 w-8 border-2 border-white ring-2" style={{ '--tw-ring-color': collab.color } as any}>
                              {collab.avatar_url ? (
                                  <AvatarImage src={collab.avatar_url} alt={collab.name} />
                              ) : null}
                              <AvatarFallback style={{ backgroundColor: collab.color }} className="text-white text-xs">
                                  {collab.name.substring(0,2).toUpperCase()}
                              </AvatarFallback>
                          </Avatar>
                          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                              {collab.email}
                          </div>
                      </div>
                  ))}
                  {collaborators.length > 0 && (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 border-2 border-white text-xs font-medium text-gray-500">
                          +{collaborators.length}
                      </div>
                  )}
              </div>

              {!user && (
                 <Button variant="outline" size="sm" onClick={handleLogin} className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Se connecter
                 </Button>
              )}

              {isOwner && (
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => setShowShareDialog(true)}>
                  <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Partager</span>
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.print()}><Download className="mr-2 h-4 w-4" /> Exporter PDF</DropdownMenuItem>
                  {isOwner && <DropdownMenuItem className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        
        {/* Toolbar */}
        {permission === 'write' && (
            <div className="border-t border-gray-200 bg-[#F8F9FA] px-4 py-2 flex justify-center items-center gap-2 shadow-inner overflow-x-auto">
                <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 px-2 py-1 gap-2">
                    <Select value={editor?.getAttributes('textStyle').fontFamily || 'Inter, sans-serif'} onValueChange={(val) => editor?.chain().focus().setFontFamily(val).run()}>
                        <SelectTrigger className="w-[140px] h-8 text-xs border-none shadow-none hover:bg-gray-100"><SelectValue placeholder="Police" /></SelectTrigger>
                        <SelectContent>{FONT_FAMILIES.map(font => <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>{font.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="w-px h-4 bg-gray-200"></div>
                    <Select value={editor?.getAttributes('textStyle').fontSize || ''} onValueChange={(val) => editor?.chain().focus().setMark('textStyle', { fontSize: val }).run()}>
                        <SelectTrigger className="w-[70px] h-8 text-xs border-none shadow-none hover:bg-gray-100"><SelectValue placeholder="16" /></SelectTrigger>
                        <SelectContent>{FONT_SIZES.map(size => <SelectItem key={size} value={size}>{size}px</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="w-px h-4 bg-gray-200"></div>
                    <Toggle size="sm" pressed={editor?.isActive('bold')} onPressedChange={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Toggle>
                    <Toggle size="sm" pressed={editor?.isActive('italic')} onPressedChange={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Toggle>
                    <Toggle size="sm" pressed={editor?.isActive('underline')} onPressedChange={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Toggle>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    <Toggle size="sm" pressed={editor?.isActive({ textAlign: 'left' })} onPressedChange={() => editor?.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Toggle>
                    <Toggle size="sm" pressed={editor?.isActive({ textAlign: 'center' })} onPressedChange={() => editor?.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></Toggle>
                    <Toggle size="sm" pressed={editor?.isActive({ textAlign: 'right' })} onPressedChange={() => editor?.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Toggle>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    <Toggle size="sm" pressed={editor?.isActive('bulletList')} onPressedChange={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Toggle>
                    <Toggle size="sm" pressed={editor?.isActive('orderedList')} onPressedChange={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Toggle>
                </div>
            </div>
        )}
      </header>

      {/* Editor Area */}
      <div 
        className="flex-1 relative overflow-y-auto cursor-text" 
        onClick={() => permission === 'write' && editor?.commands.focus()}
        onMouseMove={handleMouseMove}
        ref={editorRef}
      >
        {/* Remote Cursors (Broadcast) */}
        {Object.values(cursors).map((cursor: RemoteCursor, i) => (
            <div 
                key={i}
                className="absolute pointer-events-none z-30 transition-all duration-100 ease-linear flex flex-col items-start"
                style={{ left: cursor.x, top: cursor.y }}
            >
                <MousePointer2 className="h-5 w-5 fill-current" style={{ color: cursor.color }} />
                <div className="ml-4 px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-sm" style={{ backgroundColor: cursor.color }}>
                    {cursor.name}
                </div>
            </div>
        ))}

        {/* Page Canvas */}
        <div className="max-w-[21cm] w-full mx-auto py-8">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Partager "{title}"</DialogTitle>
            <DialogDescription>Gérez les accès et la visibilité du document.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="invites">Invités</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4 py-4">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => updateVisibility('private')}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${document?.visibility === 'private' ? 'bg-gray-200' : 'bg-gray-100'}`}><LockKeyhole className="h-5 w-5 text-gray-600" /></div>
                            <div><p className="font-medium">Barré (Privé)</p><p className="text-sm text-gray-500">Seul vous avez accès</p></div>
                        </div>
                        {document?.visibility === 'private' && <Check className="h-5 w-5 text-blue-600" />}
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => updateVisibility('limited')}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${document?.visibility === 'limited' ? 'bg-amber-100' : 'bg-gray-100'}`}><Users className="h-5 w-5 text-amber-600" /></div>
                            <div><p className="font-medium">Limité</p><p className="text-sm text-gray-500">Seules les personnes invitées</p></div>
                        </div>
                        {document?.visibility === 'limited' && <Check className="h-5 w-5 text-blue-600" />}
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => updateVisibility('public')}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${document?.visibility === 'public' ? 'bg-green-100' : 'bg-gray-100'}`}><Globe2 className="h-5 w-5 text-green-600" /></div>
                            <div><p className="font-medium">Public</p><p className="text-sm text-gray-500">Toute personne avec le lien</p></div>
                        </div>
                        {document?.visibility === 'public' && <Check className="h-5 w-5 text-blue-600" />}
                    </div>
                    {document?.visibility === 'public' && (
                        <div className="flex items-center gap-4 pl-4 border-l-2 border-gray-200">
                             <Label>Droits du public :</Label>
                             <Select value={document.public_permission} onValueChange={(v: any) => updatePublicPermission(v)}>
                                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="read">Lecture seule</SelectItem><SelectItem value="write">Écriture</SelectItem></SelectContent>
                             </Select>
                        </div>
                    )}
                </div>
                <Button variant="outline" className="w-full" onClick={copyShareLink}><Copy className="mr-2 h-4 w-4" /> Copier le lien</Button>
            </TabsContent>
            <TabsContent value="invites" className="space-y-4 py-4">
                <div className="flex gap-2">
                    <Input placeholder="email@exemple.com" value={newInviteEmail} onChange={(e) => setNewInviteEmail(e.target.value)} />
                    <Select value={invitePermission} onValueChange={(v: any) => setInvitePermission(v)}>
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="read">Lecture</SelectItem><SelectItem value="write">Édition</SelectItem></SelectContent>
                    </Select>
                    <Button onClick={inviteUser}><UserPlus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2 mt-4">
                    <Label className="text-xs text-gray-500 uppercase font-bold">Personnes avec accès</Label>
                    {accessList.map(access => (
                        <div key={access.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{access.email[0].toUpperCase()}</div>
                                <span className="text-sm">{access.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px]">{access.permission === 'read' ? 'Lecture' : 'Édition'}</Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeAccess(access.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <Dialog open={showIconPicker} onOpenChange={setShowIconPicker}>
        <DialogContent>
            <DialogHeader><DialogTitle>Icône</DialogTitle></DialogHeader>
            <div className="grid grid-cols-6 gap-2">{AVAILABLE_ICONS.map(i => <button key={i.name} onClick={() => { setSelectedIcon(i.name); handleSave('icon', i.name); setShowIconPicker(false); }} className={`p-2 rounded hover:bg-gray-100 ${selectedIcon === i.name ? 'bg-blue-50 ring-1 ring-blue-500' : ''}`}><i.icon className="h-6 w-6 mx-auto text-gray-600" /></button>)}</div>
            <div className="border-t pt-4 mt-2"><Label>Couleur</Label><div className="flex gap-2 mt-2">{COLOR_PALETTE.map(c => <button key={c.value} onClick={() => { setSelectedColor(c.value); handleSave('color', c.value); }} className={`h-6 w-6 rounded-full ${selectedColor === c.value ? 'ring-2 ring-offset-2 ring-black' : ''}`} style={{ backgroundColor: c.value }} />)}</div></div>
        </DialogContent>
       </Dialog>
    </div>
  );
};

export default DocEditor;