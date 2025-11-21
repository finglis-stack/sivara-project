import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
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
  Copy,
  Shield,
  Lock,
  FileText,
  Briefcase,
  FolderOpen,
  BookOpen,
  Lightbulb,
  Target,
  TrendingUp,
  Users as UsersIcon,
  Calendar,
  CheckSquare,
  MessageSquare,
  Mail,
  Phone,
  Globe,
  Settings,
  Heart,
  Zap,
  Award,
  BarChart,
  PieChart
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [content, setContent] = useState('');
  const [encryptionIV, setEncryptionIV] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('FileText');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const contentRef = useRef<HTMLDivElement>(null);
  const isUpdatingFromRemoteRef = useRef(false);
  const hasLoadedContentRef = useRef(false);

  useEffect(() => {
    if (!user || !id) {
      navigate('/login');
      return;
    }

    initializeEncryption();
    fetchDocument();

    // Subscription temps réel pour la collaboration
    const channel = supabase
      .channel(`document:${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `id=eq.${id}`
      }, async (payload) => {
        const updated = payload.new as Document;
        // Ne pas écraser si l'utilisateur est en train de taper
        if (!saveTimeoutRef.current) {
          isUpdatingFromRemoteRef.current = true;
          
          try {
            const decryptedTitle = await encryptionService.decrypt(updated.title, updated.encryption_iv);
            const decryptedContent = await encryptionService.decrypt(updated.content, updated.encryption_iv);
            
            setTitle(decryptedTitle);
            setContent(decryptedContent);
            setSelectedIcon(updated.icon || 'FileText');
            setSelectedColor(updated.color || '#3B82F6');
            if (contentRef.current) {
              contentRef.current.innerHTML = decryptedContent;
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
  }, [id, user, navigate]);

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

  useEffect(() => {
    if (content && contentRef.current && !hasLoadedContentRef.current) {
      contentRef.current.innerHTML = content;
      hasLoadedContentRef.current = true;
    }
  }, [content]);

  const fetchDocument = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Déchiffrer le document
      const decryptedTitle = await encryptionService.decrypt(data.title, data.encryption_iv);
      const decryptedContent = await encryptionService.decrypt(data.content, data.encryption_iv);

      setDocument(data);
      setTitle(decryptedTitle);
      setContent(decryptedContent);
      setEncryptionIV(data.encryption_iv);
      setSelectedIcon(data.icon || 'FileText');
      setSelectedColor(data.color || '#3B82F6');
      
      // Charger le contenu dans l'éditeur
      if (contentRef.current && decryptedContent) {
        contentRef.current.innerHTML = decryptedContent;
        hasLoadedContentRef.current = true;
      }
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

      // Générer un nouvel IV
      const { encrypted: encryptedTitle, iv: newIV } = await encryptionService.encrypt(newTitle);
      // Utiliser le MÊME IV pour le contenu
      const { encrypted: encryptedContent } = await encryptionService.encrypt(newContent, newIV);

      const updateData: any = {
        title: encryptedTitle,
        content: encryptedContent,
        encryption_iv: newIV,
        updated_at: new Date().toISOString()
      };

      if (newIcon !== undefined) {
        updateData.icon = newIcon;
      }

      if (newColor !== undefined) {
        updateData.color = newColor;
      }

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
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(newTitle, content);
      saveTimeoutRef.current = undefined;
    }, 1000);
  };

  const handleContentChange = () => {
    if (!contentRef.current || isUpdatingFromRemoteRef.current) return;

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

  const handleIconColorChange = async (icon: string, color: string) => {
    setSelectedIcon(icon);
    setSelectedColor(color);
    setShowIconPicker(false);
    
    await saveDocument(title, content, icon, color);
    showSuccess('Icône et couleur mises à jour');
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
      // Générer un nouvel IV
      const { encrypted: encryptedTitle, iv } = await encryptionService.encrypt(`${title} (copie)`);
      // Utiliser le MÊME IV pour le contenu
      const { encrypted: encryptedContent } = await encryptionService.encrypt(content, iv);

      const { error } = await supabase
        .from('documents')
        .insert({
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
    contentRef.current?.focus();
    handleContentChange();
  };

  const getIconTextColor = (bgColor: string) => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#1F2937' : '#FFFFFF';
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/docs')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-3">
                {/* Icône cliquable */}
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

              {isSaving && (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chiffrement...
                </span>
              )}
              {!isSaving && content && (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  Enregistré
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
                defaultValue="p"
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
            onBlur={handleContentChange}
            onKeyUp={handleContentChange}
            suppressContentEditableWarning
            className="min-h-[calc(100vh-300px)] outline-none prose prose-lg max-w-none focus:outline-none"
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '16px',
              lineHeight: '1.8',
              color: '#1f2937'
            }}
          />
        </div>
      </div>

      {/* Dialog de sélection d'icône et couleur */}
      <Dialog open={showIconPicker} onOpenChange={setShowIconPicker}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Personnaliser l'icône et la couleur</DialogTitle>
            <DialogDescription>
              Choisissez une icône et une couleur pour votre document
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Sélection de couleur */}
            <div>
              <h3 className="text-sm font-medium mb-3">Couleur de fond</h3>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    className={`h-12 rounded-lg transition-all ${
                      selectedColor === color.value
                        ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Sélection d'icône */}
            <div>
              <h3 className="text-sm font-medium mb-3">Icône</h3>
              <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto">
                {AVAILABLE_ICONS.map((iconItem) => {
                  const IconComponent = iconItem.icon;
                  return (
                    <button
                      key={iconItem.name}
                      onClick={() => setSelectedIcon(iconItem.name)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        selectedIcon === iconItem.name
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <IconComponent className="h-6 w-6 text-gray-700" />
                      <span className="text-xs text-gray-600">{iconItem.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aperçu */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Aperçu</h3>
              <div className="flex items-center gap-3">
                <div
                  className="h-16 w-16 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedColor }}
                >
                  <CurrentIcon className="h-8 w-8" style={{ color: getIconTextColor(selectedColor) }} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{title || 'Document sans titre'}</p>
                  <p className="text-sm text-gray-500">Votre document apparaîtra ainsi</p>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowIconPicker(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => handleIconColorChange(selectedIcon, selectedColor)}
                className="bg-gray-700 hover:bg-gray-800"
              >
                Appliquer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocEditor;