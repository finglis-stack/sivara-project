import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  FileText, 
  Plus, 
  Search, 
  Clock, 
  Star,
  MoreVertical,
  Trash2,
  Download,
  Share2,
  Copy,
  Loader2,
  Grid3x3,
  List,
  ArrowLeft,
  Shield
} from 'lucide-react';

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
}

interface DecryptedDocument extends Document {
  decryptedTitle: string;
  decryptedContent: string;
}

interface Profile {
  avatar_url: string | null;
}

const Docs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DecryptedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'recent' | 'starred'>('all');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const initializeAndFetch = async () => {
      await initializeEncryption();
      await fetchDocuments();
    };

    initializeAndFetch();
    fetchProfile();

    const channel = supabase
      .channel('documents_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'documents',
        filter: `owner_id=eq.${user.id}`
      }, () => {
        fetchDocuments();
      })
      .subscribe();

    const profileChannel = supabase
      .channel('profile_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        setProfile(payload.new as Profile);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    setProfile(data);
  };

  const initializeEncryption = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await encryptionService.initialize(user.id, session.access_token);
      }
    } catch (error) {
      console.error('Encryption initialization error:', error);
      showError('Erreur d\'initialisation du chiffrement');
    }
  };

  const fetchDocuments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const decryptedDocs = await Promise.all(
        (data || []).map(async (doc) => {
          try {
            const decryptedTitle = await encryptionService.decrypt(doc.title, doc.encryption_iv);
            const decryptedContent = await encryptionService.decrypt(doc.content, doc.encryption_iv);
            
            return {
              ...doc,
              decryptedTitle,
              decryptedContent
            };
          } catch (error) {
            console.error('Decryption error for document:', doc.id, error);
            return {
              ...doc,
              decryptedTitle: '🔒 Erreur de déchiffrement',
              decryptedContent: ''
            };
          }
        })
      );

      setDocuments(decryptedDocs);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      showError('Erreur lors du chargement des documents');
    } finally {
      setIsLoading(false);
    }
  };

  const createDocument = async () => {
    if (!user) return;

    try {
      const { encrypted: encryptedTitle, iv } = await encryptionService.encrypt('Document sans titre');
      const { encrypted: encryptedContent } = await encryptionService.encrypt('', iv);

      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: encryptedTitle,
          content: encryptedContent,
          owner_id: user.id,
          is_starred: false,
          encryption_iv: iv,
          icon: 'FileText',
          color: '#3B82F6'
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess('Document créé');
      navigate(`/docs/${data.id}`);
    } catch (error: any) {
      console.error('Error creating document:', error);
      showError('Erreur lors de la création du document');
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Document supprimé');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      showError('Erreur lors de la suppression');
    }
  };

  const toggleStar = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ is_starred: !currentState })
        .eq('id', id);

      if (error) throw error;
      fetchDocuments();
    } catch (error: any) {
      console.error('Error toggling star:', error);
    }
  };

  const duplicateDocument = async (doc: DecryptedDocument) => {
    if (!user) return;

    try {
      const { encrypted: encryptedTitle, iv } = await encryptionService.encrypt(`${doc.decryptedTitle} (copie)`);
      const { encrypted: encryptedContent } = await encryptionService.encrypt(doc.decryptedContent, iv);

      const { error } = await supabase
        .from('documents')
        .insert({
          title: encryptedTitle,
          content: encryptedContent,
          owner_id: user.id,
          is_starred: false,
          encryption_iv: iv,
          icon: doc.icon || 'FileText',
          color: doc.color || '#3B82F6'
        });

      if (error) throw error;

      showSuccess('Document dupliqué');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error duplicating document:', error);
      showError('Erreur lors de la duplication');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getInitials = () => {
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const getPreviewText = (content: string) => {
    const text = content.replace(/<[^>]*>/g, '').trim();
    return text.substring(0, 100) + (text.length > 100 ? '...' : '');
  };

  const getIconTextColor = (bgColor: string) => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#1F2937' : '#FFFFFF';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-500 flex items-center gap-2 justify-center">
            <Shield className="h-4 w-4" />
            Chargement des documents...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/profile')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <div className="h-6 w-px bg-gray-200"></div>
              <div className="flex items-center gap-3">
                <img src="/docs-icon.png" alt="Docs" className="h-8 w-8" />
                <h1 className="text-2xl font-light text-gray-900">Documents</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Rechercher dans les documents"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      {profile?.avatar_url && (
                        <AvatarImage src={profile.avatar_url} alt="Avatar" />
                      )}
                      <AvatarFallback className="bg-gray-700 text-white">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    Mon profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    Retour à l'accueil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'bg-gray-700 hover:bg-gray-800' : ''}
            >
              Tous
            </Button>
            <Button
              variant={filter === 'recent' ? 'default' : 'ghost'}
              onClick={() => setFilter('recent')}
              className={filter === 'recent' ? 'bg-gray-700 hover:bg-gray-800' : ''}
            >
              <Clock className="mr-2 h-4 w-4" />
              Récents
            </Button>
            <Button
              variant={filter === 'starred' ? 'default' : 'ghost'}
              onClick={() => setFilter('starred')}
              className={filter === 'starred' ? 'bg-gray-700 hover:bg-gray-800' : ''}
            >
              <Star className="mr-2 h-4 w-4" />
              Favoris
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-gray-100' : ''}
            >
              <Grid3x3 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-gray-100' : ''}
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Documents grid/list */}
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-20 w-20 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {searchQuery ? 'Aucun document trouvé' : 'Aucun document'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery ? 'Essayez une autre recherche' : 'Créez votre premier document'}
            </p>
            {!searchQuery && (
              <Button onClick={createDocument} className="bg-gray-700 hover:bg-gray-800">
                <Plus className="mr-2 h-5 w-5" />
                Nouveau document
              </Button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Carte Nouveau document */}
                <button
                  onClick={createDocument}
                  className="group border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 flex flex-col items-center justify-center min-h-[200px]"
                >
                  <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-gray-200 transition-colors">
                    <Plus className="h-6 w-6 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Nouveau document</span>
                </button>

                {/* Documents existants */}
                {filteredDocuments.map((doc) => {
                  const bgColor = doc.color || '#3B82F6';
                  const iconColor = getIconTextColor(bgColor);
                  
                  return (
                    <Card
                      key={doc.id}
                      className="group relative p-6 hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200"
                      onClick={() => navigate(`/docs/${doc.id}`)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div 
                          className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: bgColor }}
                        >
                          <FileText className="h-6 w-6" style={{ color: iconColor }} />
                        </div>
                        <div className="flex items-center gap-1">
                          {doc.is_starred && (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/docs/${doc.id}`);
                              }}>
                                <FileText className="mr-2 h-4 w-4" />
                                Ouvrir
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                toggleStar(doc.id, doc.is_starred);
                              }}>
                                <Star className="mr-2 h-4 w-4" />
                                {doc.is_starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                duplicateDocument(doc);
                              }}>
                                <Copy className="mr-2 h-4 w-4" />
                                Dupliquer
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Share2 className="mr-2 h-4 w-4" />
                                Partager
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Télécharger PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteDocument(doc.id);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {doc.decryptedTitle}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                        {getPreviewText(doc.decryptedContent) || 'Document vide'}
                      </p>
                      <div className="flex items-center text-xs text-gray-400">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(doc.updated_at)}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
                {filteredDocuments.map((doc) => {
                  const bgColor = doc.color || '#3B82F6';
                  const iconColor = getIconTextColor(bgColor);
                  
                  return (
                    <div
                      key={doc.id}
                      className="group flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/docs/${doc.id}`)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div 
                          className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: bgColor }}
                        >
                          <FileText className="h-5 w-5" style={{ color: iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900 truncate">
                              {doc.decryptedTitle}
                            </h3>
                            {doc.is_starred && (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(doc.updated_at)}</span>
                            </div>
                            <span className="text-gray-300">•</span>
                            <span className="truncate">{getPreviewText(doc.decryptedContent) || 'Document vide'}</span>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(doc.id, doc.is_starred);
                          }}>
                            <Star className="mr-2 h-4 w-4" />
                            {doc.is_starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            duplicateDocument(doc);
                          }}>
                            <Copy className="mr-2 h-4 w-4" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Share2 className="mr-2 h-4 w-4" />
                            Partager
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDocument(doc.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating action button (mobile) */}
      <Button
        onClick={createDocument}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gray-700 hover:bg-gray-800 md:hidden"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Docs;