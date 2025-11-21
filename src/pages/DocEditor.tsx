import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import {
  ArrowLeft,
  Download,
  Share2,
  Users,
  Loader2,
  Star,
  MoreVertical,
  Trash2,
  Copy
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Document {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  is_starred: boolean;
  updated_at: string;
}

const DocEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !id) {
      navigate('/login');
      return;
    }

    fetchDocument();

    // Subscription temps réel pour la collaboration
    const channel = supabase
      .channel(`document:${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `id=eq.${id}`
      }, (payload) => {
        const updated = payload.new as Document;
        // Ne pas écraser si l'utilisateur est en train de taper
        if (!saveTimeoutRef.current) {
          setTitle(updated.title);
          setContent(updated.content);
          if (contentRef.current) {
            contentRef.current.innerHTML = updated.content;
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [id, user, navigate]);

  const fetchDocument = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setDocument(data);
      setTitle(data.title);
      setContent(data.content);
      if (contentRef.current) {
        contentRef.current.innerHTML = data.content;
      }
    } catch (error: any) {
      console.error('Error fetching document:', error);
      showError('Erreur lors du chargement du document');
      navigate('/docs');
    } finally {
      setIsLoading(false);
    }
  };

  const saveDocument = async (newTitle?: string, newContent?: string) => {
    if (!id) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('documents')
        .update({
          title: newTitle ?? title,
          content: newContent ?? content,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error saving document:', error);
      showError('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(newTitle, content);
      saveTimeoutRef.current = undefined;
    }, 1000);
  };

  const handleContentChange = () => {
    if (!contentRef.current) return;

    const newContent = contentRef.current.innerHTML;
    setContent(newContent);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(title, newContent);
      saveTimeoutRef.current = undefined;
    }, 1000);
  };

  const toggleStar = async () => {
    if (!document) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({ is_starred: !document.is_starred })
        .eq('id', id);

      if (error) throw error;

      setDocument({ ...document, is_starred: !document.is_starred });
    } catch (error: any) {
      console.error('Error toggling star:', error);
    }
  };

  const deleteDocument = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Document supprimé');
      navigate('/docs');
    } catch (error: any) {
      console.error('Error deleting document:', error);
      showError('Erreur lors de la suppression');
    }
  };

  const duplicateDocument = async () => {
    if (!user || !document) return;

    try {
      const { error } = await supabase
        .from('documents')
        .insert({
          title: `${document.title} (copie)`,
          content: document.content,
          owner_id: user.id,
          is_starred: false
        });

      if (error) throw error;

      showSuccess('Document dupliqué');
      navigate('/docs');
    } catch (error: any) {
      console.error('Error duplicating document:', error);
      showError('Erreur lors de la duplication');
    }
  };

  const exportToPDF = () => {
    showError('Fonctionnalité PDF en cours de développement');
  };

  const shareDocument = () => {
    showError('Fonctionnalité de partage en cours de développement');
  };

  const applyFormat = (command: string, value?: string) => {
    window.document.execCommand(command, false, value);
    handleContentChange();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-10 bg-white">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/docs')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-3">
                <img src="/docs-icon.png" alt="Docs" className="h-8 w-8" />
                <Input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="text-lg font-medium border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 max-w-md"
                  placeholder="Document sans titre"
                />
              </div>

              {isSaving && (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleStar}
              >
                <Star className={`h-5 w-5 ${document?.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={shareDocument}
              >
                <Users className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                onClick={exportToPDF}
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>

              <Button
                onClick={shareDocument}
                className="bg-gray-700 hover:bg-gray-800"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Partager
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={duplicateDocument}>
                    <Copy className="mr-2 h-4 w-4" />
                    Dupliquer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={deleteDocument}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="container mx-auto px-6 py-2">
            <div className="flex items-center gap-1">
              <select
                onChange={(e) => applyFormat('formatBlock', e.target.value)}
                className="px-3 py-1 border border-gray-200 rounded text-sm bg-white"
              >
                <option value="p">Normal</option>
                <option value="h1">Titre 1</option>
                <option value="h2">Titre 2</option>
                <option value="h3">Titre 3</option>
              </select>

              <div className="h-6 w-px bg-gray-300 mx-2"></div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyFormat('bold')}
                className="font-bold"
              >
                B
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyFormat('italic')}
                className="italic"
              >
                I
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyFormat('underline')}
                className="underline"
              >
                U
              </Button>

              <div className="h-6 w-px bg-gray-300 mx-2"></div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyFormat('insertUnorderedList')}
              >
                • Liste
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyFormat('insertOrderedList')}
              >
                1. Liste
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Editor */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div
            ref={contentRef}
            contentEditable
            onInput={handleContentChange}
            className="min-h-[calc(100vh-300px)] outline-none prose prose-lg max-w-none"
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '16px',
              lineHeight: '1.8',
              color: '#1f2937'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default DocEditor;