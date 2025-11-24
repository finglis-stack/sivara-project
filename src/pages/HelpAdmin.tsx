import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { 
  MessageSquare, Search, Send, LogOut, 
  Folder, FileText, Plus, Edit2, Trash2, 
  Eye, Layout, Lock, ChevronRight, Loader2,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// --- TYPES ---
interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'closed' | 'suspended';
  customer_email: string;
  last_message_at: string;
  profiles: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    phone_number: string;
    is_pro: boolean;
  };
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  is_staff_reply: boolean;
  sender_email: string;
  profiles?: {
    avatar_url: string | null;
    first_name: string;
  };
}

interface Category {
  id: string;
  title: string;
  description: string;
  slug: string;
  order: number;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  is_published: boolean;
  view_count: number;
  category_id: string;
}

const HelpAdmin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('support');
  const [isStaff, setIsStaff] = useState(false);

  // --- CONTENT STATE ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Content Dialogs
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [showArticleDialog, setShowArticleDialog] = useState(false);
  const [editMode, setEditMode] = useState(false); // true = update, false = create
  
  // Forms
  const [catForm, setCatForm] = useState({ title: '', description: '', slug: '', order: 0 });
  const [artForm, setArtForm] = useState({ title: '', slug: '', content: '', is_published: false });
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // --- SUPPORT STATE ---
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [userStats, setUserStats] = useState({ files: 0, folders: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // VERIFICATION STAFF
  useEffect(() => {
    if (!loading && user) {
      supabase.from('profiles').select('is_staff').eq('id', user.id).single()
      .then(({ data }) => {
        if (!data?.is_staff) {
            navigate('/'); 
        } else {
            setIsStaff(true);
        }
      });
    } else if (!loading && !user) {
        navigate('/login');
    }
  }, [user, loading, navigate]);

  // CHARGEMENT INITIAL
  useEffect(() => {
    if (!isStaff) return;
    if (activeTab === 'support') {
        fetchTickets();
        const sub = supabase.channel('tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, fetchTickets)
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    } else {
        fetchCategories();
    }
  }, [activeTab, isStaff]);

  // --- LOGIQUE CONTENU ---

  const fetchCategories = async () => {
    setIsLoadingContent(true);
    const { data } = await supabase.from('help_categories').select('*').order('order');
    setCategories(data || []);
    // Sélectionner la première catégorie par défaut si aucune sélectionnée
    if (data && data.length > 0 && !selectedCategory) {
        handleSelectCategory(data[0]);
    }
    setIsLoadingContent(false);
  };

  const handleSelectCategory = async (cat: Category) => {
    setSelectedCategory(cat);
    const { data } = await supabase.from('help_articles').select('*').eq('category_id', cat.id).order('order');
    setArticles(data || []);
  };

  const handleSaveCategory = async () => {
    try {
        const slug = catForm.slug || catForm.title.toLowerCase().replace(/ /g, '-');
        if (editMode && selectedCategory) {
            await supabase.from('help_categories').update({ ...catForm, slug }).eq('id', selectedCategory.id);
            showSuccess("Catégorie mise à jour");
        } else {
            await supabase.from('help_categories').insert({ ...catForm, slug });
            showSuccess("Catégorie créée");
        }
        setShowCatDialog(false);
        fetchCategories();
    } catch (e) { showError("Erreur sauvegarde"); }
  };

  const handleDeleteCategory = async (id: string) => {
      if (!confirm("Supprimer ?")) return;
      await supabase.from('help_categories').delete().eq('id', id);
      setSelectedCategory(null);
      fetchCategories();
  };

  const handleSaveArticle = async () => {
      try {
        if (!selectedCategory) return;
        const slug = artForm.slug || artForm.title.toLowerCase().replace(/ /g, '-');
        
        const payload = {
            title: artForm.title,
            slug,
            content: artForm.content,
            is_published: artForm.is_published,
            category_id: selectedCategory.id
        };

        if (editMode && selectedArticle) {
            await supabase.from('help_articles').update(payload).eq('id', selectedArticle.id);
            showSuccess("Article mis à jour");
        } else {
            await supabase.from('help_articles').insert({ ...payload, author_id: user?.id });
            showSuccess("Article créé");
        }
        setShowArticleDialog(false);
        handleSelectCategory(selectedCategory);
      } catch (e) { showError("Erreur sauvegarde article"); }
  };

  const handleDeleteArticle = async (id: string) => {
      if (!confirm("Supprimer l'article ?")) return;
      await supabase.from('help_articles').delete().eq('id', id);
      if (selectedCategory) handleSelectCategory(selectedCategory);
  };

  // --- LOGIQUE SUPPORT ---

  const fetchTickets = async () => {
      const { data } = await supabase.from('support_tickets').select('*, profiles:user_id(first_name, last_name, avatar_url)').order('last_message_at', { ascending: false });
      setTickets(data || []);
  };

  const selectTicket = async (ticketId: string) => {
      setSelectedTicketId(ticketId);
      const { data } = await supabase.from('support_messages').select('*, profiles:sender_id(first_name, avatar_url)').eq('ticket_id', ticketId).order('created_at', { ascending: true });
      setMessages(data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendReply = async () => {
      if (!selectedTicketId || !replyText.trim()) return;
      setIsSending(true);
      try {
          await supabase.functions.invoke('support-outbound', {
              body: { ticketId: selectedTicketId, messageBody: replyText, status: 'open' }
          });
          setReplyText('');
          selectTicket(selectedTicketId);
          showSuccess("Envoyé");
      } catch (e) { showError("Erreur d'envoi"); } finally { setIsSending(false); }
  };

  const closeTicket = async () => {
      if (!selectedTicketId) return;
      await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', selectedTicketId);
      fetchTickets();
      showSuccess("Ticket fermé");
  };

  if (loading || !isStaff) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-20 bg-gray-900 flex flex-col items-center py-6 gap-4 shrink-0 z-30">
         <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-bold mb-4 cursor-pointer" onClick={() => navigate('/')}>S</div>
         
         <button 
            onClick={() => setActiveTab('support')} 
            className={`p-3 rounded-xl transition-all relative group ${activeTab === 'support' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
         >
            <MessageSquare className="h-5 w-5" />
            <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">Support</span>
         </button>

         <button 
            onClick={() => setActiveTab('content')} 
            className={`p-3 rounded-xl transition-all relative group ${activeTab === 'content' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
         >
            <Layout className="h-5 w-5" />
            <span className="absolute left-full ml-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">Contenu</span>
         </button>

         <div className="mt-auto">
            <button onClick={() => navigate('/')} className="p-3 text-gray-500 hover:text-white transition-colors"><LogOut className="h-5 w-5" /></button>
         </div>
      </div>

      {/* --- VIEW: SUPPORT --- */}
      {activeTab === 'support' && (
        <div className="flex-1 flex overflow-hidden">
            {/* LISTE */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
                <div className="p-4 border-b border-gray-200 bg-white">
                    <h2 className="font-bold text-gray-900 mb-3">Tickets</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input placeholder="Rechercher..." className="pl-9 bg-white" />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    {tickets.map(t => (
                        <div 
                            key={t.id} 
                            onClick={() => selectTicket(t.id)}
                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition-colors ${selectedTicketId === t.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-sm text-gray-900">{t.profiles?.first_name || 'Client'}</span>
                                <span className="text-[10px] text-gray-400">{new Date(t.last_message_at).toLocaleDateString()}</span>
                            </div>
                            <div className="text-sm font-medium text-gray-700 truncate mb-1">{t.subject}</div>
                            <Badge variant="outline" className={`text-[10px] capitalize ${t.status === 'open' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{t.status}</Badge>
                        </div>
                    ))}
                </ScrollArea>
            </div>

            {/* CHAT */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedTicketId ? (
                    <>
                        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
                            <span className="font-bold text-gray-900">Ticket #{selectedTicketId.substring(0,8)}</span>
                            <Button variant="outline" size="sm" onClick={closeTicket}>Clore</Button>
                        </div>
                        <ScrollArea className="flex-1 bg-gray-50/50 p-6">
                            <div className="space-y-6 max-w-3xl mx-auto">
                                {messages.map(m => (
                                    <div key={m.id} className={`flex gap-4 ${m.is_staff_reply ? 'flex-row-reverse' : ''}`}>
                                        <Avatar className="h-8 w-8 border bg-white"><AvatarFallback>{m.is_staff_reply ? 'S' : 'C'}</AvatarFallback></Avatar>
                                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm shadow-sm ${m.is_staff_reply ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'}`}>
                                            <div dangerouslySetInnerHTML={{__html: m.body}} />
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>
                        <div className="p-4 border-t border-gray-200 bg-white">
                            <div className="max-w-3xl mx-auto relative">
                                <Textarea 
                                    value={replyText} 
                                    onChange={e => setReplyText(e.target.value)} 
                                    placeholder="Répondre..." 
                                    className="min-h-[100px] pr-14 resize-none bg-gray-50 border-0 focus:ring-1 focus:bg-white transition-all" 
                                />
                                <Button 
                                    size="icon" 
                                    className="absolute bottom-3 right-3 h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                    onClick={sendReply}
                                    disabled={isSending}
                                >
                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <MessageSquare className="h-16 w-16 mb-4 text-gray-200" />
                        <p>Sélectionnez un ticket</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- VIEW: CONTENT --- */}
      {activeTab === 'content' && (
        <div className="flex-1 flex overflow-hidden bg-gray-50">
            
            {/* CATEGORIES LIST (Left) */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="font-bold text-gray-900">Catégories</h2>
                    <Button size="sm" variant="ghost" onClick={() => { setCatForm({ title: '', description: '', slug: '', order: categories.length }); setEditMode(false); setShowCatDialog(true); }}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {categories.map(cat => (
                            <div 
                                key={cat.id} 
                                onClick={() => handleSelectCategory(cat)}
                                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${selectedCategory?.id === cat.id ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Folder className={`h-4 w-4 shrink-0 ${selectedCategory?.id === cat.id ? 'fill-blue-200' : 'text-gray-400'}`} />
                                    <span className="font-medium truncate">{cat.title}</span>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreVertical className="h-3 w-3" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCatForm(cat); setEditMode(true); setShowCatDialog(true); }}>Modifier</DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} className="text-red-600">Supprimer</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* ARTICLES LIST (Right) */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {selectedCategory ? (
                    <>
                        <div className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <span className="font-bold text-gray-900 text-lg">{selectedCategory.title}</span>
                                <ChevronRight className="h-4 w-4" />
                                <span>{articles.length} article(s)</span>
                            </div>
                            <Button onClick={() => { setArtForm({ title: '', slug: '', content: '', is_published: true }); setEditMode(false); setShowArticleDialog(true); }}>
                                <Plus className="h-4 w-4 mr-2" /> Nouvel Article
                            </Button>
                        </div>

                        <ScrollArea className="flex-1 p-6">
                            {articles.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {articles.map(article => (
                                        <div key={article.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${article.is_published ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-gray-900 truncate">{article.title}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span className="font-mono">/{article.slug}</span>
                                                        <span>•</span>
                                                        <span>{article.view_count} vues</span>
                                                        <span>•</span>
                                                        <span className={article.is_published ? "text-green-600 font-medium" : "text-orange-500 font-medium"}>
                                                            {article.is_published ? "Publié" : "Brouillon"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" onClick={() => window.open(`/article/${article.slug}`, '_blank')}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => { 
                                                    setArtForm({
                                                        title: article.title,
                                                        slug: article.slug,
                                                        content: article.content,
                                                        is_published: article.is_published
                                                    }); 
                                                    setSelectedArticle(article); 
                                                    setEditMode(true); 
                                                    setShowArticleDialog(true); 
                                                }}>
                                                    <Edit2 className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteArticle(article.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                    <FileText className="h-12 w-12 mb-4 text-gray-300" />
                                    <p>Aucun article dans cette catégorie</p>
                                </div>
                            )}
                        </ScrollArea>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <Folder className="h-16 w-16 mb-4 text-gray-300" />
                        <p>Sélectionnez une catégorie pour gérer les articles</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- DIALOGUES --- */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
            <DialogHeader><DialogTitle>{editMode ? 'Modifier' : 'Nouvelle'} Catégorie</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Titre</Label><Input value={catForm.title} onChange={e => setCatForm({...catForm, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Description</Label><Input value={catForm.description} onChange={e => setCatForm({...catForm, description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Slug (Optionnel)</Label><Input value={catForm.slug} onChange={e => setCatForm({...catForm, slug: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveCategory}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader><DialogTitle>{editMode ? 'Modifier' : 'Nouvel'} Article</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Titre</Label><Input value={artForm.title} onChange={e => setArtForm({...artForm, title: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Slug</Label><Input value={artForm.slug} onChange={e => setArtForm({...artForm, slug: e.target.value})} /></div>
                </div>
                <div className="space-y-2 h-full flex flex-col">
                    <Label>Contenu (Markdown)</Label>
                    <Textarea className="flex-1 font-mono text-sm leading-relaxed" value={artForm.content} onChange={e => setArtForm({...artForm, content: e.target.value})} />
                </div>
            </div>
            <DialogFooter className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Switch checked={artForm.is_published} onCheckedChange={c => setArtForm({...artForm, is_published: c})} />
                    <Label>Publié</Label>
                </div>
                <Button onClick={handleSaveArticle}>Sauvegarder</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default HelpAdmin;