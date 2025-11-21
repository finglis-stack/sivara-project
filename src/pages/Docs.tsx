import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  ArrowLeft
} from 'lucide-react';

interface Document {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  is_starred: boolean;
}

const Docs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'recent' | 'starred'>('all');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchDocuments();

    // Subscription temps réel
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const fetchDocuments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
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
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: 'Document sans titre',
          content: '',
          owner_id: user.id,
          is_starred: false
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

  const duplicateDocument = async (doc: Document) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('documents')
        .insert({
          title: `${doc.title} (copie)`,
          content: doc.content,
          owner_id: user.id,
          is_starred: false
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
      doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
                <h1 className="text-2xl font-light text-gray-900">Docs</h1>
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
            <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {searchQuery ? 'Aucun document trouvé' : 'Aucun document'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery ? 'Essayez une autre recherche' : 'Créez votre premier document pour commencer'}
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
                  <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-gray-200 transition-colors">
                    <Plus className="h-6 w-6 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Nouveau document</span>
                </button>

                {/* Documents existants */}
                {filteredDocuments.map((doc) => (
                  <Card
                    key={doc.id}
                    className="group relative p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
                    onClick={() => navigate(`/docs/${doc.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(doc.id, doc.is_starred);
                          }}
                        >
                          <Star className={`h-4 w-4 ${doc.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        </Button>
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
                              Ouvrir
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
                    </div>
                    <h3 className="font-medium text-gray-900 mb-2 truncate">{doc.title}</h3>
                    <p className="text-sm text-gray-500">{formatDate(doc.updated_at)}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="group flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/docs/${doc.id}`)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{doc.title}</h3>
                        <p className="text-sm text-gray-500">{formatDate(doc.updated_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(doc.id, doc.is_starred);
                        }}
                      >
                        <Star className={`h-4 w-4 ${doc.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
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
                ))}
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