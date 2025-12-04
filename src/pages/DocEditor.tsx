import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { sivaraVM } from '@/lib/sivara-vm';
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
  Eye, LockKeyhole, Globe2, UserPlus, MousePointer2, Cloud, LogIn, FileKey, PenTool
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
  
  // State
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [isOwner, setIsOwner] = useState(false);
  const [decryptionError, setDecryptionError] = useState(false);
  const [userProfile, setUserProfile] = useState<{avatar_url: string | null} | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  
  // UI Dialogs
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // UI Inputs
  const [selectedIcon, setSelectedIcon] = useState('FileText');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'read' | 'write'>('read');
  const [exportPassword, setExportPassword] = useState('');

  const titleRef = useRef(title);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef('');
  const myColorRef = useRef(CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]);

  useEffect(() => { titleRef.current = title; }, [title]);

  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, FontFamily, FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Commencez à écrire...' }),
    ],
    content: '',
    editable: false, // Start as readonly until permission verified
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none outline-none focus:outline-none min-h-[90vh] bg-white py-8 px-4 sm:px-12 md:px-16 shadow-sm mb-8 rounded-lg',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      contentRef.current = html;
      
      if (!isUpdatingFromRemoteRef.current) {
        // BROADCAST SÉCURISÉ
        const broadcastSecurely = async () => {
            if (channelRef.current && user) {
                try {
                    const { encrypted, iv } = await encryptionService.encrypt(html);
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'content_update',
                        payload: { content: encrypted, iv: iv, sender: user.id }
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

  // --- PERMISSION EFFECT ---
  // Force l'état de l'éditeur quand la permission change
  useEffect(() => {
    if (editor && !isLoading) {
      console.log(`[Permissions] Mise à jour de l'éditeur. Permission: ${permission}`);
      editor.setEditable(permission === 'write');
    }
  }, [editor, permission, isLoading]);

  // --- INIT ---
  useEffect(() => {
    if (!id || authLoading) return;
    
    const init = async () => {
      // Fonts setup
      if (!window.document.getElementById('sivara-google-fonts')) {
        const link = window.document.createElement('link');
        link.id = 'sivara-google-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime&family=Inter:wght@300;400;500;600&family=Lato:wght@300;400;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@300;400;600&family=Open+Sans:wght@300;400;600&family=Playfair+Display:wght@400;600&family=Roboto:wght@300;400;500&display=swap';
        window.document.head.appendChild(link);
      }

      // User Profile setup
      if (user) {
        const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
        setUserProfile(data);
      }

      await fetchDocumentAndInitCrypto();
    };
    init();
    
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [id, user, editor, authLoading]);

  useEffect(() => { return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; } }; }, [id]);
  
  // Sync Realtime only when everything is ready (including profile)
  useEffect(() => { 
      if (id && user && !isLoading && !decryptionError) { 
          setTimeout(() => setupRealtime(), 500);
      } 
  }, [id, user, isLoading, decryptionError, userProfile]);

  const setupRealtime = () => {
    if (!id || !user) return;
    
    const myPresenceState = { 
        id: user.id, 
        email: user.email, 
        color: myColorRef.current, 
        avatar_url: userProfile?.avatar_url, 
        name: user.email?.split('@')[0] || 'Anonyme', 
        online_at: Date.now() 
    };
    
    if (channelRef.current) { 
        // Update existing presence (e.g. if avatar loaded late)
        channelRef.current.track(myPresenceState); 
        return; 
    }
    
    const channel = supabase.channel(`doc:${id}`, { config: { presence: { key: user.id, }, }, });
    
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
      .on('broadcast', { event: 'content_update' }, async ({ payload }) => {
        if (payload.sender !== user.id && editor) {
           isUpdatingFromRemoteRef.current = true;
           try {
               const decryptedContent = await encryptionService.decrypt(payload.content, payload.iv);
               const { from, to } = editor.state.selection;
               editor.commands.setContent(decryptedContent);
               editor.commands.setTextSelection({ from, to });
           } catch (e) { console.error("Broadcast decrypt error", e); }
           setTimeout(() => isUpdatingFromRemoteRef.current = false, 50);
        }
      })
      .subscribe(async (status) => { if (status === 'SUBSCRIBED') { await channel.track(myPresenceState); } });
    
    channelRef.current = channel;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!channelRef.current || !editorRef.current || !user) return;
    const now = Date.now();
    if ((editorRef.current as any).lastMove && now - (editorRef.current as any).lastMove < 30) return;
    (editorRef.current as any).lastMove = now;
    const rect = editorRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + editorRef.current.scrollTop;
    channelRef.current.send({ type: 'broadcast', event: 'cursor-pos', payload: { id: user.id, name: user.email?.split('@')[0], color: myColorRef.current, x, y } });
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
      
      const hashKey = window.location.hash.replace('#key=', '');
      if (!hashKey || hashKey === 'share') { await encryptionService.initialize(doc.owner_id); }
      
      const isDocOwner = user?.id === doc.owner_id;
      setIsOwner(isDocOwner);
      
      // --- ROBUST PERMISSION LOGIC ---
      let userPermission: 'read' | 'write' = 'read';
      
      if (isDocOwner) {
          userPermission = 'write';
      } else {
          // 1. Check for specific access entry (Priority)
          let explicitPermission = null;
          if (user && user.email) {
             const { data: accessEntries } = await supabase
                .from('document_access')
                .select('email, permission')
                .eq('document_id', id);
             
             if (accessEntries) {
                 const myAccess = accessEntries.find(a => a.email.toLowerCase() === user.email!.toLowerCase());
                 if (myAccess) {
                     explicitPermission = myAccess.permission;
                 }
             }
          }

          // 2. Apply Hierarchy: Explicit Write > Public Write > Public Read > Explicit Read
          if (explicitPermission === 'write') {
              userPermission = 'write';
          } else if (doc.visibility === 'public' && doc.public_permission === 'write') {
              userPermission = 'write';
          } else if (explicitPermission === 'read') {
              userPermission = 'read';
          } else if (doc.visibility === 'public') {
              userPermission = 'read';
          } else {
              // Limited/Private and no explicit access
              throw new Error("Document inaccessible");
          }
      }
      
      console.log(`[Auth] Mode: ${userPermission}`);
      setPermission(userPermission);
      // Note: editor.setEditable est aussi géré par le useEffect dédié maintenant

      let decryptedTitle = doc.title;
      let decryptedContent = doc.content;
      try {
          decryptedTitle = await encryptionService.decrypt(doc.title, doc.encryption_iv);
          decryptedContent = await encryptionService.decrypt(doc.content, doc.encryption_iv);
      } catch (e) { setDecryptionError(true); decryptedTitle = "Document sécurisé"; decryptedContent = ""; }
      
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
    } finally { setIsLoading(false); }
  };

  const fetchAccessList = async () => { const { data } = await supabase.from('document_access').select('*').eq('document_id', id); setAccessList(data || []); };
  
  const handleSave = async (key: string, value: string) => { if (!id || permission !== 'write') return; try { setIsSaving(true); const { encrypted: encTitle, iv } = await encryptionService.encrypt(titleRef.current); const { encrypted: encContent } = await encryptionService.encrypt(editor?.getHTML() || '', iv); await supabase.from('documents').update({ title: encTitle, content: encContent, encryption_iv: iv, updated_at: new Date().toISOString(), ...((key === 'icon') ? { icon: value } : {}), ...((key === 'color') ? { color: value } : {}) }).eq('id', id); } catch(e) { console.error(e); } finally { setIsSaving(false); } };
  
  const handleContentChange = (content: string) => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = setTimeout(() => handleSave('content', content), 500); };
  
  const updateVisibility = async (visibility: 'private' | 'limited' | 'public') => { if (!document) return; await supabase.from('documents').update({ visibility }).eq('id', id); setDocument({ ...document, visibility }); showSuccess(`Visibilité changée`); };
  const updatePublicPermission = async (perm: 'read' | 'write') => { if (!document) return; await supabase.from('documents').update({ public_permission: perm }).eq('id', id); setDocument({ ...document, public_permission: perm }); };
  
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
  
  const copyShareLink = () => { 
    const link = `https://docs.sivara.ca/${id}`; 
    navigator.clipboard.writeText(link); 
    showSuccess("Lien copié : " + link); 
  };
  const handleLogin = () => { 
    const currentUrl = window.location.href; 
    window.location.href = `https://account.sivara.ca/login?returnTo=${encodeURIComponent(currentUrl)}`; 
  };

  // --- NOUVEAU HANDLE EXPORT PROPRIÉTAIRE ---
  const handleExportSivara = async () => {
    if (!document || !user) return;
    setIsExporting(true);
    try {
        let encryptedTitle = document.title;
        let encryptedContent = document.content;
        let iv = document.encryption_iv;
        let isPasswordProtected = false;
        let salt = null;

        if (exportPassword) {
            const saltValue = crypto.randomUUID();
            await encryptionService.initialize(exportPassword, saltValue);
            
            const { encrypted: encTitle, iv: newIv } = await encryptionService.encrypt(titleRef.current);
            const { encrypted: encContent } = await encryptionService.encrypt(contentRef.current, newIv);
            
            encryptedTitle = encTitle;
            encryptedContent = encContent;
            iv = newIv;
            isPasswordProtected = true;
            salt = saltValue;

            // Restaure la clé utilisateur pour la suite
            await encryptionService.initialize(user.id);
        }

        // Préparation du Payload pour le Kernel SIVARA
        const payload = {
            encrypted_title: encryptedTitle,
            encrypted_content: encryptedContent,
            iv: iv,
            owner_id: document.owner_id,
            icon: document.icon || 'FileText',
            color: document.color || '#3B82F6',
            salt: salt
        };

        // --- MAGIE DU KERNEL ---
        // Appel au VM pour obtenir le binaire propriétaire
        const blob = await sivaraVM.compile(payload);
        
        // Téléchargement
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `secure-${document.id.slice(0, 8)}.sivara`;
        a.click();
        
        showSuccess(isPasswordProtected ? "Exporté & Verrouillé (SBP)" : "Exporté (Sivara Binary Protocol)");
        setShowExportDialog(false);
        setExportPassword('');
    } catch (e: any) {
        console.error(e);
        showError(e.message || "Erreur lors de l'exportation");
    } finally {
        setIsExporting(false);
        if (user) await encryptionService.initialize(user.id);
    }
  };
  
  const CurrentIcon = AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.icon || FileText;
  const getIconTextColor = (bgColor: string) => { const hex = bgColor.replace('#', ''); const r = parseInt(hex.substr(0, 2), 16); const g = parseInt(hex.substr(2, 2), 16); const b = parseInt(hex.substr(4, 2), 16); return ((r * 299 + g * 587 + b * 114) / 1000) > 155 ? '#1F2937' : '#FFFFFF'; };

  if (isLoading || authLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (decryptionError) { return ( <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center"> <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full border border-gray-200"> <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"> <LockKeyhole className="h-8 w-8 text-red-600" /> </div> <h1 className="text-2xl font-bold text-gray-900 mb-2">Contenu sécurisé inaccessible</h1> <p className="text-gray-500 mb-6"> Ce document est chiffré et la clé de déchiffrement n'a pas pu être générée correctement. </p> <Button onClick={() => window.location.reload()} className="w-full">Réessayer</Button> </div> </div> ); }

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6] pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 overflow-hidden">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
              
              <button onClick={() => isOwner && setShowIconPicker(true)} className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isOwner ? 'hover:opacity-80' : ''}`} style={{ backgroundColor: selectedColor }}>
                <CurrentIcon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: getIconTextColor(selectedColor) }} />
              </button>

              <Input value={title} onChange={(e) => { setTitle(e.target.value); handleSave('title', e.target.value); }} className="text-base sm:text-lg font-medium border-0 focus-visible:ring-0 px-2 max-w-[150px] sm:max-w-md bg-transparent truncate" readOnly={!isOwner} />
              
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
                </div>
            </div>
        )}
      </header>

      <div 
        className="flex-1 relative overflow-y-auto cursor-text" 
        onClick={() => permission === 'write' && editor?.commands.focus()}
        onMouseMove={handleMouseMove}
        ref={editorRef}
      >
        {Object.values(cursors).map((cursor: RemoteCursor, i) => (
            <div key={i} className="absolute pointer-events-none z-30 transition-all duration-100 ease-linear flex flex-col items-start" style={{ left: cursor.x, top: cursor.y }}>
                <MousePointer2 className="h-5 w-5 fill-current" style={{ color: cursor.color }} />
                <div className="ml-4 px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-sm" style={{ backgroundColor: cursor.color }}>{cursor.name}</div>
            </div>
        ))}

        <div className="max-w-[21cm] w-full mx-auto py-4 sm:py-8">
          <EditorContent editor={editor} />
        </div>
      </div>

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
      
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Export Sécurisé</DialogTitle>
                <DialogDescription>Protégez ce fichier avec un mot de passe (optionnel mais recommandé pour le partage).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label>Mot de passe (Optionnel)</Label>
                    <Input 
                        type="password" 
                        placeholder="Laisser vide pour utiliser la clé propriétaire" 
                        value={exportPassword}
                        onChange={(e) => setExportPassword(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Si défini, ce mot de passe sera requis pour importer le fichier.</p>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setShowExportDialog(false)}>Annuler</Button>
                <Button onClick={handleExportSivara} disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileKey className="mr-2 h-4 w-4" />}
                    Exporter (.sivara)
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocEditor;