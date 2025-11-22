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
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';

import {
  ArrowLeft, Download, Share2, Users, Loader2, Star, MoreVertical, Trash2, Copy, Shield, Lock,
  FileText, Briefcase, FolderOpen, BookOpen, Lightbulb, Target, TrendingUp, Users as UsersIcon,
  Calendar, CheckSquare, MessageSquare, Mail, Phone, Globe, Settings, Heart, Zap, Award,
  BarChart, PieChart, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3, Quote, Type, Check
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

// --- CONFIGURATION DES POLICES ---
const FONT_FAMILIES = [
  { name: 'Inter', value: 'Inter', type: 'sans-serif' },
  { name: 'Serif (Par défaut)', value: '', type: 'serif' }, // Fallback standard
  { name: 'Roboto', value: 'Roboto', type: 'sans-serif' },
  { name: 'Open Sans', value: '"Open Sans"', type: 'sans-serif' },
  { name: 'Lato', value: 'Lato', type: 'sans-serif' },
  { name: 'Montserrat', value: 'Montserrat', type: 'sans-serif' },
  { name: 'Playfair Display', value: '"Playfair Display"', type: 'serif' },
  { name: 'Merriweather', value: 'Merriweather', type: 'serif' },
  { name: 'Lora', value: 'Lora', type: 'serif' },
  { name: 'Courier Prime', value: '"Courier Prime"', type: 'monospace' },
];

// --- CONFIGURATION DES ICÔNES ---
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
  const titleRef = useRef(title);
  const [encryptionIV, setEncryptionIV] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('FileText');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromRemoteRef = useRef(false);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  // --- CHARGEMENT DES GOOGLE FONTS ---
  useEffect(() => {
    const linkId = 'sivara-google-fonts';
    if (!window.document.getElementById(linkId)) {
      const link = window.document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      // Chargement de toutes les polices supportées
      link.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime&family=Inter:wght@300;400;500;600&family=Lato:wght@300;400;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Montserrat:wght@300;400;600&family=Open+Sans:wght@300;400;600&family=Playfair+Display:wght@400;600&family=Roboto:wght@300;400;500&display=swap';
      window.document.head.appendChild(link);
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
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
        // --- MAGIE DU MULTIPAGE CSS ---
        // On simule des pages A4 via un background gradient qui se répète
        // 1123px est environ la hauteur d'une page A4 à 96DPI
        // On alterne blanc (page) et gris (séparateur)
        class: `
          prose prose-lg max-w-none outline-none focus:outline-none 
          min-h-[1123px]
          bg-white
          py-[2.5cm] px-[2.5cm]
        `,
        style: `
          background-image: linear-gradient(#ffffff 1080px, #e5e7eb 1080px, #e5e7eb 1123px);
          background-size: 100% 1123px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        `
      },
    },
    onUpdate: ({ editor }) => {
      if (!isUpdatingFromRemoteRef.current) {
        handleContentChange(editor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (!user || !id) return;
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
      await encryptionService.initialize(user.id);
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
      
      editor.commands.setContent(decryptedContent);
      
    } catch (error: any) {
      console.error('Error fetching document:', error);
      showError('Impossible de lire ce document (Ancienne clé ou document introuvable)');
      navigate('/');
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

      const { error } = await supabase.from('documents').update(updateData).eq('id', id);
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
      saveDocument(titleRef.current, newContent);
      saveTimeoutRef.current = undefined;
    }, 1000);
  };

  const handleIconColorChange = async (icon: string, color: string) => {
    setSelectedIcon(icon);
    setSelectedColor(color);
    setShowIconPicker(false);
    await saveDocument(titleRef.current, editor?.getHTML() || '', icon, color);
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
      navigate('/');
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
      navigate('/');
    } catch (error: any) {
      showError('Erreur lors de la duplication');
    }
  };

  const exportToPDF = () => showError('Fonctionnalité PDF en cours de développement');
  const shareDocument = () => showError('Fonctionnalité de partage en cours de développement');

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
    <div className="min-h-screen flex flex-col bg-[#F3F4F6]">
      {/* Header (Sticky) */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm print:hidden">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4 flex-1">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
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
              <Button variant="ghost" size="icon" onClick={shareDocument}><Users className="h-5 w-5" /></Button>
              <Button variant="ghost" onClick={exportToPDF} className="hidden sm:flex"><Download className="mr-2 h-4 w-4" /> PDF</Button>
              <Button onClick={shareDocument} className="bg-gray-700 hover:bg-gray-800 hidden sm:flex"><Share2 className="mr-2 h-4 w-4" /> Partager</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={duplicateDocument}><Copy className="mr-2 h-4 w-4" /> Dupliquer</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={deleteDocument}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Toolbar avec Selecteur de Police */}
        <div className="border-t border-gray-200 bg-[#F8F9FA] px-4 py-2 flex justify-center items-center gap-1 flex-wrap shadow-inner">
            <div className="flex items-center bg-white rounded-lg shadow-sm border border-gray-200 px-2 py-1 gap-1">
                {/* Sélecteur de Police */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-[140px] justify-between font-normal px-2">
                      <span className="truncate">
                        {FONT_FAMILIES.find(f => editor?.isActive('textStyle', { fontFamily: f.value }))?.name || 'Police'}
                      </span>
                      <Type className="h-3 w-3 opacity-50 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[200px] max-h-[300px] overflow-y-auto">
                    {FONT_FAMILIES.map((font) => (
                      <DropdownMenuItem
                        key={font.name}
                        onClick={() => editor?.chain().focus().setFontFamily(font.value).run()}
                        className="flex items-center justify-between"
                        style={{ fontFamily: font.value || 'inherit' }}
                      >
                        {font.name}
                        {editor?.isActive('textStyle', { fontFamily: font.value }) && <Check className="h-3 w-3" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-6 w-px bg-gray-200 mx-1" />

                {/* Headings */}
                <Toggle size="sm" pressed={editor?.isActive('heading', { level: 1 })} onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className="data-[state=on]:bg-gray-100"><Heading1 className="h-4 w-4" /></Toggle>
                <Toggle size="sm" pressed={editor?.isActive('heading', { level: 2 })} onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className="data-[state=on]:bg-gray-100"><Heading2 className="h-4 w-4" /></Toggle>
                <Toggle size="sm" pressed={editor?.isActive('heading', { level: 3 })} onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className="data-[state=on]:bg-gray-100"><Heading3 className="h-4 w-4" /></Toggle>
                
                <div className="h-6 w-px bg-gray-200 mx-1" />

                {/* Styling */}
                <Toggle size="sm" pressed={editor?.isActive('bold')} onPressedChange={() => editor?.chain().focus().toggleBold().run()} className="data-[state=on]:bg-gray-100"><Bold className="h-4 w-4" /></Toggle>
                <Toggle size="sm" pressed={editor?.isActive('italic')} onPressedChange={() => editor?.chain().focus().toggleItalic().run()} className="data-[state=on]:bg-gray-100"><Italic className="h-4 w-4" /></Toggle>
                <Toggle size="sm" pressed={editor?.isActive('underline')} onPressedChange={() => editor?.chain().focus().toggleUnderline().run()} className="data-[state=on]:bg-gray-100"><UnderlineIcon className="h-4 w-4" /></Toggle>

                <div className="h-6 w-px bg-gray-200 mx-1" />

                {/* Lists & Alignment */}
                <Toggle size="sm" pressed={editor?.isActive('bulletList')} onPressedChange={() => editor?.chain().focus().toggleBulletList().run()} className="data-[state=on]:bg-gray-100"><List className="h-4 w-4" /></Toggle>
                <Toggle size="sm" pressed={editor?.isActive('orderedList')} onPressedChange={() => editor?.chain().focus().toggleOrderedList().run()} className="data-[state=on]:bg-gray-100"><ListOrdered className="h-4 w-4" /></Toggle>
                <Toggle size="sm" pressed={editor?.isActive({ textAlign: 'left' })} onPressedChange={() => editor?.chain().focus().setTextAlign('left').run()} className="data-[state=on]:bg-gray-100"><AlignLeft className="h-4 w-4" /></Toggle>
                <Toggle size="sm" pressed={editor?.isActive({ textAlign: 'center' })} onPressedChange={() => editor?.chain().focus().setTextAlign('center').run()} className="data-[state=on]:bg-gray-100"><AlignCenter className="h-4 w-4" /></Toggle>
                <Toggle size="sm" pressed={editor?.isActive({ textAlign: 'right' })} onPressedChange={() => editor?.chain().focus().setTextAlign('right').run()} className="data-[state=on]:bg-gray-100"><AlignRight className="h-4 w-4" /></Toggle>
            </div>
        </div>
      </header>

      {/* Zone de contenu (Fond Gris) */}
      <div className="flex-1 bg-[#F3F4F6] py-8 px-4 overflow-y-auto cursor-text print:bg-white print:p-0" onClick={() => editor?.commands.focus()}>
        {/* Page A4 Simulée */}
        <div 
            className="max-w-[21cm] w-full mx-auto print:shadow-none transition-shadow"
            onClick={(e) => e.stopPropagation()}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Dialog Personnalisation (inchangé) */}
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