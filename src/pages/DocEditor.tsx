import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';

import {
  ArrowLeft, Download, Share2, Users, Loader2, Star, MoreVertical, Trash2, Copy, Shield, Lock,
  FileText, Briefcase, FolderOpen, BookOpen, Lightbulb, Target, TrendingUp, Users as UsersIcon,
  Calendar, CheckSquare, MessageSquare, Mail, Phone, Globe, Settings, Heart, Zap, Award,
  BarChart, PieChart, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3, Quote
} from 'lucide-react';

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Toggle } from '@/components/ui/toggle';

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
}

// Bibliothèque d'icônes disponibles
const AVAILABLE_ICONS = [
  { name: 'FileText', icon: FileText, label: 'Document' },
  { name: 'Briefcase', icon: Briefcase, label: 'Business' },
  { name: 'FolderOpen', icon: FolderOpen, label: 'Dossier' },
  { name: 'BookOpen', icon: BookOpen, label: 'Livre' },
  { name: 'Lightbulb', icon: Lightbulb, label: 'Idée' },
  { name: 'Target', icon: Target, label: 'Objectif' },
  { name: 'TrendingUp', icon: TrendingUp, label: 'Croissance' },
  { name: 'UsersIcon', icon: UsersIcon, label: 'Équipe' },
  { name: 'Calendar', icon: Calendar, label: 'Calendrier' },
  { name: 'CheckSquare', icon: CheckSquare, label: 'Tâches' },
  { name: 'MessageSquare', icon: MessageSquare, label: 'Messages' },
  { name: 'Mail', icon: Mail, label: 'Email' },
  { name: 'Phone', icon: Phone, label: 'Téléphone' },
  { name: 'Globe', icon: Globe, label: 'Web' },
  { name: 'Settings', icon: Settings, label: 'Paramètres' },
  { name: 'Heart', icon: Heart, label: 'Favori' },
  { name: 'Zap', icon: Zap, label: 'Énergie' },
  { name: 'Award', icon: Award, label: 'Récompense' },
  { name: 'BarChart', icon: BarChart, label: 'Graphique' },
  { name: 'PieChart', icon: PieChart, label: 'Statistiques' },
];

