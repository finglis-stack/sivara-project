import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { sivaraVM } from '@/lib/sivara-vm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DocsLanding from './DocsLanding';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showSuccess, showError } from '@/utils/toast';
import { 
  FileText, Plus, Search, Clock, Star, MoreVertical, Trash2, 
  Download, Share2, Copy, Loader2, Grid3x3, List, ArrowLeft, 
  FolderPlus, Folder, ChevronRight, Home, MoveUp, Edit2, 
  Image as ImageIcon, Palette, UserCircle, StarOff, Upload, FileJson, Lock
} from 'lucide-react';

// DND Imports
import {
  DndContext, 
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';

// --- TYPES ---

interface Document {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  is_starred: boolean;
  encryption_iv: string;
  icon?: string;
  color?: string;
  cover_url?: string;
  type: 'file' | 'folder';
  parent_id: string | null;
}

interface DecryptedDocument extends Document {
  decryptedTitle: string;
  decryptedContent: string;
}

interface FolderPath {
  id: string | null;
  name: string;
}

interface Profile {
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
}

// --- CONSTANTS ---
const DEFAULT_COVER = '/default-cover.jpg';

const AVAILABLE_ICONS = [
  { name: 'Folder', icon: Folder }, { name: 'Star', icon: Star },
  { name: 'Heart', icon: Home }, { name: 'Briefcase', icon: FolderPlus },
  { name: 'Globe', icon: Search }, { name: 'Zap', icon: Clock }
];
const COLOR_PALETTE = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280', '#000000'
];

// --- COMPONENTS DND ---

const DraggableItem = ({ doc, viewMode, onClick, onNavigate, children }: any) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: doc.id,
    data: { type: doc.type, doc }
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: doc.id,
    data: { type: 'folder', doc },
    disabled: doc.type !== 'folder'
  });

  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node);
    if (doc.type === 'folder') {
      setDroppableRef(node);
    }
  };

  const style = {
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setRefs} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`relative group transition-all duration-200 ${isOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50 z-10' : ''}`}
      onClick={(e) => {
        if (!isDragging) {
           if (doc.type === 'folder') onNavigate(doc);
           else onClick(doc);
        }
      }}
    >
      {children}
    </div>
  );
};

const DroppableBreadcrumb = ({ folder, isActive, onClick }: { folder: FolderPath, isActive: boolean, onClick: () => void }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: folder.id || 'root',
    data: { type: 'breadcrumb', folderId: folder.id }
  });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`flex items-center hover:bg-gray-100 px-2 py-1 rounded transition-colors ${
        isActive ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-700'
      } ${isOver ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400' : ''}`}
    >
      {folder.id === null ? <Home className="h-4 w-4" /> : folder.name}
    </button>
  );
};

// --- MAIN COMPONENT ---

