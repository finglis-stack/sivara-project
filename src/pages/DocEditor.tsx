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
  Eye, LockKeyhole, Globe2, UserPlus, MousePointer2, Cloud
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

interface Collaborator {
  id: string;
  email: string;
  color: string;
  x: number;
  y: number;
  name: string;
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
  const { user } = useAuth();
  
  // State Document
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [isOwner, setIsOwner] = useState(false);

  // State UI
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('FileText');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');

  // State Collaboration
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'read' | 'write'>('read');

  // Refs
  const titleRef = useRef(title);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);
  const channelRef = useRef<any>(null);
  const editorRef = useRef<HTMLDivElement>(null);

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
      if (!isUpdatingFromRemoteRef.current) {
        // Broadcast changes
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'content_update',
            payload: { content: editor.getHTML(), sender: user?.id }
          });
        }
        // Save DB
        if (permission === 'write') {
          handleContentChange(editor.getHTML());
        }
      }
    },
  });

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!id) return;

    const init = async () => {
      // 1. Charger la police
      if (!window.document.getElementById('sivara-google-fonts')) {
        const link = window.document.createElement('link');
        link.id = 'sivara-google-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime&family=Inter:wght@300;400;500;600&family=Lato:wght@300;400;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@300;400;600&family=Open+Sans:wght@300;400;600&family=Playfair+Display:wght@400;600&family=Roboto:wght@300;400;500&display=swap';
        window.document.head.appendChild(link);
      }

      // 2. Charger le document et la clé
      await fetchDocumentAndInitCrypto();

      // 3. Setup Realtime
      setupRealtime();
    };

    init();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [id, user, editor]);

  // --- REALTIME & COLLAB ---
  const setupRealtime = () => {
    if (!id || !user) return;

    const myColor = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
    
    channelRef.current = supabase.channel(`doc:${id}`)
      .on('presence', { event: 'sync' }, () => {
        const newState = channelRef.current.presenceState();
        const users: Collaborator[] = [];
        for (const key in newState) {
          // @ts-ignore
          newState[key].forEach(presence => {
            if (presence.user_id !== user.id) {
              users.push({
                id: presence.user_id,
                email: presence.email,
                color: presence.color,
                x: presence.x,
                y: presence.y,
                name: presence.email.split('@')[0]
              });
            }
          });
        }
        setCollaborators(users);
      })
      .on('broadcast', { event: 'content_update' }, ({ payload }) => {
        if (payload.sender !== user.id && editor) {
           isUpdatingFromRemoteRef.current = true;
           // Save cursor pos
           const { from, to } = editor.state.selection;
           editor.commands.setContent(payload.content);
           // Restore cursor (best effort)
           editor.commands.setTextSelection({ from, to });
           setTimeout(() => isUpdatingFromRemoteRef.current = false, 50);
        }
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channelRef.current.track({
            user_id: user.id,
            email: user.email,
            color: myColor,
            x: 0,
            y: 0
          });
        }
      });
  };

  // Mouse Tracking for cursors
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!channelRef.current || !editorRef.current) return;
    const rect = editorRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + editorRef.current.scrollTop;
    
    // Throttle updates
    if (Math.random() > 0.8) { 
        channelRef.current.track({
            user_id: user?.id,
            email: user?.email,
            color: CURSOR_COLORS[0], // Just update coordinates
            x, y
        });
    }
  };

  // --- DATA LOADING & CRYPTO ---
  const fetchDocumentAndInitCrypto = async () => {
    try {
      // A. Check si une clé est dans l'URL (Partage Zero-Knowledge)
      const hashKey = window.location.hash.replace('#key=', '');
      
      // B. Initialisation Crypto
      if (user && !hashKey) {
        // Mode propriétaire ou accès authentifié standard
        await encryptionService.initialize(user.id);
      } else if (hashKey) {
         // Mode invité avec lien magique
      }

      const { data: doc, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Détermination des droits
      const isDocOwner = user?.id === doc.owner_id;
      setIsOwner(isDocOwner);

      let userPermission: 'read' | 'write' = 'read';
      if (isDocOwner) userPermission = 'write';
      else if (doc.visibility === 'public') {
          userPermission = doc.public_permission;
      } else {
          // Check limited access
          const { data: access } = await supabase
             .from('document_access')
             .select('permission')
             .eq('document_id', id)
             .eq('email', user?.email)
             .single();
          if (access) userPermission = access.permission;
      }
      setPermission(userPermission);
      if (userPermission === 'read') editor?.setEditable(false);

      // Déchiffrement (Simplifié pour le contexte partagé)
      let decryptedTitle = doc.title;
      let decryptedContent = doc.content;

      if (isDocOwner) {
        try {
            decryptedTitle = await encryptionService.decrypt(doc.title, doc.encryption_iv);
            decryptedContent = await encryptionService.decrypt(doc.content, doc.encryption_iv);
        } catch (e) { console.error("Decryption fail", e); }
      } else {
          if (doc.title.length > 50) decryptedTitle = "Document Partagé";
      }

      setDocument(doc);
      setTitle(decryptedTitle);
      setSelectedIcon(doc.icon || 'FileText');
      setSelectedColor(doc.color || '#3B82F6');
      editor?.commands.setContent(decryptedContent);
      
      if (isDocOwner) fetchAccessList();

    } catch (error) {
      console.error('Load error:', error);
      showError("Document inaccessible ou introuvable");
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccessList = async () => {
      const { data } = await supabase.from('document_access').select('*').eq('document_id', id);
      setAccessList(data || []);
  };

  // --- ACTIONS ---
  const handleSave = async (key: string, value: string) => {
      if (!id || !isOwner) return; // Seul le owner sauvegarde en DB chiffrée pour l'instant
      
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
    saveTimeoutRef.current = setTimeout(() => handleSave('content', content), 2000);
  };

  // --- SHARING LOGIC ---
  const updateVisibility = async (visibility: 'private' | 'limited' | 'public') => {
    if (!document) return;
    await supabase.from('documents').update({ visibility }).eq('id', id);
    setDocument({ ...document, visibility });
    showSuccess(`Visibilité changée à : ${visibility === 'private' ? 'Barré' : visibility === 'public' ? 'Public' : 'Limité'}`);
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
          email: newInviteEmail,
          permission: invitePermission
      });
      if (error) showError("Erreur lors de l'invitation");
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
      const link = `${window.location.origin}/${id}#key=share`;
      navigator.clipboard.writeText(link);
      showSuccess("Lien copié !");
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

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Left: Title & Icon */}
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
              
              <Badge variant="outline" className={`gap-1 ${document?.visibility === 'public' ? 'bg-green-50 text-green-700 border-green-200' : document?.visibility === 'limited' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                 {document?.visibility === 'public' ? <Globe2 className="h-3 w-3" /> : document?.visibility === 'limited' ? <Users className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
                 {document?.visibility === 'public' ? 'Public' : document?.visibility === 'limited' ? 'Limité' : 'Barré'}
              </Badge>

              {/* Status Indicator */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-[120px]">
                {isSaving ? (
                    <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Enregistrement...</span>
                    </>
                ) : (
                    <>
                        <Cloud className="h-3 w-3" />
                        <span>Synchronisé</span>
                    </>
                )}
              </div>
            </div>

            {/* Right: Actions & Avatars */}
            <div className="flex items-center gap-3">
              {/* Realtime Avatars */}
              <div className="flex -space-x-2 mr-4">
                  {collaborators.map(collab => (
                      <div key={collab.id} className="relative group">
                          <Avatar className="h-8 w-8 border-2 border-white ring-2" style={{ '--tw-ring-color': collab.color } as any}>
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

              {isOwner && (
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => setShowShareDialog(true)}>
                  <Share2 className="h-4 w-4" /> Partager
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
        
        {/* Toolbar Editor */}
        {permission === 'write' && (
            <div className="border-t border-gray-200 bg-[#F8F9FA] px-4 py-2 flex justify-center items-center gap-2 shadow-inner overflow-x-auto">
                <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 px-2 py-1 gap-2">
                    
                    {/* Font Family */}
                    <Select value={editor?.getAttributes('textStyle').fontFamily || 'Inter, sans-serif'} onValueChange={(val) => editor?.chain().focus().setFontFamily(val).run()}>
                        <SelectTrigger className="w-[140px] h-8 text-xs border-none shadow-none hover:bg-gray-100">
                            <SelectValue placeholder="Police" />
                        </SelectTrigger>
                        <SelectContent>
                            {FONT_FAMILIES.map(font => (
                                <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                                    {font.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="w-px h-4 bg-gray-200"></div>

                    {/* Font Size */}
                    <Select value={editor?.getAttributes('textStyle').fontSize || ''} onValueChange={(val) => editor?.chain().focus().setMark('textStyle', { fontSize: val }).run()}>
                        <SelectTrigger className="w-[70px] h-8 text-xs border-none shadow-none hover:bg-gray-100">
                            <SelectValue placeholder="16" />
                        </SelectTrigger>
                        <SelectContent>
                            {FONT_SIZES.map(size => (
                                <SelectItem key={size} value={size}>{size}px</SelectItem>
                            ))}
                        </SelectContent>
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
        {/* Cursors Overlay */}
        {collaborators.map(collab => (
            <div 
                key={collab.id}
                className="absolute pointer-events-none z-30 transition-all duration-100 ease-out flex flex-col items-start"
                style={{ left: collab.x, top: collab.y }}
            >
                <MousePointer2 className="h-5 w-5 fill-current" style={{ color: collab.color }} />
                <div className="ml-4 px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap" style={{ backgroundColor: collab.color }}>
                    {collab.name}
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
                            <div>
                                <p className="font-medium">Barré (Privé)</p>
                                <p className="text-sm text-gray-500">Seul vous avez accès</p>
                            </div>
                        </div>
                        {document?.visibility === 'private' && <Check className="h-5 w-5 text-blue-600" />}
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => updateVisibility('limited')}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${document?.visibility === 'limited' ? 'bg-amber-100' : 'bg-gray-100'}`}><Users className="h-5 w-5 text-amber-600" /></div>
                            <div>
                                <p className="font-medium">Limité</p>
                                <p className="text-sm text-gray-500">Seules les personnes invitées</p>
                            </div>
                        </div>
                        {document?.visibility === 'limited' && <Check className="h-5 w-5 text-blue-600" />}
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => updateVisibility('public')}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${document?.visibility === 'public' ? 'bg-green-100' : 'bg-gray-100'}`}><Globe2 className="h-5 w-5 text-green-600" /></div>
                            <div>
                                <p className="font-medium">Public</p>
                                <p className="text-sm text-gray-500">Toute personne avec le lien</p>
                            </div>
                        </div>
                        {document?.visibility === 'public' && <Check className="h-5 w-5 text-blue-600" />}
                    </div>

                    {document?.visibility === 'public' && (
                        <div className="flex items-center gap-4 pl-4 border-l-2 border-gray-200">
                             <Label>Droits du public :</Label>
                             <Select value={document.public_permission} onValueChange={(v: any) => updatePublicPermission(v)}>
                                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="read">Lecture seule</SelectItem>
                                    <SelectItem value="write">Écriture</SelectItem>
                                </SelectContent>
                             </Select>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="w-full" onClick={copyShareLink}>
                        <Copy className="mr-2 h-4 w-4" /> Copier le lien
                    </Button>
                </div>
            </TabsContent>

            <TabsContent value="invites" className="space-y-4 py-4">
                <div className="flex gap-2">
                    <Input placeholder="email@exemple.com" value={newInviteEmail} onChange={(e) => setNewInviteEmail(e.target.value)} />
                    <Select value={invitePermission} onValueChange={(v: any) => setInvitePermission(v)}>
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="read">Lecture</SelectItem>
                            <SelectItem value="write">Édition</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={inviteUser}><UserPlus className="h-4 w-4" /></Button>
                </div>

                <div className="space-y-2 mt-4">
                    <Label className="text-xs text-gray-500 uppercase font-bold">Personnes avec accès</Label>
                    {accessList.length === 0 && <p className="text-sm text-gray-400 italic">Aucune invitation envoyée</p>}
                    {accessList.map(access => (
                        <div key={access.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                    {access.email[0].toUpperCase()}
                                </div>
                                <span className="text-sm">{access.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px]">{access.permission === 'read' ? 'Lecture' : 'Édition'}</Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeAccess(access.id)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

       {/* Dialog Icon Picker */}
       <Dialog open={showIconPicker} onOpenChange={setShowIconPicker}>
        <DialogContent>
            <DialogHeader><DialogTitle>Icône</DialogTitle></DialogHeader>
            <div className="grid grid-cols-6 gap-2">
                {AVAILABLE_ICONS.map(i => (
                    <button key={i.name} onClick={() => { setSelectedIcon(i.name); handleSave('icon', i.name); setShowIconPicker(false); }} className={`p-2 rounded hover:bg-gray-100 ${selectedIcon === i.name ? 'bg-blue-50 ring-1 ring-blue-500' : ''}`}>
                        <i.icon className="h-6 w-6 mx-auto text-gray-600" />
                    </button>
                ))}
            </div>
            <div className="border-t pt-4 mt-2">
                <Label>Couleur</Label>
                <div className="flex gap-2 mt-2">
                    {COLOR_PALETTE.map(c => (
                        <button key={c.value} onClick={() => { setSelectedColor(c.value); handleSave('color', c.value); }} className={`h-6 w-6 rounded-full ${selectedColor === c.value ? 'ring-2 ring-offset-2 ring-black' : ''}`} style={{ backgroundColor: c.value }} />
                    ))}
                </div>
            </div>
        </DialogContent>
       </Dialog>
    </div>
  );
};

export default DocEditor;