// Palette de couleurs
const COLOR_PALETTE = [
  { name: 'Bleu', value: '#3B82F6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Rose', value: '#EC4899' },
  { name: 'Rouge', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Jaune', value: '#EAB308' },
  { name: 'Vert', value: '#10B981' },
  { name: 'Émeraude', value: '#059669' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Gris', value: '#6B7280' },
  { name: 'Ardoise', value: '#475569' },
];

const DocEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [encryptionIV, setEncryptionIV] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('FileText');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);

  // Initialisation de l'éditeur Tiptap
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Commencez à écrire ici...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none outline-none focus:outline-none min-h-[calc(100vh-300px)]',
      },
    },
    onUpdate: ({ editor }) => {
      if (!isUpdatingFromRemoteRef.current) {
        handleContentChange(editor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (!user || !id) {
      navigate('/login');
      return;
    }

    initializeEncryption();
    fetchDocument();

    const channel = supabase
      .channel(`document:${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `id=eq.${id}`
      }, async (payload) => {
        const updated = payload.new as Document;
        if (!saveTimeoutRef.current && editor) {
          isUpdatingFromRemoteRef.current = true;
          try {
            const decryptedTitle = await encryptionService.decrypt(updated.title, updated.encryption_iv);
            const decryptedContent = await encryptionService.decrypt(updated.content, updated.encryption_iv);
            
            setTitle(decryptedTitle);
            setSelectedIcon(updated.icon || 'FileText');
            setSelectedColor(updated.color || '#3B82F6');
            
            // Préserver la position du curseur si possible, sinon juste mettre à jour
            if (editor.getHTML() !== decryptedContent) {
                editor.commands.setContent(decryptedContent);
            }
          } catch (error) {
            console.error('Decryption error:', error);
          }
          
          setTimeout(() => {
            isUpdatingFromRemoteRef.current = false;
          }, 100);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [id, user, navigate, editor]);

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

  const fetchDocument = async () => {
    if (!id || !editor) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const decryptedTitle = await encryptionService.decrypt(data.title, data.encryption_iv);
      const decryptedContent = await encryptionService.decrypt(data.content, data.encryption_iv);

      setDocument(data);
      setTitle(decryptedTitle);
      setEncryptionIV(data.encryption_iv);
      setSelectedIcon(data.icon || 'FileText');
      setSelectedColor(data.color || '#3B82F6');
      
      // Important: Set content for Tiptap
      editor.commands.setContent(decryptedContent);
      
    } catch (error: any) {
      console.error('Error fetching document:', error);
      showError('Erreur lors du chargement du document');
      navigate('/docs');
    } finally {
      setIsLoading(false);
    }
  };

  const saveDocument = async (newTitle: string, newContent: string, newIcon?: string, newColor?: string) => {
    if (!id) return;

    try {
      setIsSaving(true);

      const { encrypted: encryptedTitle, iv: newIV } = await encryptionService.encrypt(newTitle);
      const { encrypted: encryptedContent } = await encryptionService.encrypt(newContent, newIV);

      const updateData: any = {
        title: encryptedTitle,
        content: encryptedContent,
        encryption_iv: newIV,
        updated_at: new Date().toISOString()
      };

      if (newIcon !== undefined) updateData.icon = newIcon;
      if (newColor !== undefined) updateData.color = newColor;

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      setEncryptionIV(newIV);
    } catch (error: any) {
      console.error('Error saving document:', error);
      showError('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(newTitle, editor?.getHTML() || '');
      saveTimeoutRef.current = undefined;
    }, 1000);
  };

  const handleContentChange = (newContent: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(title, newContent);
      saveTimeoutRef.current = undefined;
    }, 1000);
  };

  const handleIconColorChange = async (icon: string, color: string) => {
    setSelectedIcon(icon);
    setSelectedColor(color);
    setShowIconPicker(false);
    await saveDocument(title, editor?.getHTML() || '', icon, color);
    showSuccess('Apparence mise à jour');
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
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      showSuccess('Document supprimé');
      navigate('/docs');
    } catch (error: any) {
      showError('Erreur lors de la suppression');
    }
  };

  const duplicateDocument = async () => {
    if (!user || !document) return;
    try {
      const { encrypted: encryptedTitle, iv } = await encryptionService.encrypt(`${title} (copie)`);
      const { encrypted: encryptedContent } = await encryptionService.encrypt(editor?.getHTML() || '', iv);

      const { error } = await supabase.from('documents').insert({
        title: encryptedTitle,
        content: encryptedContent,
        owner_id: user.id,
        is_starred: false,
        encryption_iv: iv,
        icon: selectedIcon,
        color: selectedColor
      });

      if (error) throw error;
      showSuccess('Document dupliqué');
      navigate('/docs');
    } catch (error: any) {
      showError('Erreur lors de la duplication');
    }
  };

  const getIconTextColor = (bgColor: string) => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return ((r * 299 + g * 587 + b * 114) / 1000) > 155 ? '#1F2937' : '#FFFFFF';
  };

  const CurrentIcon = AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.icon || FileText;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Déchiffrement du document...
          </p>
        </div>
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
              <Button variant="ghost" size="icon" onClick={() => navigate('/docs')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowIconPicker(true)}
                  className="h-10 w-10 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
                  style={{ backgroundColor: selectedColor }}
                >
                  <CurrentIcon className="h-5 w-5" style={{ color: getIconTextColor(selectedColor) }} />
                </button>

                <Input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="text-lg font-medium border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 max-w-md"
                  placeholder="Document sans titre"
                />
                <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full">
                  <Shield className="h-3 w-3 text-green-600" />
                  <span className="text-xs font-medium text-green-700">Chiffré</span>
                </div>
              </div>

              {isSaving ? (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sauvegarde...
                </span>
              ) : (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  Enregistré
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleStar}>
                <Star className={`h-5 w-5 ${document?.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
              {/* Autres boutons d'action... */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={duplicateDocument}><Copy className="mr-2 h-4 w-4" /> Dupliquer</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={deleteDocument}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Toolbar de l'éditeur */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-2 flex items-center gap-1 flex-wrap">
            <Toggle
                size="sm"
                pressed={editor?.isActive('heading', { level: 1 })}
                onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                aria-label="Titre 1"
            >
                <Heading1 className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor?.isActive('heading', { level: 2 })}
                onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                aria-label="Titre 2"
            >
                <Heading2 className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor?.isActive('heading', { level: 3 })}
                onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                aria-label="Titre 3"
            >
                <Heading3 className="h-4 w-4" />
            </Toggle>
            
            <div className="h-6 w-px bg-gray-300 mx-2" />

            <Toggle
                size="sm"
                pressed={editor?.isActive('bold')}
                onPressedChange={() => editor?.chain().focus().toggleBold().run()}
                aria-label="Gras"
            >
                <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor?.isActive('italic')}
                onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
                aria-label="Italique"
            >
                <Italic className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor?.isActive('underline')}
                onPressedChange={() => editor?.chain().focus().toggleUnderline().run()}
                aria-label="Souligné"
            >
                <UnderlineIcon className="h-4 w-4" />
            </Toggle>

            <div className="h-6 w-px bg-gray-300 mx-2" />

            <Toggle
                size="sm"
                pressed={editor?.isActive('bulletList')}
                onPressedChange={() => editor?.chain().focus().toggleBulletList().run()}
            >
                <List className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor?.isActive('orderedList')}
                onPressedChange={() => editor?.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor?.isActive('blockquote')}
                onPressedChange={() => editor?.chain().focus().toggleBlockquote().run()}
            >
                <Quote className="h-4 w-4" />
            </Toggle>

             <div className="h-6 w-px bg-gray-300 mx-2" />

             <Toggle
                size="sm"
                pressed={editor?.isActive({ textAlign: 'left' })}
                onPressedChange={() => editor?.chain().focus().setTextAlign('left').run()}
            >
                <AlignLeft className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor?.isActive({ textAlign: 'center' })}
                onPressedChange={() => editor?.chain().focus().setTextAlign('center').run()}
            >
                <AlignCenter className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor?.isActive({ textAlign: 'right' })}
                onPressedChange={() => editor?.chain().focus().setTextAlign('right').run()}
            >
                <AlignRight className="h-4 w-4" />
            </Toggle>
        </div>
      </header>

      {/* Zone de contenu */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Dialog Personnalisation (Identique à avant) */}
      <Dialog open={showIconPicker} onOpenChange={setShowIconPicker}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Personnaliser l'icône et la couleur</DialogTitle>
            <DialogDescription>Choisissez une icône et une couleur pour votre document</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-3">Couleur de fond</h3>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    className={`h-12 rounded-lg transition-all ${selectedColor === color.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3">Icône</h3>
              <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto">
                {AVAILABLE_ICONS.map((iconItem) => {
                  const IconComponent = iconItem.icon;
                  return (
                    <button
                      key={iconItem.name}
                      onClick={() => setSelectedIcon(iconItem.name)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${selectedIcon === iconItem.name ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <IconComponent className="h-6 w-6 text-gray-700" />
                      <span className="text-xs text-gray-600">{iconItem.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setShowIconPicker(false)}>Annuler</Button>
              <Button onClick={() => handleIconColorChange(selectedIcon, selectedColor)} className="bg-gray-700 hover:bg-gray-800">Appliquer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocEditor;