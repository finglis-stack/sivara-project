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
  MessageSquare, Users, FileText, Search, CheckCircle2, 
  Send, MoreVertical, Phone, Paperclip, Ban, LogOut, 
  Folder, File as FileIcon, Crown, Plus, Edit2, Trash2, 
  Save, X, Eye, ArrowRight, Layout
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
  icon: string;
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('support');
  const [isLoading, setIsLoading] = useState(true);

  // --- SUPPORT STATE ---
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [userStats, setUserStats] = useState({ files: 0, folders: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- CONTENT STATE ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  
  // Content Dialogs
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [showArticleDialog, setShowArticleDialog] = useState(false);
  const [editMode, setEditMode] = useState(false); // true = update, false = create
  
  // Forms
  const [catForm, setCatForm] = useState({ title: '', description: '', slug: '', icon: 'HelpCircle', order: 0 });
  const [artForm, setArtForm] = useState({ title: '', slug: '', content: '', is_published: false });

  useEffect(() => {
    checkStaff();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'support') {
        fetchTickets();
        const channel = supabase
        .channel('admin-support')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchTickets())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
            if (payload.new.ticket_id === selectedTicketId) fetchMessages(selectedTicketId);
        })
        .subscribe();
        return () => { supabase.removeChannel(channel); };
    } else if (activeTab === 'content') {
        fetchCategories();
    }
  }, [activeTab, selectedTicketId]);

  const checkStaff = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('is_staff').eq('id', user.id).single();
    if (!data?.is_staff) navigate('/');
  };

  // --- SUPPORT LOGIC ---
  const fetchTickets = async () => {
    const { data } = await supabase.from('support_tickets')
      .select(`*, profiles:user_id (first_name, last_name, avatar_url, phone_number, is_pro)`)
      .order('last_message_at', { ascending: false });
    if (data) setTickets(data);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase.from('support_messages')
      .select(`*, profiles:sender_id(avatar_url, first_name)`)
      .eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (data) {
        setMessages(data);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleSelectTicket = (ticket: Ticket) => {
      setSelectedTicketId(ticket.id);
      fetchMessages(ticket.id);
      supabase.from('support_tickets').select('user_id').eq('id', ticket.id).single().then(({data}) => {
          if(data?.user_id) {
             supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', data.user_id).eq('type', 'file')
             .then(res => setUserStats(prev => ({ ...prev, files: res.count || 0 })));
             supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', data.user_id).eq('type', 'folder')
             .then(res => setUserStats(prev => ({ ...prev, folders: res.count || 0 })));
          }
      });
  };

  const handleSendReply = async (newStatus?: string) => {
      if (!selectedTicketId || !replyText.trim()) return;
      setIsSending(true);
      try {
          await supabase.functions.invoke('support-outbound', {
              body: { ticketId: selectedTicketId, messageBody: replyText, status: newStatus || 'open' }
          });
          setReplyText('');
          fetchMessages(selectedTicketId);
          if (newStatus) fetchTickets();
          showSuccess('Réponse envoyée');
      } catch (e) { showError("Erreur d'envoi"); } finally { setIsSending(false); }
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'open': return 'bg-green-100 text-green-700 border-green-200';
          case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
          case 'suspended': return 'bg-orange-100 text-orange-700 border-orange-200';
          default: return 'bg-gray-100';
      }
  };

  // --- CONTENT LOGIC (CATEGORIES) ---
  const fetchCategories = async () => {
      const { data } = await supabase.from('help_categories').select('*').order('order');
      setCategories(data || []);
      if (!selectedCategory && data && data.length > 0) handleSelectCategory(data[0]);
  };

  const handleSelectCategory = async (cat: Category) => {
      setSelectedCategory(cat);
      setSelectedArticle(null); // Reset article selection
      const { data } = await supabase.from('help_articles').select('*').eq('category_id', cat.id).order('order');
      setArticles(data || []);
  };

  const slugify = (text: string) => text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').trim();

  const handleSaveCategory = async () => {
      if (!catForm.title) return;
      const slug = catForm.slug || slugify(catForm.title);
      
      if (editMode && selectedCategory) {
          await supabase.from('help_categories').update({ ...catForm, slug }).eq('id', selectedCategory.id);
          showSuccess("Catégorie mise à jour");
      } else {
          await supabase.from('help_categories').insert({ ...catForm, slug });
          showSuccess("Catégorie créée");
      }
      setShowCatDialog(false);
      fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
      if(!confirm("Supprimer cette catégorie et tous ses articles ?")) return;
      await supabase.from('help_categories').delete().eq('id', id);
      fetchCategories();
      setSelectedCategory(null);
  };

  // --- CONTENT LOGIC (ARTICLES) ---
  const handleSaveArticle = async () => {
      if (!artForm.title || !selectedCategory || !user) return;
      const slug = artForm.slug || slugify(artForm.title);

      if (editMode && selectedArticle) {
          await supabase.from('help_articles').update({ ...artForm, slug }).eq('id', selectedArticle.id);
          showSuccess("Article mis à jour");
      } else {
          await supabase.from('help_articles').insert({ 
              ...artForm, 
              slug, 
              category_id: selectedCategory.id,
              author_id: user.id
          });
          showSuccess("Article créé");
      }
      setShowArticleDialog(false);
      if (selectedCategory) handleSelectCategory(selectedCategory); // Refresh list
  };

  const handleDeleteArticle = async (id: string) => {
      if(!confirm("Supprimer cet article ?")) return;
      await supabase.from('help_articles').delete().eq('id', id);
      if (selectedCategory) handleSelectCategory(selectedCategory);
  };

  // --- RENDER ---
  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      {/* MAIN SIDEBAR */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-6 gap-6 shrink-0 z-30 shadow-xl">
         <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-bold cursor-pointer" onClick={() => navigate('/?app=help')}>S</div>
         <div className="flex-1 flex flex-col gap-4 w-full px-2">
            <button onClick={() => setActiveTab('support')} className={`p-3 rounded-xl transition-all group relative ${activeTab === 'support' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                <MessageSquare className="h-5 w-5" />
                <div className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Support</div>
            </button>
            <button onClick={() => setActiveTab('content')} className={`p-3 rounded-xl transition-all group relative ${activeTab === 'content' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                <Layout className="h-5 w-5" />
                <div className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Contenu</div>
            </button>
         </div>
         <button onClick={() => navigate('/')} className="p-3 text-gray-500 hover:text-white"><LogOut className="h-5 w-5" /></button>
      </div>

      {/* ==================== VIEW: SUPPORT ==================== */}
      {activeTab === 'support' && (
        <div className="flex-1 flex overflow-hidden">
            {/* TICKET LIST */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/50">
                <div className="p-4 border-b border-gray-200 bg-white">
                    <h2 className="font-bold text-lg mb-4">Tickets</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input placeholder="Rechercher..." className="pl-9 bg-gray-50 border-gray-200" />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-gray-100">
                        {tickets.map(ticket => (
                            <button 
                                key={ticket.id} 
                                onClick={() => handleSelectTicket(ticket)}
                                className={`w-full text-left p-4 hover:bg-white transition-all hover:shadow-sm ${selectedTicketId === ticket.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            {ticket.profiles?.avatar_url && <AvatarImage src={ticket.profiles.avatar_url} />}
                                            <AvatarFallback className="text-[10px]">{ticket.profiles?.first_name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-semibold text-gray-900 truncate max-w-[100px]">{ticket.profiles?.first_name || 'Inconnu'}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                        {new Date(ticket.last_message_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="text-sm font-medium text-gray-800 truncate mb-1">{ticket.subject}</h3>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border capitalize ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* CHAT AREA */}
            <div className="flex-1 flex flex-col bg-white min-w-0">
                {selectedTicketId ? (
                    <>
                        {/* Header */}
                        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
                            <div className="min-w-0">
                                <h2 className="font-bold text-gray-900 truncate flex items-center gap-3">
                                    {tickets.find(t => t.id === selectedTicketId)?.subject}
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-normal border ${getStatusColor(tickets.find(t => t.id === selectedTicketId)?.status || 'open')}`}>
                                        {tickets.find(t => t.id === selectedTicketId)?.status}
                                    </span>
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleSendReply('closed')}>Clore le ticket</Button>
                            </div>
                        </div>
                        {/* Messages */}
                        <ScrollArea className="flex-1 bg-[#F8F9FA] p-6">
                            <div className="space-y-6 max-w-3xl mx-auto">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex gap-4 ${msg.is_staff_reply ? 'flex-row-reverse' : ''}`}>
                                        <Avatar className="h-8 w-8 border shadow-sm shrink-0"><AvatarFallback>{msg.is_staff_reply ? 'S' : 'U'}</AvatarFallback></Avatar>
                                        <div className={`flex flex-col max-w-[80%] ${msg.is_staff_reply ? 'items-end' : 'items-start'}`}>
                                            <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${msg.is_staff_reply ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'}`} dangerouslySetInnerHTML={{ __html: msg.body }} />
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>
                        {/* Input */}
                        <div className="p-4 border-t border-gray-200 bg-white">
                            <div className="max-w-3xl mx-auto relative">
                                <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Répondre..." className="min-h-[100px] pr-24 resize-none bg-gray-50 border-gray-200 focus:bg-white rounded-xl" />
                                <div className="absolute bottom-3 right-3">
                                    <Button onClick={() => handleSendReply()} disabled={isSending || !replyText.trim()} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4">{isSending ? "..." : <Send className="h-4 w-4" />}</Button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400"><MessageSquare className="h-16 w-16 mb-4 text-gray-200" /><p>Sélectionnez un ticket</p></div>
                )}
            </div>
            
            {/* USER PROFILE SIDEBAR (Conditional) */}
            {selectedTicketId && (
                <div className="w-72 border-l border-gray-200 bg-white shrink-0 overflow-y-auto p-6">
                    {/* User Stats */}
                    <h3 className="font-bold text-sm uppercase text-gray-400 mb-4">Utilisateur</h3>
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded-lg border">
                            <div className="text-xs text-gray-500">Fichiers Docs</div>
                            <div className="font-bold text-xl">{userStats.files}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border">
                            <div className="text-xs text-gray-500">Dossiers Docs</div>
                            <div className="font-bold text-xl">{userStats.folders}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* ==================== VIEW: CONTENT (CATEGORIES & ARTICLES) ==================== */}
      {activeTab === 'content' && (
        <div className="flex-1 flex overflow-hidden bg-gray-50">
            
            {/* LEFT: CATEGORIES LIST */}
            <div className="w-1/3 max-w-sm border-r border-gray-200 bg-white flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="font-bold text-gray-900">Catégories</h2>
                    <Button size="sm" variant="outline" onClick={() => { setCatForm({ title: '', description: '', slug: '', icon: 'HelpCircle', order: categories.length }); setEditMode(false); setShowCatDialog(true); }}>
                        <Plus className="h-4 w-4 mr-2" /> Nouvelle
                    </Button>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                        {categories.map(cat => (
                            <div 
                                key={cat.id}
                                onClick={() => handleSelectCategory(cat)}
                                className={`p-3 rounded-lg cursor-pointer border transition-all group ${selectedCategory?.id === cat.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-md ${selectedCategory?.id === cat.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                            <Folder className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className={`font-medium text-sm ${selectedCategory?.id === cat.id ? 'text-blue-900' : 'text-gray-700'}`}>{cat.title}</h3>
                                            <p className="text-xs text-gray-400 line-clamp-1">{cat.description || 'Pas de description'}</p>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreVertical className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCatForm(cat); setEditMode(true); setShowCatDialog(true); }}>Modifier</DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} className="text-red-600">Supprimer</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* RIGHT: ARTICLES LIST */}
            <div className="flex-1 flex flex-col bg-gray-50">
                {selectedCategory ? (
                    <>
                        <div className="p-6 pb-4 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedCategory.title}</h2>
                                <p className="text-gray-500 text-sm">Gérer les articles de cette section</p>
                            </div>
                            <Button onClick={() => { setArtForm({ title: '', slug: '', content: '', is_published: true }); setEditMode(false); setShowArticleDialog(true); }}>
                                <Plus className="h-4 w-4 mr-2" /> Nouvel Article
                            </Button>
                        </div>
                        
                        <ScrollArea className="flex-1 px-6 pb-6">
                            {articles.length > 0 ? (
                                <div className="grid gap-4">
                                    {articles.map(article => (
                                        <div key={article.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${article.is_published ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{article.title}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span className="font-mono bg-gray-100 px-1.5 rounded">/{article.slug}</span>
                                                        <span>•</span>
                                                        <span>{article.view_count} vues</span>
                                                        <span>•</span>
                                                        <span className={article.is_published ? "text-green-600" : "text-orange-500"}>
                                                            {article.is_published ? "Publié" : "Brouillon"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" onClick={() => window.open(`/article/${article.slug}`, '_blank')}>
                                                    <Eye className="h-4 w-4 text-gray-500" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => { setArtForm(article); setSelectedArticle(article); setEditMode(true); setShowArticleDialog(true); }}>
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
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl m-4 py-20">
                                    <FileText className="h-12 w-12 mb-4 text-gray-300" />
                                    <p>Aucun article dans cette catégorie</p>
                                </div>
                            )}
                        </ScrollArea>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Folder className="h-16 w-16 mb-4 text-gray-300" />
                        <p>Sélectionnez une catégorie pour voir les articles</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* DIALOGS */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
            <DialogHeader><DialogTitle>{editMode ? 'Modifier' : 'Nouvelle'} Catégorie</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Titre</Label><Input value={catForm.title} onChange={e => setCatForm({...catForm, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Description</Label><Input value={catForm.description} onChange={e => setCatForm({...catForm, description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Slug (Optionnel)</Label><Input value={catForm.slug} onChange={e => setCatForm({...catForm, slug: e.target.value})} placeholder="auto-genere" /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveCategory}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
            <DialogHeader><DialogTitle>{editMode ? 'Modifier' : 'Nouvel'} Article</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Titre</Label><Input value={artForm.title} onChange={e => setArtForm({...artForm, title: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Slug</Label><Input value={artForm.slug} onChange={e => setArtForm({...artForm, slug: e.target.value})} /></div>
                </div>
                <div className="space-y-2 h-full flex flex-col">
                    <Label>Contenu (Markdown supporté)</Label>
                    <Textarea className="flex-1 font-mono text-sm leading-relaxed" value={artForm.content} onChange={e => setArtForm({...artForm, content: e.target.value})} placeholder="# Titre..." />
                </div>
            </div>
            <DialogFooter className="flex justify-between items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Switch checked={artForm.is_published} onCheckedChange={c => setArtForm({...artForm, is_published: c})} />
                    <Label>Publié</Label>
                </div>
                <Button onClick={handleSaveArticle}>Enregistrer</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default HelpAdmin;