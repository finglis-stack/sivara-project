import { useState, useEffect } from 'react';
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
import { Plus, Edit2, Trash2, FileText, Folder, ArrowLeft, Eye } from 'lucide-react';

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
  
  const [catForm, setCatForm] = useState({ title: '', description: '', slug: '', order: 0 });
  const [artForm, setArtForm] = useState({ title: '', slug: '', category_id: '', content: '', is_published: false });

  useEffect(() => {
    if (!loading) {
        checkStaffAccess();
    }
  }, [user, loading]);

  const checkStaffAccess = async () => {
    if (!user) {
        navigate('/login');
        return;
    }
    const { data } = await supabase.from('profiles').select('is_staff').eq('id', user.id).single();
    if (!data?.is_staff) {
        navigate('/');
        showError("Accès refusé. Zone réservée au personnel.");
        return;
    }
    setIsStaff(true);
    fetchData();
  };

  const fetchData = async () => {
    const { data: cats } = await supabase.from('help_categories').select('*').order('order');
    setCategories(cats || []);
    
    const { data: arts } = await supabase.from('help_articles').select('*, help_categories(title)').order('created_at', { ascending: false });
    setArticles(arts || []);
  };

  const handleSaveCategory = async () => {
    try {
        if (editingItem) {
            await supabase.from('help_categories').update(catForm).eq('id', editingItem.id);
            showSuccess("Catégorie modifiée");
        } else {
            await supabase.from('help_categories').insert(catForm);
            showSuccess("Catégorie créée");
        }
        setIsCatOpen(false);
        setEditingItem(null);
        setCatForm({ title: '', description: '', slug: '', order: 0 });
        fetchData();
    } catch (e) {
        showError("Erreur sauvegarde");
    }
  };

  const handleSaveArticle = async () => {
    try {
        const payload = { ...artForm, author_id: user?.id };
        if (editingItem) {
            await supabase.from('help_articles').update(payload).eq('id', editingItem.id);
            showSuccess("Article modifié");
        } else {
            await supabase.from('help_articles').insert(payload);
            showSuccess("Article créé");
        }
        setIsArtOpen(false);
        setEditingItem(null);
        setArtForm({ title: '', slug: '', category_id: '', content: '', is_published: false });
        fetchData();
    } catch (e) {
        showError("Erreur sauvegarde");
    }
  };

  const deleteItem = async (table: string, id: string) => {
      if(!confirm("Êtes-vous sûr ?")) return;
      await supabase.from(table).delete().eq('id', id);
      fetchData();
      showSuccess("Supprimé");
  };

  const openEditCat = (cat: any) => {
      setEditingItem(cat);
      setCatForm({ title: cat.title, description: cat.description, slug: cat.slug, order: cat.order });
      setIsCatOpen(true);
  };

  const openEditArt = (art: any) => {
      setEditingItem(art);
      setArtForm({ title: art.title, slug: art.slug, category_id: art.category_id, content: art.content, is_published: art.is_published });
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
            <Button variant="outline" onClick={() => window.open('/', '_blank')}>
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
                            <Button onClick={() => { setEditingItem(null); setArtForm({ title: '', slug: '', category_id: '', content: '', is_published: false }); }}>
                                <Plus className="mr-2 h-4 w-4" /> Nouvel Article
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Titre</TableHead>
                                <TableHead>Catégorie</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {articles.map((art) => (
                                <TableRow key={art.id}>
                                    <TableCell className="font-medium">{art.title}</TableCell>
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            {/* --- CATEGORIES TAB --- */}
            <TabsContent value="categories" className="space-y-4 mt-6">
                <div className="flex justify-end">
                    <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => { setEditingItem(null); setCatForm({ title: '', description: '', slug: '', order: 0 }); }}>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Slug</Label>
                                        <Input value={catForm.slug} onChange={(e) => setCatForm({...catForm, slug: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ordre</Label>
                                        <Input type="number" value={catForm.order} onChange={(e) => setCatForm({...catForm, order: parseInt(e.target.value)})} />
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleSaveCategory} className="w-full">Sauvegarder</Button>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Ordre</TableHead>
                                <TableHead>Titre</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((cat) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-mono text-xs">{cat.order}</TableCell>
                                    <TableCell className="font-medium">{cat.title}</TableCell>
                                    <TableCell className="text-gray-500 text-sm">{cat.slug}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteItem('help_categories', cat.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default HelpAdmin;