const Docs = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  
  // State Data
  const [documents, setDocuments] = useState<DecryptedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // State UI
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'recent' | 'starred'>('all');
  
  // State Navigation & Folders
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderPath[]>([{ id: null, name: 'Accueil' }]);
  
  // State DnD
  const [activeDragItem, setActiveDragItem] = useState<DecryptedDocument | null>(null);

  // State Modals
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean, docId: string, currentTitle: string }>({ isOpen: false, docId: '', currentTitle: '' });
  const [customizeDialog, setCustomizeDialog] = useState<{ isOpen: boolean, doc: DecryptedDocument | null }>({ isOpen: false, doc: null });
  const [importPasswordDialog, setImportPasswordDialog] = useState<{ isOpen: boolean, fileData: any | null }>({ isOpen: false, fileData: null });
  
  const [newTitle, setNewTitle] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  
  // State Customization
  const [customIcon, setCustomIcon] = useState('Folder');
  const [customColor, setCustomColor] = useState('#6B7280');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // --- INITIALIZATION ---

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('avatar_url, first_name, last_name').eq('id', user.id).single();
    setProfile(data);
  };

  const initializeEncryption = async () => {
    if (!user) return;
    try {
      await encryptionService.initialize(user.id);
    } catch (error) {
      console.error('Encryption initialization error:', error);
      showError('Erreur d\'initialisation du chiffrement');
    }
  };

  const fetchDocuments = async () => {
    if (!user) return;
    setIsLoadingDocs(true);

    try {
      // IMPORTANT: S'assurer que l'instance crypto est bien sur l'utilisateur courant avant de fetch
      await encryptionService.initialize(user.id);

      let query = supabase.from('documents').select('*').eq('owner_id', user.id);

      if (currentFolderId) {
        query = query.eq('parent_id', currentFolderId);
      } else {
        query = query.is('parent_id', null);
      }

      const { data, error } = await query.order('type', { ascending: false }).order('updated_at', { ascending: false });

      if (error) throw error;

      const decryptedDocs = await Promise.all(
        (data || []).map(async (doc) => {
          try {
            const decryptedTitle = await encryptionService.decrypt(doc.title, doc.encryption_iv);
            const decryptedContent = doc.type === 'file' ? await encryptionService.decrypt(doc.content, doc.encryption_iv) : '';
            return { ...doc, decryptedTitle, decryptedContent };
          } catch (error) {
            return { ...doc, decryptedTitle: '🔒 Illisible', decryptedContent: '' };
          }
        })
      );

      setDocuments(decryptedDocs as DecryptedDocument[]);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      showError('Erreur lors du chargement');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    initializeEncryption().then(() => fetchDocuments());
    fetchProfile();
  }, [user, currentFolderId]);

  // --- ACTIONS ---

  const handleNavigate = (id: string) => {
    navigate(`/${id}?app=docs`);
  };

  const createItem = async (type: 'file' | 'folder') => {
    if (!user) return;
    try {
      const title = type === 'folder' ? 'Nouveau dossier' : 'Document sans titre';
      const { encrypted: encryptedTitle, iv } = await encryptionService.encrypt(title);
      const { encrypted: encryptedContent } = await encryptionService.encrypt('', iv);

      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: encryptedTitle,
          content: encryptedContent,
          owner_id: user.id,
          is_starred: false,
          encryption_iv: iv,
          icon: type === 'folder' ? 'Folder' : 'FileText',
          color: type === 'folder' ? '#6B7280' : '#3B82F6',
          cover_url: type === 'folder' ? DEFAULT_COVER : null,
          type: type,
          parent_id: currentFolderId
        })
        .select()
        .single();

      if (error) throw error;
      if (type === 'file') handleNavigate(data.id);
      else {
        showSuccess('Dossier créé');
        fetchDocuments();
      }
    } catch (error: any) {
      showError('Erreur lors de la création');
    }
  };

  const handleRename = async () => {
    if (!user || !newTitle.trim()) return;
    try {
      const { encrypted: encryptedTitle, iv } = await encryptionService.encrypt(newTitle);
      const { error } = await supabase
        .from('documents')
        .update({ title: encryptedTitle, encryption_iv: iv })
        .eq('id', renameDialog.docId);
      
      if (error) throw error;
      showSuccess('Renommé avec succès');
      setRenameDialog({ isOpen: false, docId: '', currentTitle: '' });
      fetchDocuments();
    } catch (e) {
      showError('Erreur lors du renommage');
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Élément supprimé');
      fetchDocuments();
    } catch (error: any) {
      showError('Erreur lors de la suppression');
    }
  };

  const toggleStar = async (e: React.MouseEvent, doc: DecryptedDocument) => {
    e.stopPropagation();
    try {
      await supabase.from('documents').update({ is_starred: !doc.is_starred }).eq('id', doc.id);
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, is_starred: !d.is_starred } : d));
      showSuccess(doc.is_starred ? 'Retiré des favoris' : 'Ajouté aux favoris');
    } catch (error) {}
  };

  const handleCustomization = async (useCover: boolean) => {
    if (!customizeDialog.doc) return;
    try {
      const updateData: any = {
        icon: customIcon,
        color: customColor,
      };
      await supabase.from('documents').update(updateData).eq('id', customizeDialog.doc.id);
      showSuccess('Apparence mise à jour');
      setCustomizeDialog({ isOpen: false, doc: null });
      fetchDocuments();
    } catch (e) {
      showError('Erreur de mise à jour');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customizeDialog.doc || !user) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${customizeDialog.doc.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(fileName);

      await supabase
        .from('documents')
        .update({ cover_url: publicUrl })
        .eq('id', customizeDialog.doc.id);

      showSuccess('Image de couverture mise à jour');
      setCustomizeDialog({ isOpen: false, doc: null });
      fetchDocuments();
    } catch (error) {
      console.error(error);
      showError("Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  // --- IMPORT PROPRIÉTAIRE .SIVARA (MIGRATION SÉCURISÉE VIA KERNEL) ---
  const processImport = async (data: any, password?: string) => {
    if (!user) return;
    
    try {
        setIsImporting(true);

        // 1. DÉCHIFFREMENT INITIAL (Local)
        // On doit toujours utiliser la lib crypto locale pour déchiffrer ce qui vient du kernel
        // MAIS ici le kernel nous renvoie du JSON qui contient déjà les IVs et payloads chiffrés avec la logique d'origine
        
        // Wait, le Kernel renvoie le JSON { encrypted_title, iv... }
        // Le Kernel a fait le "Unshuffle" binaire. 
        // Maintenant on doit déchiffrer le contenu AES avec la bonne clé.

        if (data.header === 'SIVARA_SECURE_DOC_V2' && password && data.salt) {
            // Mode Mot de passe (V2)
            await encryptionService.initialize(password, data.salt);
        } else if (data.header === 'SIVARA_SECURE_DOC_V1' || data.header === 'SIVARA_SECURE_DOC_V2') {
            // Mode Legacy/Propriétaire (V1) ou tentative sans mot de passe
            // Ici, data.owner_id est présent dans le JSON renvoyé par le Kernel
            await encryptionService.initialize(data.owner_id);
        } else {
            throw new Error("Format non supporté");
        }
        
        // Tentative de déchiffrement du contenu original (AES)
        let decryptedTitle = '';
        let decryptedContent = '';
        
        try {
            decryptedTitle = await encryptionService.decrypt(data.encrypted_title, data.iv);
            decryptedContent = data.encrypted_content ? await encryptionService.decrypt(data.encrypted_content, data.iv) : '';
        } catch (decryptError) {
            // Si échec, c'est probablement le mauvais mot de passe ou la mauvaise clé propriétaire
            if (data.header === 'SIVARA_SECURE_DOC_V2' && !password) {
                setImportPasswordDialog({ isOpen: true, fileData: data });
                setIsImporting(false);
                return;
            }
            throw new Error("Clé de déchiffrement invalide.");
        }

        // 3. RECHIFFREMENT (Clé de l'utilisateur actuel)
        await encryptionService.initialize(user.id);
        
        const { encrypted: newEncTitle, iv: newIv } = await encryptionService.encrypt(decryptedTitle + " (Import)");
        const { encrypted: newEncContent } = await encryptionService.encrypt(decryptedContent, newIv);

        // 4. CRÉATION DU NOUVEAU DOCUMENT
        const { error: insertError } = await supabase
            .from('documents')
            .insert({
                title: newEncTitle,
                content: newEncContent,
                encryption_iv: newIv,
                owner_id: user.id, 
                type: 'file',
                visibility: 'private',
                icon: data.icon || 'FileText',
                color: data.color || '#3B82F6',
                parent_id: currentFolderId 
            });
        
        if (insertError) throw insertError;
        
        showSuccess("Document importé et sécurisé avec succès");
        setImportPasswordDialog({ isOpen: false, fileData: null });
        setImportPassword('');
        
        await fetchDocuments(); 

    } catch (err: any) {
        console.error(err);
        if (user) await encryptionService.initialize(user.id);
        showError(err.message || "Erreur lors de l'importation");
    } finally {
        setIsImporting(false);
        if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleImportSivara = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
        setIsImporting(true);
        // On envoie le fichier binaire au Kernel pour qu'il le décompile en JSON
        const data = await sivaraVM.decompile(file);
        
        // Si c'est un V2 (protégé par mot de passe), on ouvre le dialogue
        if (data.header === 'SIVARA_SECURE_DOC_V2') {
            setImportPasswordDialog({ isOpen: true, fileData: data });
            setIsImporting(false); // On arrête le loading le temps du dialogue
        } else {
            // Sinon on tente l'import direct
            await processImport(data);
        }
    } catch (err: any) {
        showError(err.message || "Fichier invalide");
        setIsImporting(false);
    }
  };

  // --- NAVIGATION & DND ---

  const enterFolder = (folder: DecryptedDocument) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.decryptedTitle }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.reload();
    } catch (error) {}
  };

  const handleNavigateToProfile = () => {
    window.location.href = 'https://account.sivara.ca/profile';
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = documents.find(d => d.id === active.id);
    if (item) setActiveDragItem(item);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    let newParentId: string | null = null;
    if (over.data.current?.type === 'breadcrumb') {
      newParentId = over.data.current.folderId;
    } else if (over.data.current?.type === 'folder') {
      newParentId = overId;
    } else {
      return;
    }

    if (activeId === newParentId) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ parent_id: newParentId, updated_at: new Date().toISOString() })
        .eq('id', activeId);

      if (error) throw error;
      showSuccess("Élément déplacé");
      fetchDocuments();
    } catch (e) {
      showError("Erreur lors du déplacement");
    }
  };

  // --- RENDER HELPERS ---

  const getPreviewText = (content: string) => {
    const text = content.replace(/<[^>]*>/g, '').trim();
    return text.substring(0, 50) + (text.length > 50 ? '...' : '');
  };

  const filteredDocuments = documents
    .filter(doc => {
      if (filter === 'starred') return doc.is_starred;
      if (filter === 'recent') {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return new Date(doc.updated_at) > dayAgo;
      }
      return true;
    })
    .filter(doc => 
      doc.decryptedTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const openRenameDialog = (doc: DecryptedDocument) => {
    setNewTitle(doc.decryptedTitle);
    setRenameDialog({ isOpen: true, docId: doc.id, currentTitle: doc.decryptedTitle });
  };

  const openCustomizeDialog = (doc: DecryptedDocument) => {
    setCustomIcon(doc.icon || 'Folder');
    setCustomColor(doc.color || '#6B7280');
    setCustomizeDialog({ isOpen: true, doc });
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  if (!user) return <DocsLanding />;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-50 flex flex-col pt-[env(safe-area-inset-top)]">
        {/* ... (Header - Keep existing) ... */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="container mx-auto px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => window.location.href = '/?app=mobile'} className="text-gray-600 hover:text-gray-900 flex">
                  <ArrowLeft className="mr-2 h-4 w-4" /> <span className="hidden md:inline">Retour</span>
                </Button>
                <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
                <div className="flex items-center gap-3">
                  <img src="/docs-icon.png" alt="Docs" className="h-8 w-8 hidden sm:block" />
                  <h1 className="text-xl sm:text-2xl font-light text-gray-900">Docs</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <div className="relative w-40 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors text-sm"
                  />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                      <Avatar className="h-8 w-8">
                        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                        <AvatarFallback className="bg-gray-700 text-white text-xs">{user.email?.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Mon Compte</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleNavigateToProfile} className="cursor-pointer">
                      <UserCircle className="mr-2 h-4 w-4" /> Voir le profil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer"><Trash2 className="mr-2 h-4 w-4" /> Déconnexion</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 container mx-auto px-4 lg:px-6 py-4 lg:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center whitespace-nowrap">
                  {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />}
                  <DroppableBreadcrumb 
                    folder={crumb} 
                    isActive={index === breadcrumbs.length - 1}
                    onClick={() => navigateToBreadcrumb(index)}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 justify-between sm:justify-end">
               {/* Filters */}
               <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
                  <button onClick={() => setFilter('all')} className={`px-3 py-1 text-xs font-medium rounded transition-all ${filter === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tous</button>
                  <button onClick={() => setFilter('starred')} className={`px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${filter === 'starred' ? 'bg-white shadow text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}><Star className="h-3 w-3" /></button>
                  <button onClick={() => setFilter('recent')} className={`px-3 py-1 text-xs font-medium rounded transition-all ${filter === 'recent' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Récents</button>
               </div>

               <div className="flex items-center gap-2">
                   {/* View Toggle */}
                   <div className="flex bg-gray-100 rounded-lg p-1">
                      <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'}`}><Grid3x3 className="h-4 w-4" /></button>
                      <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}><List className="h-4 w-4" /></button>
                   </div>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="bg-gray-900 hover:bg-black text-white gap-2 h-9">
                          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nouveau</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => createItem('file')}><FileText className="mr-2 h-4 w-4" /> Document</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => createItem('folder')}><FolderPlus className="mr-2 h-4 w-4" /> Dossier</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />} 
                            Importer .sivara
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                   <input ref={importInputRef} type="file" accept=".sivara" className="hidden" onChange={handleImportSivara} />
               </div>
            </div>
          </div>

          {/* Content */}
          {isLoadingDocs ? (
            <div className="py-20 text-center text-gray-400 flex flex-col items-center">
               <Loader2 className="h-8 w-8 animate-spin mb-4" />
               <p>Chargement...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
             <div className="border-2 border-dashed border-gray-200 rounded-xl py-20 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                   {filter === 'starred' ? <StarOff className="h-8 w-8 text-gray-300" /> : <FolderPlus className="h-8 w-8 text-gray-300" />}
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                    {filter === 'starred' ? "Aucun favori" : "Dossier vide"}
                </h3>
                <p className="text-gray-500 mb-6 max-w-sm">
                    {filter === 'starred' ? "Ajoutez des éléments aux favoris pour les retrouver ici." : "Créez un document ou un dossier pour commencer."}
                </p>
                {filter === 'all' && (
                    <div className="flex gap-3">
                    <Button variant="outline" onClick={() => createItem('folder')}>Créer un dossier</Button>
                    <Button onClick={() => createItem('file')}>Créer un document</Button>
                    </div>
                )}
             </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "flex flex-col gap-2"}>
              {filteredDocuments.map((doc) => (
                <DraggableItem 
                  key={doc.id} 
                  doc={doc} 
                  viewMode={viewMode} 
                  onClick={(d: any) => handleNavigate(d.id)} 
                  onNavigate={enterFolder}
                >
                   {viewMode === 'grid' ? (
                      <Card className="relative h-60 overflow-hidden hover:shadow-md transition-shadow cursor-pointer border-gray-200 flex flex-col group bg-white">
                         {doc.type === 'folder' ? (
                             <div className="absolute inset-0 h-24 w-full bg-gray-100">
                                 <img src={doc.cover_url || DEFAULT_COVER} alt="Cover" className="w-full h-full object-cover" />
                             </div>
                         ) : null}
                         
                         <div className={`p-4 flex flex-col h-full justify-between z-10 ${doc.type === 'folder' ? 'pt-20' : ''}`}>
                            <div className="flex justify-between items-start">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-sm ${doc.type === 'folder' ? 'bg-white ring-1 ring-gray-100' : ''}`} style={{ backgroundColor: doc.type === 'file' ? (doc.color || '#3B82F6') : undefined }}>
                                   {doc.type === 'folder' ? <Folder className="h-5 w-5 text-gray-500" /> : <FileText className="h-5 w-5 text-white" />}
                                </div>
                                <div className="flex gap-1">
                                   <button onClick={(e) => toggleStar(e, doc)} className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 ${doc.is_starred ? 'opacity-100 text-amber-500' : 'text-gray-400'}`}>
                                      <Star className={`h-4 w-4 ${doc.is_starred ? 'fill-current' : ''}`} />
                                   </button>
                                   <DropdownMenu>
                                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreVertical className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                         <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRenameDialog(doc); }}><Edit2 className="mr-2 h-4 w-4" /> Renommer</DropdownMenuItem>
                                         <DropdownMenuItem onClick={(e) => toggleStar(e, doc)}>{doc.is_starred ? <><StarOff className="mr-2 h-4 w-4" /> Retirer favoris</> : <><Star className="mr-2 h-4 w-4" /> Ajouter favoris</>}</DropdownMenuItem>
                                         {doc.type === 'folder' && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openCustomizeDialog(doc); }}><Palette className="mr-2 h-4 w-4" /> Personnaliser</DropdownMenuItem>}
                                         <DropdownMenuSeparator />
                                         <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                                      </DropdownMenuContent>
                                   </DropdownMenu>
                                </div>
                            </div>
                            <div className="mt-2">
                                <h3 className="font-medium text-gray-900 truncate mb-1" title={doc.decryptedTitle}>{doc.decryptedTitle}</h3>
                                <p className="text-xs text-gray-500">
                                   {doc.type === 'folder' ? 'Dossier' : new Date(doc.updated_at).toLocaleDateString()}
                                </p>
                            </div>
                         </div>
                      </Card>
                   ) : (
                      <div className="flex items-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer group">
                         <div className={`h-10 w-10 rounded flex items-center justify-center mr-4 ${doc.type === 'folder' ? 'bg-gray-100' : ''}`} style={{ backgroundColor: doc.type === 'file' ? (doc.color || '#3B82F6') : undefined }}>
                            {doc.type === 'folder' ? <img src={doc.cover_url || DEFAULT_COVER} className="h-full w-full object-cover rounded" /> : <FileText className="h-5 w-5 text-white" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate flex items-center gap-2">
                                {doc.decryptedTitle}
                                {doc.is_starred && <Star className="h-3 w-3 text-amber-500 fill-current" />}
                            </h3>
                            <div className="flex items-center text-xs text-gray-500 gap-2">
                               <span>{doc.type === 'folder' ? 'Dossier' : getPreviewText(doc.decryptedContent) || 'Vide'}</span>
                            </div>
                         </div>
                         <div className="text-xs text-gray-400 mr-4 hidden sm:block">{new Date(doc.updated_at).toLocaleDateString()}</div>
                         <DropdownMenu>
                             <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRenameDialog(doc); }}><Edit2 className="mr-2 h-4 w-4" /> Renommer</DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => toggleStar(e, doc)}>{doc.is_starred ? <><StarOff className="mr-2 h-4 w-4" /> Retirer favoris</> : <><Star className="mr-2 h-4 w-4" /> Ajouter favoris</>}</DropdownMenuItem>
                                {doc.type === 'folder' && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openCustomizeDialog(doc); }}><Palette className="mr-2 h-4 w-4" /> Personnaliser</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                             </DropdownMenuContent>
                          </DropdownMenu>
                      </div>
                   )}
                </DraggableItem>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <DragOverlay>
        {activeDragItem ? (
          <div className="opacity-90 pointer-events-none">
             <Card className="p-3 w-48 shadow-2xl bg-white border-blue-500 border-2 rotate-3 cursor-grabbing flex items-center gap-3">
                <div className={`h-8 w-8 rounded flex items-center justify-center ${activeDragItem.type === 'folder' ? 'bg-gray-100' : ''}`} style={{ backgroundColor: activeDragItem.type === 'file' ? (activeDragItem.color || '#3B82F6') : undefined }}>
                   {activeDragItem.type === 'folder' ? <Folder className="h-4 w-4 text-gray-500" /> : <FileText className="h-4 w-4 text-white" />}
                </div>
                <span className="font-medium truncate text-sm">{activeDragItem.decryptedTitle}</span>
             </Card>
          </div>
        ) : null}
      </DragOverlay>

      {/* Rename Dialog */}
      <Dialog open={renameDialog.isOpen} onOpenChange={(open) => !open && setRenameDialog({ ...renameDialog, isOpen: false })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renommer</DialogTitle></DialogHeader>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
          <DialogFooter><Button onClick={handleRename}>Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customize Folder Dialog */}
      <Dialog open={customizeDialog.isOpen} onOpenChange={(open) => !open && setCustomizeDialog({ ...customizeDialog, isOpen: false })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Personnaliser le dossier</DialogTitle><DialogDescription>Changez l'icône ou l'image de couverture</DialogDescription></DialogHeader>
          <Tabs defaultValue="icon">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="icon">Icône</TabsTrigger>
              <TabsTrigger value="cover">Image</TabsTrigger>
            </TabsList>
            <TabsContent value="icon" className="space-y-4 py-2">
                <div className="grid grid-cols-6 gap-2">
                    {AVAILABLE_ICONS.map(i => (
                        <button key={i.name} onClick={() => setCustomIcon(i.name)} className={`p-2 rounded hover:bg-gray-100 ${customIcon === i.name ? 'bg-blue-50 ring-1 ring-blue-500' : ''}`}>
                            <i.icon className="h-6 w-6 mx-auto text-gray-600" />
                        </button>
                    ))}
                </div>
                <div className="border-t pt-2">
                    <Label className="mb-2 block">Couleur</Label>
                    <div className="flex gap-2 flex-wrap">
                        {COLOR_PALETTE.map(c => (
                            <button key={c} onClick={() => setCustomColor(c)} className={`h-6 w-6 rounded-full ${customColor === c ? 'ring-2 ring-offset-2 ring-black' : ''}`} style={{ backgroundColor: c }} />
                        ))}
                    </div>
                </div>
                <Button onClick={() => handleCustomization(false)} className="w-full mt-2">Enregistrer</Button>
            </TabsContent>
            <TabsContent value="cover" className="space-y-4 py-2">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    {isUploading ? <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400" /> : <Upload className="h-8 w-8 mx-auto text-gray-400" />}
                    <p className="mt-2 text-sm text-gray-500">Cliquez pour uploader une image</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Import Password Dialog */}
      <Dialog open={importPasswordDialog.isOpen} onOpenChange={(open) => !open && setImportPasswordDialog({ ...importPasswordDialog, isOpen: false })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Fichier protégé</DialogTitle>
                <DialogDescription>Ce document est chiffré. Entrez le mot de passe pour l'importer.</DialogDescription>
            </DialogHeader>
            <Input 
                type="password" 
                placeholder="Mot de passe" 
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
            />
            <DialogFooter>
                <Button variant="outline" onClick={() => setImportPasswordDialog({ isOpen: false, fileData: null })}>Annuler</Button>
                <Button onClick={() => processImport(importPasswordDialog.fileData, importPassword)}>Importer</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
};

export default Docs;