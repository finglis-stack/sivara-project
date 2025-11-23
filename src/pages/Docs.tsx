import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DocsLanding from './DocsLanding';
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
  FolderPlus, Folder, ChevronRight, Home, MoveUp
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

// --- COMPONENTS DND ---

const DraggableItem = ({ doc, viewMode, onClick, onNavigate, children }: any) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: doc.id,
    data: { type: doc.type, doc }
  });

  // Si c'est un dossier, on le rend aussi "Droppable" pour recevoir des fichiers
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: doc.id,
    data: { type: 'folder', doc },
    disabled: doc.type !== 'folder'
  });

  // Combine refs pour les dossiers
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
      className={`relative group transition-all duration-200 ${isOver ? 'ring-2 ring-blue-500 scale-105 bg-blue-50' : ''}`}
      onClick={(e) => {
        // Empêcher le clic si on drag
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
    id: folder.id || 'root', // 'root' pour le dossier racine
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Il faut bouger de 8px pour commencer le drag (évite les clics accidentels)
      },
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
      let query = supabase
        .from('documents')
        .select('*')
        .eq('owner_id', user.id);

      // Filtre par dossier
      if (currentFolderId) {
        query = query.eq('parent_id', currentFolderId);
      } else {
        // Si racine, parent_id est null
        query = query.is('parent_id', null);
      }

      const { data, error } = await query.order('type', { ascending: false }) // Dossiers en premier
                                       .order('updated_at', { ascending: false });

      if (error) throw error;

      const decryptedDocs = await Promise.all(
        (data || []).map(async (doc) => {
          try {
            const decryptedTitle = await encryptionService.decrypt(doc.title, doc.encryption_iv);
            // On ne déchiffre le contenu que pour les fichiers, pas nécessaire pour l'affichage grille
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
  }, [user, currentFolderId]); // Re-fetch quand on change de dossier

  // --- ACTIONS ---

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
          type: type,
          parent_id: currentFolderId
        })
        .select()
        .single();

      if (error) throw error;

      if (type === 'file') {
        navigate(`/${data.id}`);
      } else {
        showSuccess('Dossier créé');
        fetchDocuments();
        // Optionnel: Entrer direct dans le dossier ? Non, mieux vaut laisser l'utilisateur le faire.
      }
    } catch (error: any) {
      console.error('Error creating item:', error);
      showError('Erreur lors de la création');
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

  const toggleStar = async (id: string, currentState: boolean) => {
    try {
      await supabase.from('documents').update({ is_starred: !currentState }).eq('id', id);
      fetchDocuments();
    } catch (error) {}
  };

  // --- NAVIGATION ---

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

  // --- DRAG AND DROP LOGIC ---

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
    const overId = over.id as string; // Peut être un ID de dossier ou 'root'

    // Si on lâche sur soi-même
    if (activeId === overId) return;

    // Déterminer la cible (Nouveau parent_id)
    let newParentId: string | null = null;

    // Cas 1: On lâche sur le fil d'ariane
    if (over.data.current?.type === 'breadcrumb') {
      newParentId = over.data.current.folderId; // null si root, ou l'ID du dossier
    } 
    // Cas 2: On lâche sur un dossier dans la vue
    else if (over.data.current?.type === 'folder') {
      newParentId = overId;
    } else {
      // On a lâché ailleurs
      return;
    }

    // Empêcher de déplacer un dossier dans lui-même (boucle infinie)
    if (activeId === newParentId) return;

    // Exécuter le déplacement
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

  // --- VIEW ---

  if (loading) return <div className="h-screen w-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  if (!user) return <DocsLanding />;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => window.location.href = '/?app=www'} className="text-gray-600 hover:text-gray-900 hidden md:flex">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Sivara Search
                </Button>
                <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
                <div className="flex items-center gap-3">
                  <img src="/docs-icon.png" alt="Docs" className="h-8 w-8" />
                  <h1 className="text-2xl font-light text-gray-900">Docs</h1>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative w-64 hidden md:block">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                        <AvatarFallback className="bg-gray-700 text-white">{user.email?.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Mon Compte</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Déconnexion</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 container mx-auto px-6 py-8">
          
          {/* Toolbar & Breadcrumbs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />}
                  <DroppableBreadcrumb 
                    folder={crumb} 
                    isActive={index === breadcrumbs.length - 1}
                    onClick={() => navigateToBreadcrumb(index)}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
               {/* Mode Switcher */}
               <div className="flex bg-gray-100 rounded-lg p-1">
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'}`}><Grid3x3 className="h-4 w-4" /></button>
                  <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}><List className="h-4 w-4" /></button>
               </div>
               <div className="w-px h-6 bg-gray-200 mx-2"></div>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-gray-900 hover:bg-black text-white gap-2">
                      <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nouveau</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => createItem('file')}><FileText className="mr-2 h-4 w-4" /> Document</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => createItem('folder')}><FolderPlus className="mr-2 h-4 w-4" /> Dossier</DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
          </div>

          {/* Content Area */}
          {isLoadingDocs ? (
            <div className="py-20 text-center text-gray-400 flex flex-col items-center">
               <Loader2 className="h-8 w-8 animate-spin mb-4" />
               <p>Chargement de vos documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
             <div className="border-2 border-dashed border-gray-200 rounded-xl py-20 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                   <FolderPlus className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Ce dossier est vide</h3>
                <p className="text-gray-500 mb-6 max-w-sm">Glissez des documents ici ou créez-en un nouveau pour commencer.</p>
                <div className="flex gap-3">
                   <Button variant="outline" onClick={() => createItem('folder')}>Créer un dossier</Button>
                   <Button onClick={() => createItem('file')}>Créer un document</Button>
                </div>
             </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "flex flex-col gap-2"}>
              {filteredDocuments.map((doc) => (
                <DraggableItem 
                  key={doc.id} 
                  doc={doc} 
                  viewMode={viewMode} 
                  onClick={(d: any) => navigate(`/${d.id}`)} 
                  onNavigate={enterFolder}
                >
                   {viewMode === 'grid' ? (
                      // GRID CARD
                      <Card className="p-4 h-full hover:shadow-md transition-shadow cursor-pointer border-gray-200 flex flex-col justify-between group">
                         <div className="flex justify-between items-start mb-3">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${doc.type === 'folder' ? 'bg-gray-100' : ''}`} style={{ backgroundColor: doc.type === 'file' ? (doc.color || '#3B82F6') : undefined }}>
                               {doc.type === 'folder' ? <Folder className="h-5 w-5 text-gray-500" /> : <FileText className="h-5 w-5 text-white" />}
                            </div>
                            <DropdownMenu>
                               <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreVertical className="h-3 w-3" /></Button></DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                               </DropdownMenuContent>
                            </DropdownMenu>
                         </div>
                         <div>
                            <h3 className="font-medium text-gray-900 truncate mb-1" title={doc.decryptedTitle}>{doc.decryptedTitle}</h3>
                            <p className="text-xs text-gray-500">
                               {doc.type === 'folder' ? 'Dossier' : new Date(doc.updated_at).toLocaleDateString()}
                            </p>
                         </div>
                      </Card>
                   ) : (
                      // LIST ITEM
                      <div className="flex items-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer group">
                         <div className={`h-10 w-10 rounded flex items-center justify-center mr-4 ${doc.type === 'folder' ? 'bg-gray-100' : ''}`} style={{ backgroundColor: doc.type === 'file' ? (doc.color || '#3B82F6') : undefined }}>
                            {doc.type === 'folder' ? <Folder className="h-5 w-5 text-gray-500" /> : <FileText className="h-5 w-5 text-white" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{doc.decryptedTitle}</h3>
                            <div className="flex items-center text-xs text-gray-500 gap-2">
                               <span>{doc.type === 'folder' ? 'Dossier' : getPreviewText(doc.decryptedContent) || 'Vide'}</span>
                            </div>
                         </div>
                         <div className="text-xs text-gray-400 mr-4 hidden sm:block">{new Date(doc.updated_at).toLocaleDateString()}</div>
                         <DropdownMenu>
                             <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
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
      
      {/* Overlay while dragging */}
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
    </DndContext>
  );
};

export default Docs;