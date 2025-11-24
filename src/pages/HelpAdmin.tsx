import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Plus, Edit2, Trash2, ArrowLeft, Eye, GripVertical, Upload, Loader2, ImageIcon } from 'lucide-react';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';

// --- COMPOSANTS DND ---
const SortableRow = ({ id, children }: { id: string, children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative' as const, zIndex: isDragging ? 10 : 1 };
  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? "bg-blue-50" : ""}>
      <TableCell className="w-[50px]">
        <button {...attributes} {...listeners} className="cursor-grab hover:text-blue-600 p-1"><GripVertical className="h-4 w-4 text-gray-400" /></button>
      </TableCell>
      {children}
    </TableRow>
  );
};

const HelpAdmin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  
  // Form States
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [isArtOpen, setIsArtOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [catForm, setCatForm] = useState({ title: '', description: '', slug: '', order: 0, image_url: '' });
  const [artForm, setArtForm] = useState({ title: '', slug: '', category_id: '', content: '', is_published: false, language: 'fr', order: 0 });

  const catFileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!loading) checkStaffAccess();
  }, [user, loading]);

  const checkStaffAccess = async () => {
    if (!user) { navigate('/login'); return; }
    const { data } = await supabase.from('profiles').select('is_staff').eq('id', user.id).single();
    if (!data?.is_staff) { navigate('/'); showError("Accès refusé."); return; }
    setIsStaff(true);
    fetchData();
  };

  const fetchData = async () => {
    const { data: cats } = await supabase.from('help_categories').select('*').order('order');
    setCategories(cats || []);
    // Récupérer les articles triés par ordre
    const { data: arts } = await supabase.from('help_articles').select('*, help_categories(title)').order('order', { ascending: true });
    setArticles(arts || []);
  };

  // --- SAVE LOGIC ---
  const handleSaveCategory = async () => {
    try {
        if (editingItem) {
            await supabase.from('help_categories').update(catForm).eq('id', editingItem.id);
            showSuccess("Catégorie modifiée");
        } else {
            // Auto increment order
            const maxOrder = Math.max(...categories.map(c => c.order || 0), 0);
            await supabase.from('help_categories').insert({ ...catForm, order: maxOrder + 1 });
            showSuccess("Catégorie créée");
        }
        setIsCatOpen(false); setEditingItem(null); fetchData();
        setCatForm({ title: '', description: '', slug: '', order: 0, image_url: '' });
    } catch (e) { showError("Erreur sauvegarde"); }
  };

  const handleSaveArticle = async () => {
    try {
        const payload = { ...artForm, author_id: user?.id };
        if (editingItem) {
            await supabase.from('help_articles').update(payload).eq('id', editingItem.id);
            showSuccess("Article modifié");
        } else {
            const maxOrder = Math.max(...articles.map(a => a.order || 0), 0);
            await supabase.from('help_articles').insert({ ...payload, order: maxOrder + 1 });
            showSuccess("Article créé");
        }
        setIsArtOpen(false); setEditingItem(null); fetchData();
        setArtForm({ title: '', slug: '', category_id: '', content: '', is_published: false, language: 'fr', order: 0 });
    } catch (e) { showError("Erreur sauvegarde"); }
  };

  const deleteItem = async (table: string, id: string) => {
      if(!confirm("Êtes-vous sûr ?")) return;
      await supabase.from(table).delete().eq('id', id);
      fetchData();
      showSuccess("Supprimé");
  };

  // --- UPLOAD ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        setIsUploading(true);
        const fileName = `help-cat-${Date.now()}`;
        const { error } = await supabase.storage.from('public_assets').upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from('public_assets').getPublicUrl(fileName);
        setCatForm({ ...catForm, image_url: data.publicUrl });
        showSuccess("Image uploadée");
    } catch (err) {
        console.error(err);
        // Si le bucket n'existe pas ou autre erreur, on ignore pour la démo
        showError("Erreur upload (Vérifiez que le bucket 'public_assets' existe)");
    } finally {
        setIsUploading(false);
    }
  };

  // --- DRAG AND DROP ---
  const handleDragEndCats = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    setCategories((items) => {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      
      // Persist new order to DB
      const updates = newItems.map((item, index) => ({ id: item.id, order: index }));
      updates.forEach(u => supabase.from('help_categories').update({ order: u.order }).eq('id', u.id).then());
      
      return newItems;
    });
  };

  const handleDragEndArts = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    setArticles((items) => {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      
      const updates = newItems.map((item, index) => ({ id: item.id, order: index }));
      updates.forEach(u => supabase.from('help_articles').update({ order: u.order }).eq('id', u.id).then());
      
      return newItems;
    });
  };

  // --- EDIT HELPERS ---
  const openEditCat = (cat: any) => {
      setEditingItem(cat);
      setCatForm({ title: cat.title, description: cat.description, slug: cat.slug, order: cat.order, image_url: cat.image_url || '' });
      setIsCatOpen(true);
  };

  const openEditArt = (art: any) => {
      setEditingItem(art);
      setArtForm({ title: art.title, slug: art.slug, category_id: art.category_id, content: art.content, is_published: art.is_published, language: art.language || 'fr', order: art.order });
      setIsArtOpen(true);
  };

  if (!isStaff) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Button>
                <h1 className="text-2xl font-bold text-gray-900">Administration Help Center</h1>
            </div>
            <Button variant="outline" onClick={() => window.open('/?app=help', '_blank')}>
                <Eye className="mr-2 h-4 w-4" /> Voir le site
            </Button>
        </div>

        <Tabs defaultValue="articles" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="articles">Articles</TabsTrigger>
                <TabsTrigger value="categories">Catégories</TabsTrigger>
            </TabsList>

            {/* --- ARTICLES TAB --- */}
            <TabsContent value="articles" className="space-y-4 mt-6">
                <div className="flex justify-end">
                    <Dialog open={isArtOpen} onOpenChange={setIsArtOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => { setEditingItem(null); setArtForm({ title: '', slug: '', category_id: '', content: '', is_published: false, language: 'fr', order: 0 }); }}>
                                <Plus className="mr-2 h-4 w-4" /> Nouvel Article
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>{editingItem ? 'Modifier' : 'Créer'} un article</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Titre</Label>
                                        <Input value={artForm.title} onChange={(e) => setArtForm({...artForm, title: e.target.value, slug: e.target.value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Slug (URL)</Label>
                                        <Input value={artForm.slug} onChange={(e) => setArtForm({...artForm, slug: e.target.value})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Catégorie</Label>
                                        <Select value={artForm.category_id} onValueChange={(v) => setArtForm({...artForm, category_id: v})}>
                                            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Langue</Label>
                                        <Select value={artForm.language} onValueChange={(v) => setArtForm({...artForm, language: v})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fr">Français 🇫🇷</SelectItem>
                                                <SelectItem value="en">English 🇺🇸</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Contenu (Markdown supporté)</Label>
                                    <Textarea className="h-64 font-mono text-sm" value={artForm.content} onChange={(e) => setArtForm({...artForm, content: e.target.value})} />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch id="publish" checked={artForm.is_published} onCheckedChange={(c) => setArtForm({...artForm, is_published: c})} />
                                    <Label htmlFor="publish">Publier immédiatement</Label>
                                </div>
                            </div>
                            <Button onClick={handleSaveArticle} className="w-full">Sauvegarder</Button>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndArts}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Titre</TableHead>
                                    <TableHead>Langue</TableHead>
                                    <TableHead>Catégorie</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <SortableContext items={articles.map(a => a.id)} strategy={verticalListSortingStrategy}>
                                    {articles.map((art) => (
                                        <SortableRow key={art.id} id={art.id}>
                                            <TableCell className="font-medium">{art.title}</TableCell>
                                            <TableCell>
                                                <span className="text-lg">{art.language === 'en' ? '🇺🇸' : '🇫🇷'}</span>
                                            </TableCell>
                                            <TableCell>{art.help_categories?.title || '-'}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${art.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {art.is_published ? 'Publié' : 'Brouillon'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEditArt(art)}><Edit2 className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteItem('help_articles', art.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </SortableRow>
                                    ))}
                                </SortableContext>
                            </TableBody>
                        </Table>
                    </DndContext>
                </div>
            </TabsContent>

            {/* --- CATEGORIES TAB --- */}
            <TabsContent value="categories" className="space-y-4 mt-6">
                <div className="flex justify-end">
                    <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => { setEditingItem(null); setCatForm({ title: '', description: '', slug: '', order: 0, image_url: '' }); }}>
                                <Plus className="mr-2 h-4 w-4" /> Nouvelle Catégorie
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>{editingItem ? 'Modifier' : 'Créer'} une catégorie</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Titre</Label>
                                    <Input value={catForm.title} onChange={(e) => setCatForm({...catForm, title: e.target.value, slug: e.target.value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input value={catForm.description} onChange={(e) => setCatForm({...catForm, description: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Slug</Label>
                                    <Input value={catForm.slug} onChange={(e) => setCatForm({...catForm, slug: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Image (Facultatif)</Label>
                                    <div className="flex gap-2 items-center">
                                        {catForm.image_url ? (
                                            <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-gray-200">
                                                <img src={catForm.image_url} alt="preview" className="h-full w-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-400">
                                                <ImageIcon className="h-6 w-6" />
                                            </div>
                                        )}
                                        <input ref={catFileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        <Button type="button" variant="outline" size="sm" onClick={() => catFileInputRef.current?.click()} disabled={isUploading}>
                                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Upload
                                        </Button>
                                        {catForm.image_url && (
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setCatForm({...catForm, image_url: ''})} className="text-red-500">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleSaveCategory} className="w-full">Sauvegarder</Button>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCats}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Titre</TableHead>
                                    <TableHead>Image</TableHead>
                                    <TableHead>Slug</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                    {categories.map((cat) => (
                                        <SortableRow key={cat.id} id={cat.id}>
                                            <TableCell className="font-medium">{cat.title}</TableCell>
                                            <TableCell>
                                                {cat.image_url && <img src={cat.image_url} alt="" className="h-8 w-8 rounded object-cover bg-gray-100" />}
                                            </TableCell>
                                            <TableCell className="text-gray-500 text-sm">{cat.slug}</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)}><Edit2 className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteItem('help_categories', cat.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </SortableRow>
                                    ))}
                                </SortableContext>
                            </TableBody>
                        </Table>
                    </DndContext>
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default HelpAdmin;